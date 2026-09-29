class FilmCreatorApplication {
  final String applicationId;
  final String userId;
  final String channelName;
  final String personalName;
  final String? companyName;
  final String username;
  final String status;
  final String? rejectionReason;
  final String submittedAt;
  final String? reviewedAt;

  FilmCreatorApplication({
    required this.applicationId,
    required this.userId,
    required this.channelName,
    required this.personalName,
    this.companyName,
    required this.username,
    required this.status,
    this.rejectionReason,
    required this.submittedAt,
    this.reviewedAt,
  });

  factory FilmCreatorApplication.fromJson(Map<String, dynamic> json) {
    return FilmCreatorApplication(
      applicationId: json['applicationId'] ?? '',
      userId: json['userId'] ?? '',
      channelName: json['channelName'] ?? '',
      personalName: json['personalName'] ?? '',
      companyName: json['companyName'] as String?,
      username: json['username'] ?? '',
      status: json['status'] ?? 'pending',
      rejectionReason: json['rejectionReason'] as String?,
      submittedAt: json['submittedAt'] ?? '',
      reviewedAt: json['reviewedAt'] as String?,
    );
  }

  bool get isPending => status == 'pending';
  bool get isApproved => status == 'approved';
  bool get isRejected => status == 'rejected';
}
