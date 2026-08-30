class CreatorPayoutStatus {
  final String kycStatus;
  final String? payoutFrequency;
  final String? legalName;
  final String? submittedAt;
  final int minPayoutAmount;
  final num lifetimeEarnedInr;
  final num lifetimePaidOutInr;
  final String? rejectionReason;

  const CreatorPayoutStatus({
    this.kycStatus = 'not_started',
    this.payoutFrequency,
    this.legalName,
    this.submittedAt,
    this.minPayoutAmount = 500,
    this.lifetimeEarnedInr = 0,
    this.lifetimePaidOutInr = 0,
    this.rejectionReason,
  });

  factory CreatorPayoutStatus.fromJson(Map<String, dynamic> json) {
    return CreatorPayoutStatus(
      kycStatus: (json['kycStatus'] ?? 'not_started').toString(),
      payoutFrequency: json['payoutFrequency']?.toString(),
      legalName: json['legalName']?.toString(),
      submittedAt: json['submittedAt']?.toString(),
      minPayoutAmount: (json['minPayoutAmount'] as num?)?.toInt() ?? 500,
      lifetimeEarnedInr: (json['lifetimeEarnedInr'] as num?) ?? 0,
      lifetimePaidOutInr: (json['lifetimePaidOutInr'] as num?) ?? 0,
      rejectionReason: json['rejectionReason']?.toString(),
    );
  }
}
