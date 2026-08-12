/// One row from GET /api/admin/creators — the creator payout-KYC review
/// queue. Mirrors app/api/admin/creators/route.ts. `documents` is only
/// populated for the pending_review tab (data-URI images); kept as a raw
/// map of docType -> data URI so the UI can render whichever keys exist.
class AdminCreatorKyc {
  final String userId;
  final String? username;
  final String? legalName;
  final String? panNumber;
  final String? idProofType;
  final String? bankAccountNumber;
  final String? bankIfsc;
  final String? city;
  final String? state;
  final String? payoutFrequency;
  final num? minPayoutAmount;
  final String? submittedAt;
  final String? reviewedAt;
  final String? reviewedBy;
  final String? rejectionReason;
  final Map<String, String> documents;

  AdminCreatorKyc({
    required this.userId,
    this.username,
    this.legalName,
    this.panNumber,
    this.idProofType,
    this.bankAccountNumber,
    this.bankIfsc,
    this.city,
    this.state,
    this.payoutFrequency,
    this.minPayoutAmount,
    this.submittedAt,
    this.reviewedAt,
    this.reviewedBy,
    this.rejectionReason,
    this.documents = const {},
  });

  factory AdminCreatorKyc.fromJson(Map<String, dynamic> json) {
    final docsRaw = json['documents'];
    final docs = <String, String>{};
    if (docsRaw is Map) {
      for (final entry in docsRaw.entries) {
        if (entry.value is String) docs[entry.key.toString()] = entry.value as String;
      }
    }
    return AdminCreatorKyc(
      userId: json['userId']?.toString() ?? '',
      username: json['username'] as String?,
      legalName: json['legalName'] as String?,
      panNumber: json['panNumber'] as String?,
      idProofType: json['idProofType'] as String?,
      bankAccountNumber: json['bankAccountNumber'] as String?,
      bankIfsc: json['bankIfsc'] as String?,
      city: json['city'] as String?,
      state: json['state'] as String?,
      payoutFrequency: json['payoutFrequency'] as String?,
      minPayoutAmount: json['minPayoutAmount'] as num?,
      submittedAt: json['submittedAt'] as String?,
      reviewedAt: json['reviewedAt'] as String?,
      reviewedBy: json['reviewedBy'] as String?,
      rejectionReason: json['rejectionReason'] as String?,
      documents: docs,
    );
  }
}
