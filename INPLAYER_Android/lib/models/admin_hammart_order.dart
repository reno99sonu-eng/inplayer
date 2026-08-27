/// Model representing a Hammart order in the admin panel.
class AdminHammartOrder {
  final String orderId;
  final String productTitle;
  final String? productImageUrl;
  final num priceInr;
  final int quantity;
  final num totalInr;
  final String buyerName;
  final String buyerEmail;
  final String vendorId;
  final String? vendorUserId;
  final String status; // 'placed' | 'payment_pending' | 'paid' | 'vendor_confirmed' | 'payment_failed' | 'vendor_cancelled'
  final String paymentMethod; // 'razorpay' | 'upi'
  final String? buyerClaimedPaidAt;
  final String createdAt;
  final String? updatedAt;

  AdminHammartOrder({
    required this.orderId,
    required this.productTitle,
    this.productImageUrl,
    this.priceInr = 0,
    this.quantity = 1,
    this.totalInr = 0,
    required this.buyerName,
    required this.buyerEmail,
    required this.vendorId,
    this.vendorUserId,
    this.status = 'placed',
    this.paymentMethod = 'upi',
    this.buyerClaimedPaidAt,
    required this.createdAt,
    this.updatedAt,
  });

  factory AdminHammartOrder.fromJson(Map<String, dynamic> json) {
    return AdminHammartOrder(
      orderId: (json['orderId'] ?? '').toString(),
      productTitle: (json['productTitle'] ?? 'Product').toString(),
      productImageUrl: json['productImageUrl']?.toString(),
      priceInr: (json['priceInr'] as num?) ?? 0,
      quantity: (json['quantity'] as num?)?.toInt() ?? 1,
      totalInr: (json['totalInr'] as num?) ?? 0,
      buyerName: (json['buyerName'] ?? 'Anonymous Buyer').toString(),
      buyerEmail: (json['buyerEmail'] ?? '').toString(),
      vendorId: (json['vendorId'] ?? '').toString(),
      vendorUserId: json['vendorUserId']?.toString(),
      status: (json['status'] ?? 'placed').toString(),
      paymentMethod: (json['paymentMethod'] ?? 'upi').toString(),
      buyerClaimedPaidAt: json['buyerClaimedPaidAt']?.toString(),
      createdAt: (json['createdAt'] ?? DateTime.now().toIso8601String()).toString(),
      updatedAt: json['updatedAt']?.toString(),
    );
  }
}

class AdminHammartOrdersResult {
  final List<AdminHammartOrder> items;
  final Map<String, int> counts;
  final bool tableMissing;

  AdminHammartOrdersResult({
    required this.items,
    this.counts = const {},
    this.tableMissing = false,
  });
}
