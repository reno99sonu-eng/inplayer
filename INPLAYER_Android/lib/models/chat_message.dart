/// One row from GET /api/messages/{conversationId}/messages. Photo
/// attachments use the same inline data URLs as the website client.
class ChatMessage {
  final String messageId;
  final String senderId;
  final String? senderUsername;
  final String text;
  final String createdAt;
  final bool deletedForEveryone;
  final bool isSystem;
  final String? imageUrl;
  final String? audioUrl;
  final int? audioDurationSec;

  ChatMessage({
    required this.messageId,
    required this.senderId,
    this.senderUsername,
    required this.text,
    required this.createdAt,
    this.deletedForEveryone = false,
    this.isSystem = false,
    this.imageUrl,
    this.audioUrl,
    this.audioDurationSec,
  });

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      messageId: json['messageId']?.toString() ?? '',
      senderId: json['senderId']?.toString() ?? '',
      senderUsername: json['senderUsername'] as String?,
      text: json['text']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
      deletedForEveryone: json['deletedForEveryone'] == true,
      isSystem: json['isSystem'] == true,
      imageUrl: json['imageUrl'] as String?,
      audioUrl: json['audioUrl'] as String?,
      audioDurationSec: (json['audioDurationSec'] as num?)?.toInt(),
    );
  }
}
