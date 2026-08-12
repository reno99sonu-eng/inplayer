/// GET /api/admin/revenue — mirrors app/api/admin/revenue/route.ts.
/// `tableMissing: true` means the revenue ledger/payouts tables haven't
/// been created in AWS yet; `summary`/`creators` are only meaningful when
/// false.
class AdminRevenueResult {
  final bool tableMissing;
  final AdminRevenueSummary? summary;
  final List<AdminRevenueCreator> creators;

  AdminRevenueResult({this.tableMissing = false, this.summary, this.creators = const []});

  factory AdminRevenueResult.fromJson(Map<String, dynamic> json) {
    return AdminRevenueResult(
      tableMissing: json['tableMissing'] == true,
      summary: json['summary'] is Map
          ? AdminRevenueSummary.fromJson(Map<String, dynamic>.from(json['summary'] as Map))
          : null,
      creators: ((json['creators'] as List?) ?? [])
          .whereType<Map>()
          .map((j) => AdminRevenueCreator.fromJson(Map<String, dynamic>.from(j)))
          .toList(),
    );
  }
}

class AdminRevenueSummary {
  final num totalGrossInr;
  final num totalCreatorShareInr;
  final num totalPlatformShareInr;
  final int totalCharges;
  final int activeMemberships;
  final int verifiedCreatorCount;
  final String? payoutWindowLabel;
  final bool payoutWindowOpen;

  AdminRevenueSummary({
    this.totalGrossInr = 0,
    this.totalCreatorShareInr = 0,
    this.totalPlatformShareInr = 0,
    this.totalCharges = 0,
    this.activeMemberships = 0,
    this.verifiedCreatorCount = 0,
    this.payoutWindowLabel,
    this.payoutWindowOpen = false,
  });

  factory AdminRevenueSummary.fromJson(Map<String, dynamic> json) {
    return AdminRevenueSummary(
      totalGrossInr: (json['totalGrossInr'] as num?) ?? 0,
      totalCreatorShareInr: (json['totalCreatorShareInr'] as num?) ?? 0,
      totalPlatformShareInr: (json['totalPlatformShareInr'] as num?) ?? 0,
      totalCharges: (json['totalCharges'] as num?)?.toInt() ?? 0,
      activeMemberships: (json['activeMemberships'] as num?)?.toInt() ?? 0,
      verifiedCreatorCount: (json['verifiedCreatorCount'] as num?)?.toInt() ?? 0,
      payoutWindowLabel: json['payoutWindowLabel'] as String?,
      payoutWindowOpen: json['payoutWindowOpen'] == true,
    );
  }
}

class AdminRevenueCreator {
  final String userId;
  final String? username;
  final String kycStatus;
  final num lifetimeEarnedInr;
  final num lifetimePaidOutInr;
  final num pendingPayoutInr;
  final bool payoutEligible;
  final String? payoutFrequency;
  final String? lastChargeAt;

  AdminRevenueCreator({
    required this.userId,
    this.username,
    this.kycStatus = 'not_started',
    this.lifetimeEarnedInr = 0,
    this.lifetimePaidOutInr = 0,
    this.pendingPayoutInr = 0,
    this.payoutEligible = false,
    this.payoutFrequency,
    this.lastChargeAt,
  });

  factory AdminRevenueCreator.fromJson(Map<String, dynamic> json) {
    return AdminRevenueCreator(
      userId: json['userId']?.toString() ?? '',
      username: json['username'] as String?,
      kycStatus: json['kycStatus']?.toString() ?? 'not_started',
      lifetimeEarnedInr: (json['lifetimeEarnedInr'] as num?) ?? 0,
      lifetimePaidOutInr: (json['lifetimePaidOutInr'] as num?) ?? 0,
      pendingPayoutInr: (json['pendingPayoutInr'] as num?) ?? 0,
      payoutEligible: json['payoutEligible'] == true,
      payoutFrequency: json['payoutFrequency'] as String?,
      lastChargeAt: json['lastChargeAt'] as String?,
    );
  }
}
