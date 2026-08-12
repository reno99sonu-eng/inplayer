import 'hammart_product.dart';

/// One line from GET /api/hammart/cart — live-joined against the real
/// product record on every load (never a stale price snapshot), matching
/// app/api/hammart/cart/route.ts. `unavailable` means the vendor removed
/// or hid the listing since it was added — the cart page shows this
/// honestly rather than silently dropping the line.
class HammartCartItem {
  final String productId;
  final int quantity;
  final String addedAt;
  final HammartProduct? product;
  final bool unavailable;

  HammartCartItem({
    required this.productId,
    required this.quantity,
    required this.addedAt,
    this.product,
    this.unavailable = false,
  });

  num get lineTotalInr => (product?.priceInr ?? 0) * quantity;

  factory HammartCartItem.fromJson(Map<String, dynamic> json) {
    return HammartCartItem(
      productId: json['productId']?.toString() ?? '',
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      addedAt: json['addedAt']?.toString() ?? '',
      product: json['product'] is Map ? HammartProduct.fromJson(Map<String, dynamic>.from(json['product'] as Map)) : null,
      unavailable: json['unavailable'] == true,
    );
  }
}

/// One line from GET /api/hammart/wishlist — same live-join/`unavailable`
/// pattern as the cart.
class HammartWishlistItem {
  final String productId;
  final String addedAt;
  final HammartProduct? product;
  final bool unavailable;

  HammartWishlistItem({
    required this.productId,
    required this.addedAt,
    this.product,
    this.unavailable = false,
  });

  factory HammartWishlistItem.fromJson(Map<String, dynamic> json) {
    return HammartWishlistItem(
      productId: json['productId']?.toString() ?? '',
      addedAt: json['addedAt']?.toString() ?? '',
      product: json['product'] is Map ? HammartProduct.fromJson(Map<String, dynamic>.from(json['product'] as Map)) : null,
      unavailable: json['unavailable'] == true,
    );
  }
}
