/// Model representing a sponsorship campaign/order in the admin panel.
class AdminSponsorship {
  final String sponsorshipId;
  final String sponsorName;
  final String? brandName;
  final String? campaignTitle;
  final num? budgetInr;
  final num? amountInr;
  final String status; // 'pending' | 'approved' | 'active' | 'completed' | 'rejected'
  final int assetCount;
  final String? sponsorEmail;
  final String? notes;
  final String createdAt;

  AdminSponsorship({
    required this.sponsorshipId,
    required this.sponsorName,
    this.brandName,
    this.campaignTitle,
    this.budgetInr,
    this.amountInr,
    this.status = 'pending',
    this.assetCount = 0,
    this.sponsorEmail,
    this.notes,
    required this.createdAt,
  });

  factory AdminSponsorship.fromJson(Map<String, dynamic> json) {
    return AdminSponsorship(
      sponsorshipId: (json['sponsorshipId'] ?? json['id'] ?? '').toString(),
      sponsorName: (json['sponsorName'] ?? json['name'] ?? 'Sponsor').toString(),
      brandName: json['brandName']?.toString(),
      campaignTitle: json['campaignTitle']?.toString(),
      budgetInr: json['budgetInr'] as num?,
      amountInr: (json['amountInr'] ?? json['amount'] ?? json['priceInr']) as num?,
      status: (json['status'] ?? 'pending').toString(),
      assetCount: (json['assetCount'] as num?)?.toInt() ?? 0,
      sponsorEmail: json['sponsorEmail']?.toString(),
      notes: json['notes']?.toString(),
      createdAt: (json['createdAt'] ?? DateTime.now().toIso8601String()).toString(),
    );
  }
}

class AdminSponsorshipsResult {
  final List<AdminSponsorship> items;
  final bool tableMissing;

  AdminSponsorshipsResult({
    required this.items,
    this.tableMissing = false,
  });
}
