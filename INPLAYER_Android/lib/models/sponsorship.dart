class Sponsorship {
  final String sponsorshipId;
  final String userId;
  final String companyName;
  final String contactName;
  final String contactEmail;
  final String contactPhone;
  final String websiteUrl;
  final String packageType;
  final List<String> sections;
  final int amountInr;
  final String paymentStatus;
  final String legalName;
  final String panOrGst;
  final String businessAddress;
  final String status;
  final String? activatedAt;
  final String? expiresAt;
  final String adminNotes;
  final String createdAt;
  final String updatedAt;

  const Sponsorship({
    required this.sponsorshipId,
    required this.userId,
    required this.companyName,
    required this.contactName,
    required this.contactEmail,
    required this.contactPhone,
    required this.websiteUrl,
    required this.packageType,
    required this.sections,
    required this.amountInr,
    required this.paymentStatus,
    required this.legalName,
    required this.panOrGst,
    required this.businessAddress,
    required this.status,
    required this.activatedAt,
    required this.expiresAt,
    required this.adminNotes,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Sponsorship.fromJson(Map<String, dynamic> json) {
    final rawSections = json['sections'];
    return Sponsorship(
      sponsorshipId: (json['sponsorshipId'] ?? json['id'] ?? '').toString(),
      userId: (json['userId'] ?? '').toString(),
      companyName: (json['companyName'] ?? '').toString(),
      contactName: (json['contactName'] ?? '').toString(),
      contactEmail: (json['contactEmail'] ?? '').toString(),
      contactPhone: (json['contactPhone'] ?? '').toString(),
      websiteUrl: (json['websiteUrl'] ?? '').toString(),
      packageType: (json['packageType'] ?? '').toString(),
      sections: rawSections is List
          ? rawSections.map((e) => e.toString()).toList()
          : const <String>[],
      amountInr: (json['amountInr'] as num?)?.toInt() ?? 0,
      paymentStatus: (json['paymentStatus'] ?? 'pending').toString(),
      legalName: (json['legalName'] ?? '').toString(),
      panOrGst: (json['panOrGst'] ?? '').toString(),
      businessAddress: (json['businessAddress'] ?? '').toString(),
      status: (json['status'] ?? 'pending_payment').toString(),
      activatedAt: json['activatedAt']?.toString(),
      expiresAt: json['expiresAt']?.toString(),
      adminNotes: (json['adminNotes'] ?? '').toString(),
      createdAt: (json['createdAt'] ?? '').toString(),
      updatedAt: (json['updatedAt'] ?? '').toString(),
    );
  }
}

class SponsorshipCheckout {
  final String sponsorshipId;
  final String razorpayOrderId;
  final String razorpayKeyId;
  final int amountInr;

  const SponsorshipCheckout({
    required this.sponsorshipId,
    required this.razorpayOrderId,
    required this.razorpayKeyId,
    required this.amountInr,
  });

  factory SponsorshipCheckout.fromJson(Map<String, dynamic> json) {
    return SponsorshipCheckout(
      sponsorshipId: (json['sponsorshipId'] ?? '').toString(),
      razorpayOrderId: (json['razorpayOrderId'] ?? '').toString(),
      razorpayKeyId: (json['razorpayKeyId'] ?? '').toString(),
      amountInr: (json['amountInr'] as num?)?.toInt() ?? 0,
    );
  }

  bool get isValid =>
      sponsorshipId.isNotEmpty &&
      razorpayOrderId.isNotEmpty &&
      razorpayKeyId.isNotEmpty &&
      amountInr > 0;
}

class SponsorshipDetail {
  final Sponsorship sponsorship;
  final Map<String, dynamic>? specs;
  final List<Map<String, dynamic>> analytics;

  const SponsorshipDetail({
    required this.sponsorship,
    this.specs,
    this.analytics = const [],
  });

  factory SponsorshipDetail.fromJson(Map<String, dynamic> json) {
    final sponsorshipJson = json['sponsorship'];
    return SponsorshipDetail(
      sponsorship: Sponsorship.fromJson(
        sponsorshipJson is Map ? Map<String, dynamic>.from(sponsorshipJson) : <String, dynamic>{},
      ),
      specs: json['specs'] is Map ? Map<String, dynamic>.from(json['specs']) : null,
      analytics: (json['analytics'] is List)
          ? (json['analytics'] as List)
              .whereType<Map>()
              .map((m) => Map<String, dynamic>.from(m))
              .toList()
          : const <Map<String, dynamic>>[],
    );
  }
}
