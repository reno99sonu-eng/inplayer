/// One row from GET /api/admin/hammart-products — mirrors
/// app/api/admin/hammart-products/route.ts / app/lib/hammartProducts.ts.
class AdminHammartProduct {
  final String productId;
  final String vendorUserId;
  final String? vendorUsername;
  final String vendorId;
  final String title;
  final String category;
  final num priceInr;
  final String? imageUrl;
  final String status; // 'active' | 'vendor_hidden' | 'admin_removed'
  final bool flagged;
  final String? flaggedCategory;
  final String? flaggedReason;
  final String createdAt;

  AdminHammartProduct({
    required this.productId,
    required this.vendorUserId,
    this.vendorUsername,
    this.vendorId = '',
    this.title = '',
    this.category = '',
    this.priceInr = 0,
    this.imageUrl,
    this.status = 'active',
    this.flagged = false,
    this.flaggedCategory,
    this.flaggedReason,
    this.createdAt = '',
  });

  factory AdminHammartProduct.fromJson(Map<String, dynamic> json) {
    return AdminHammartProduct(
      productId: json['productId']?.toString() ?? '',
      vendorUserId: json['vendorUserId']?.toString() ?? '',
      vendorUsername: json['vendorUsername'] as String?,
      vendorId: json['vendorId']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      category: json['category']?.toString() ?? '',
      priceInr: (json['priceInr'] as num?) ?? 0,
      imageUrl: json['imageUrl'] as String?,
      status: json['status']?.toString() ?? 'active',
      flagged: json['flagged'] == true,
      flaggedCategory: json['flaggedCategory'] as String?,
      flaggedReason: json['flaggedReason'] as String?,
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }
}

/// One row from GET /api/admin/hammart-vendors — mirrors
/// app/api/admin/hammart-vendors/route.ts / app/lib/hammartVendors.ts.
/// Deliberately keeps only the fields the mobile review UI actually needs
/// (not every KYC field the website's own console shows) — the full
/// VendorProfile/VendorKycRow union on the backend has ~25 fields, most of
/// them address/document details a reviewer glances at once.
class AdminHammartVendor {
  final String userId;
  final String vendorId;
  final String businessType; // 'individual' | 'business'
  final String? businessName;
  final String kycStatus; // 'not_started' | 'pending_review' | 'verified' | 'rejected'
  final bool suspended;
  final String? legalName;
  final String? panNumber;
  final String? gstNumber;
  final String? bankAccountNumber;
  final String? bankIfsc;
  final String? city;
  final String? state;
  final String? rejectionReason;
  final String? submittedAt;
  final int totalProducts;
  final int totalSold;
  final num totalRevenueInr;
  final String razorpayAccountStatus; // 'not_started' | 'pending' | 'active' | 'failed'
  final String? razorpayAccountError;
  final Map<String, String> documents;

  AdminHammartVendor({
    required this.userId,
    this.vendorId = '',
    this.businessType = 'individual',
    this.businessName,
    this.kycStatus = 'not_started',
    this.suspended = false,
    this.legalName,
    this.panNumber,
    this.gstNumber,
    this.bankAccountNumber,
    this.bankIfsc,
    this.city,
    this.state,
    this.rejectionReason,
    this.submittedAt,
    this.totalProducts = 0,
    this.totalSold = 0,
    this.totalRevenueInr = 0,
    this.razorpayAccountStatus = 'not_started',
    this.razorpayAccountError,
    this.documents = const {},
  });

  factory AdminHammartVendor.fromJson(Map<String, dynamic> json) {
    final docsRaw = json['documents'];
    final docs = <String, String>{};
    if (docsRaw is Map) {
      for (final entry in docsRaw.entries) {
        if (entry.value is String) docs[entry.key.toString()] = entry.value as String;
      }
    }
    return AdminHammartVendor(
      userId: json['userId']?.toString() ?? '',
      vendorId: json['vendorId']?.toString() ?? '',
      businessType: json['businessType']?.toString() ?? 'individual',
      businessName: json['businessName'] as String?,
      kycStatus: json['kycStatus']?.toString() ?? 'not_started',
      suspended: json['suspended'] == true,
      legalName: json['legalName'] as String?,
      panNumber: json['panNumber'] as String?,
      gstNumber: json['gstNumber'] as String?,
      bankAccountNumber: json['bankAccountNumber'] as String?,
      bankIfsc: json['bankIfsc'] as String?,
      city: json['city'] as String?,
      state: json['state'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      submittedAt: json['submittedAt'] as String?,
      totalProducts: (json['totalProducts'] as num?)?.toInt() ?? 0,
      totalSold: (json['totalSold'] as num?)?.toInt() ?? 0,
      totalRevenueInr: (json['totalRevenueInr'] as num?) ?? 0,
      razorpayAccountStatus: json['razorpayAccountStatus']?.toString() ?? 'not_started',
      razorpayAccountError: json['razorpayAccountError'] as String?,
      documents: docs,
    );
  }
}

class AdminHammartVendorsResult {
  final List<AdminHammartVendor> items;
  final Map<String, int> counts;
  final bool tableMissing;
  AdminHammartVendorsResult({this.items = const [], this.counts = const {}, this.tableMissing = false});

  factory AdminHammartVendorsResult.fromJson(Map<String, dynamic> json) {
    final countsRaw = (json['counts'] as Map?) ?? {};
    final counts = <String, int>{};
    for (final entry in countsRaw.entries) {
      counts[entry.key.toString()] = (entry.value as num?)?.toInt() ?? 0;
    }
    return AdminHammartVendorsResult(
      items: ((json['items'] as List?) ?? [])
          .whereType<Map>()
          .map((j) => AdminHammartVendor.fromJson(Map<String, dynamic>.from(j)))
          .toList(),
      counts: counts,
      tableMissing: json['tableMissing'] == true,
    );
  }
}
