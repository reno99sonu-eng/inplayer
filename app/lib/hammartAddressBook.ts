import { PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import { docClient } from "@/app/lib/dynamodb";

export const ADDRESS_BOOK_TABLE = "Hammart-AddressBook"; // PK: addressId
export const ADDRESS_BOOK_USER_INDEX = "userId-index"; // GSI PK: userId

export interface HammartAddress {
  addressId: string;
  userId: string;
  label: string; // e.g., "Home", "Work", "Other"
  name: string;
  phone: string;
  deliveryAddress: string;
  city: string;
  state: string;
  pincode: string;
  lat?: number;
  lng?: number;
  createdAt: string;
}

export async function createAddress(
  input: Omit<HammartAddress, "addressId" | "createdAt">
): Promise<{ success: boolean; address?: HammartAddress; tableMissing?: boolean }> {
  const now = new Date().toISOString();
  const address: HammartAddress = {
    ...input,
    addressId: randomUUID(),
    createdAt: now,
  };

  try {
    await docClient.send(new PutCommand({ TableName: ADDRESS_BOOK_TABLE, Item: address }));
    return { success: true, address };
  } catch (err) {
    console.error("createAddress failed (table may not exist yet):", err);
    return { success: false, tableMissing: true };
  }
}

export async function listUserAddresses(userId: string): Promise<{ addresses: HammartAddress[]; tableMissing: boolean }> {
  try {
    const result = await docClient.send(
      new QueryCommand({
        TableName: ADDRESS_BOOK_TABLE,
        IndexName: ADDRESS_BOOK_USER_INDEX,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      })
    );
    const addresses = (result.Items as HammartAddress[]) || [];
    addresses.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { addresses, tableMissing: false };
  } catch (err) {
    console.error("listUserAddresses failed:", err);
    return { addresses: [], tableMissing: true };
  }
}

export async function deleteAddress(addressId: string): Promise<boolean> {
  try {
    await docClient.send(
      new DeleteCommand({
        TableName: ADDRESS_BOOK_TABLE,
        Key: { addressId },
      })
    );
    return true;
  } catch (err) {
    console.error("deleteAddress failed:", err);
    return false;
  }
}
