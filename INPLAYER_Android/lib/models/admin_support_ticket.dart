/// Model representing an AI Support Desk ticket in the admin panel.
class AdminSupportTicket {
  final String ticketId;
  final String domain; // 'inplayer' | 'hammart'
  final String? userId;
  final String? userName;
  final String? userEmail;
  final String status; // 'open' | 'in_progress' | 'ai_resolved' | 'resolved' | 'abandoned'
  final String query;
  final String? aiResponse;
  final String? adminNotes;
  final String createdAt;
  final String? updatedAt;

  AdminSupportTicket({
    required this.ticketId,
    this.domain = 'inplayer',
    this.userId,
    this.userName,
    this.userEmail,
    this.status = 'open',
    required this.query,
    this.aiResponse,
    this.adminNotes,
    required this.createdAt,
    this.updatedAt,
  });

  factory AdminSupportTicket.fromJson(Map<String, dynamic> json) {
    return AdminSupportTicket(
      ticketId: (json['ticketId'] ?? '').toString(),
      domain: (json['domain'] ?? 'inplayer').toString(),
      userId: json['userId']?.toString(),
      userName: json['userName']?.toString(),
      userEmail: json['userEmail']?.toString(),
      status: (json['status'] ?? 'open').toString(),
      query: (json['query'] ?? json['subject'] ?? json['message'] ?? '').toString(),
      aiResponse: json['aiResponse']?.toString(),
      adminNotes: json['adminNotes']?.toString(),
      createdAt: (json['createdAt'] ?? DateTime.now().toIso8601String()).toString(),
      updatedAt: json['updatedAt']?.toString(),
    );
  }
}

class AdminSupportResult {
  final List<AdminSupportTicket> tickets;
  final Map<String, int> counts;
  final bool tableMissing;

  AdminSupportResult({
    required this.tickets,
    this.counts = const {},
    this.tableMissing = false,
  });
}
