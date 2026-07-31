import { PutCommand, GetCommand, UpdateCommand, DeleteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";

// Hammart product listings. Same tableMissing/manual-table-creation
// convention as app/lib/hammartVendors.ts and everywhere else — Reno
// creates this in the AWS console by hand.
//
// Images: ONE photo per listing for now, stored inline as a compressed
// base64 data URL on the row itself (same pattern as video thumbnails —
// see app/lib/imageCompress.ts's compressImageToThumbnail). Multi-photo
// galleries are a real limitation of this first version, not something
// silently faked — flagged honestly rather than half-building a
// per-row-per-image gallery under time pressure. Follow the KYC-documents
// pattern (a Hammart-Product-Images table, one row per photo) if/when
// that's built.
export const PRODUCTS_TABLE = "Hammart-Products"; // PK: productId

export type ProductStatus = "active" | "vendor_hidden" | "admin_removed";

export interface HammartProduct {
  productId: string;
  vendorUserId: string;
  vendorId: string;
  title: string;
  description: string;
  category: string;
  priceInr: number;
  imageUrl: string | null;
  status: ProductStatus;
  flagged: boolean;
  flaggedCategory: string | null;
  flaggedReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  vendorUserId: string;
  vendorId: string;
  title: string;
  description: string;
  category: string;
  priceInr: number;
  imageUrl: string | null;
  flagged: boolean;
  flaggedCategory: string | null;
  flaggedReason: string | null;
}

export async function createProduct(
  input: CreateProductInput
): Promise<{ success: boolean; product?: HammartProduct; tableMissing?: boolean }> {
  const now = new Date().toISOString();
  const product: HammartProduct = {
    productId: randomUUID(),
    vendorUserId: input.vendorUserId,
    vendorId: input.vendorId,
    title: input.title,
    description: input.description,
    category: input.category,
    priceInr: input.priceInr,
    imageUrl: input.imageUrl,
    // A listing the banned-item check actually flagged never goes live —
    // it's created in a hidden state for the vendor to see (and for an
    // admin to review), same "flag, don't silently drop" convention as
    // video uploads' moderationHidden.
    status: input.flagged ? "vendor_hidden" : "active",
    flagged: input.flagged,
    flaggedCategory: input.flaggedCategory,
    flaggedReason: input.flaggedReason,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await docClient.send(new PutCommand({ TableName: PRODUCTS_TABLE, Item: product }));
    return { success: true, product };
  } catch (err) {
    console.error("createProduct: write failed (table may not exist yet):", err);
    return { success: false, tableMissing: true };
  }
}

export async function getProduct(productId: string): Promise<{ product: HammartProduct | null; tableMissing: boolean }> {
  try {
    const result = await docClient.send(new GetCommand({ TableName: PRODUCTS_TABLE, Key: { productId } }));
    return { product: (result.Item as HammartProduct) || null, tableMissing: false };
  } catch (err) {
    console.error("getProduct: lookup failed (table may not exist yet):", err);
    return { product: null, tableMissing: true };
  }
}

async function scanAll(
  filterExpression?: string,
  values?: Record<string, unknown>,
  names?: Record<string, string>
): Promise<HammartProduct[]> {
  const items: HammartProduct[] = [];
  let exclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: PRODUCTS_TABLE,
        FilterExpression: filterExpression,
        ExpressionAttributeValues: values,
        ExpressionAttributeNames: names,
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    items.push(...((result.Items || []) as HammartProduct[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return items;
}

// Public storefront listing — only real, live, unflagged products. Small-
// scale Scan+Filter, same approach every other admin/public list in this
// app already uses (no secondary indexes anywhere in this codebase).
export async function listActiveProducts(params?: {
  category?: string;
}): Promise<{ products: HammartProduct[]; tableMissing: boolean }> {
  try {
    let products = await scanAll("#status = :active", { ":active": "active" }, { "#status": "status" });
    if (params?.category) {
      products = products.filter((p) => p.category === params.category);
    }
    products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { products, tableMissing: false };
  } catch (err) {
    console.error("listActiveProducts: scan failed (table may not exist yet):", err);
    return { products: [], tableMissing: true };
  }
}

export async function listVendorProducts(vendorUserId: string): Promise<{ products: HammartProduct[]; tableMissing: boolean }> {
  try {
    const products = await scanAll("vendorUserId = :v", { ":v": vendorUserId });
    products.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { products, tableMissing: false };
  } catch (err) {
    console.error("listVendorProducts: scan failed (table may not exist yet):", err);
    return { products: [], tableMissing: true };
  }
}

export async function setProductStatus(productId: string, status: ProductStatus): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: PRODUCTS_TABLE,
      Key: { productId },
      UpdateExpression: "SET #status = :status, updatedAt = :now",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: { ":status": status, ":now": new Date().toISOString() },
    })
  );
}

export async function deleteProduct(productId: string): Promise<void> {
  await docClient.send(new DeleteCommand({ TableName: PRODUCTS_TABLE, Key: { productId } }));
}

// scanAll uses "#status" as an ExpressionAttributeName alias since "status"
// collides with nothing reserved here, but kept consistent with the rest
// of the codebase's habit of aliasing it everywhere it's used in a
// FilterExpression/UpdateExpression.
