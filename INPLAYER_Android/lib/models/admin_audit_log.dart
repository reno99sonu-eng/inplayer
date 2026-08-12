/// GET /api/admin/audit-logs — mirrors app/api/admin/audit-logs/route.ts.
/// `viewerLocation`/`viewerDevice` let the UI flag any row that doesn't
/// match the viewer's own current device/location as a real "was this
/// actually me?" signal.
class AdminAuditLogResult {
  final List<AdminAuditLogEntry> items;
  final bool tableMissing;
  final String? viewerLocation;
  final String? viewerDevice;

  AdminAuditLogResult({this.items = const [], this.tableMissing = false, this.viewerLocation, this.viewerDevice});

  factory AdminAuditLogResult.fromJson(Map<String, dynamic> json) {
    return AdminAuditLogResult(
      items: ((json['items'] as List?) ?? [])
          .whereType<Map>()
          .map((j) => AdminAuditLogEntry.fromJson(Map<String, dynamic>.from(j)))
          .toList(),
      tableMissing: json['tableMissing'] == true,
      viewerLocation: json['viewerLocation'] as String?,
      viewerDevice: json['viewerDevice'] as String?,
    );
  }
}

class AdminAuditLogEntry {
  final String logId;
  final String createdAt;
  final String adminEmail;
  final String action;
  final String targetType;
  final String? targetId;
  final String? targetLabel;
  final String? details;
  final String? location;
  final String? device;
  final String? ipAddress;

  AdminAuditLogEntry({
    required this.logId,
    required this.createdAt,
    required this.adminEmail,
    required this.action,
    required this.targetType,
    this.targetId,
    this.targetLabel,
    this.details,
    this.location,
    this.device,
    this.ipAddress,
  });

  factory AdminAuditLogEntry.fromJson(Map<String, dynamic> json) {
    return AdminAuditLogEntry(
      logId: json['logId']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      adminEmail: json['adminEmail']?.toString() ?? 'unknown',
      action: json['action']?.toString() ?? '',
      targetType: json['targetType']?.toString() ?? '',
      targetId: json['targetId'] as String?,
      targetLabel: json['targetLabel'] as String?,
      details: json['details'] as String?,
      location: json['location'] as String?,
      device: json['device'] as String?,
      ipAddress: json['ipAddress'] as String?,
    );
  }
}
