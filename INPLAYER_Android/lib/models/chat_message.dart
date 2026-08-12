/// One row from GET /api/messages/{conversationId}/messages. Voice notes
/// and photo attachments exist on the backend (audioUrl/imageUrl) but
/// aren't sent by this app yet — text-only for now, see message_service.dart.
class ChatMessage {
  final String messageId;
  final String senderId;
  final String text;
  final String createdAt;
  final bool deletedForEveryone;

  ChatMessage({
    required this.messageId,
    required this.senderId,
    required this.text,
    required this.createdAt,
    this.deletedForEveryone = false,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      messageId: json['messageId']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? '',
      text: json['text']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      deletedForEveryone: json['deletedForEveryone'] == true,
    );
  }
}
