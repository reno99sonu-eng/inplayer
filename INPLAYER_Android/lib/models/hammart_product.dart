/// A Hammart marketplace listing. Mirrors `HammartProduct` in the
/// website's `app/lib/hammartProducts.ts` — GET /api/hammart/products
/// (browse) and GET /api/hammart/products/{id} (detail) both return this
/// shape (wrapped in `{products: [...]}` / `{product: {...}}`).
class HammartProduct {
  final String productId;
  final String vendorUserId;
  final String vendorId;
  final String title;
  final String description;
  final String details;
  final String hsCode;
  final String countryOfOrigin;
  final String category;
  final num priceInr;
  final String? imageUrl;
  final List<String> imageUrls;
  final String status; // 'active' | 'vendor_hidden' | 'admin_removed'
  final bool flagged;
  final String createdAt;

  HammartProduct({
    required this.productId,
    required this.vendorUserId,
    required this.vendorId,
    required this.title,
    this.description = '',
    this.details = '',
    this.hsCode = '',
    this.countryOfOrigin = 'India',
    required this.category,
    required this.priceInr,
    this.imageUrl,
    this.imageUrls = const [],
    this.status = 'active',
    this.flagged = false,
    this.createdAt = '',
  });

  /// All gallery images, falling back to the single `imageUrl` for older
  /// listings created before multi-image support existed.
  List<String> get gallery => imageUrls.isNotEmpty ? imageUrls : (imageUrl != null ? [imageUrl!] : []);

  factory HammartProduct.fromJson(Map<String, dynamic> json) {
    return HammartProduct(
      productId: json['productId']?.toString() ?? '',
      vendorUserId: json['vendorUserId']?.toString() ?? '',
      vendorId: json['vendorId']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      details: json['details']?.toString() ?? '',
      hsCode: json['hsCode']?.toString() ?? '',
      countryOfOrigin: json['countryOfOrigin']?.toString() ?? 'India',
      category: json['category']?.toString() ?? '',
      priceInr: (json['priceInr'] as num?) ?? 0,
      imageUrl: json['imageUrl'] as String?,
      imageUrls: ((json['imageUrls'] as List?) ?? []).whereType<String>().toList(),
      status: json['status']?.toString() ?? 'active',
      flagged: json['flagged'] == true,
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }
}
