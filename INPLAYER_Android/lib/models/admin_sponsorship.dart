/// Model representing a sponsorship campaign/order in the admin panel.
class AdminSponsorship {
  final String sponsorshipId;
  final String companyName;
  final String contactName;
  final String contactEmail;
  final String contactPhone;
  final String websiteUrl;
  final String packageType;
  final List<String> sections;
  final String paymentStatus;
  final num? amountInr;
  final String status;
  final int assetCount;
  final String? activatedAt;
  final String? expiresAt;
  final String? adminNotes;
  final String createdAt;

  AdminSponsorship({
    required this.sponsorshipId,
    required this.companyName,
    this.contactName = '',
    this.contactEmail = '',
    this.contactPhone = '',
    this.websiteUrl = '',
    this.packageType = '',
    this.sections = const [],
    this.paymentStatus = 'pending',
    this.amountInr,
    this.status = 'pending_payment',
    this.assetCount = 0,
    this.activatedAt,
    this.expiresAt,
    this.adminNotes,
    required this.createdAt,
  });

  factory AdminSponsorship.fromJson(Map<String, dynamic> json) {
    String text(String key, [String fallback = '']) => json[key]?.toString() ?? fallback;
    final rawSections = json['sections'];
    return AdminSponsorship(
      sponsorshipId: (json['sponsorshipId'] ?? json['id'] ?? '').toString(),
      companyName: text('companyName', text('sponsorName', 'Sponsor')),
      contactName: text('contactName'),
      contactEmail: text('contactEmail', text('sponsorEmail')),
      contactPhone: text('contactPhone'),
      websiteUrl: text('websiteUrl'),
      packageType: text('packageType'),
      sections: rawSections is List ? rawSections.map((section) => section.toString()).toList() : const [],
      paymentStatus: text('paymentStatus', 'pending'),
      amountInr: (json['amountInr'] ?? json['amount'] ?? json['priceInr']) as num?,
      status: text('status', 'pending_payment'),
      assetCount: (json['assetCount'] as num?)?.toInt() ?? 0,
      activatedAt: json['activatedAt']?.toString(),
      expiresAt: json['expiresAt']?.toString(),
      adminNotes: json['adminNotes']?.toString(),
      createdAt: text('createdAt'),
    );
  }

  String get statusLabel {
    switch (status) {
      case 'pending_payment': return 'Pending payment';
      case 'awaiting_assets': return 'Awaiting assets';
      case 'active': return 'Active';
      case 'expired': return 'Expired';
      case 'cancelled': return 'Cancelled';
      default: return status.replaceAll('_', ' ');
    }
  }

  String get packageLabel {
    switch (packageType) {
      case 'bundle': return 'Entire InPlayer';
      case 'midroll': return 'Mid-roll video ad';
      case 'homepage_banner': return 'Homepage banner';
      case 'watch_banner': return 'Watch-page banner';
      default: return packageType.replaceAll('_', ' ');
    }
  }
}

class AdminSponsorshipsResult {
  final List<AdminSponsorship> items;
  final bool tableMissing;
  final String? error;

  AdminSponsorshipsResult({
    required this.items,
    this.tableMissing = false,
    this.error,
  });
}
