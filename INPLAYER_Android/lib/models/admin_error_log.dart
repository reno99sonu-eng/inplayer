/// GET /api/admin/error-logs — automatic crash/error telemetry, separate
/// from user-submitted Bug Reports. Mirrors app/lib/errorLogs.ts's
/// ErrorLogEntry exactly.
class AdminErrorLog {
  final String errorId;
  final String kind; // 'global-error' | 'chunk-error' | 'unknown'
  final String message;
  final String? stack;
  final String? digest;
  final String pathname;
  final String? userAgent;
  final String createdAt;

  AdminErrorLog({
    required this.errorId,
    this.kind = 'unknown',
    required this.message,
    this.stack,
    this.digest,
    this.pathname = '',
    this.userAgent,
    required this.createdAt,
  });

  factory AdminErrorLog.fromJson(Map<String, dynamic> json) {
    return AdminErrorLog(
      errorId: json['errorId']?.toString() ?? '',
      kind: json['kind']?.toString() ?? 'unknown',
      message: json['message']?.toString() ?? '(no message)',
      stack: json['stack'] as String?,
      digest: json['digest'] as String?,
      pathname: json['pathname']?.toString() ?? '',
      userAgent: json['userAgent'] as String?,
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }
}
