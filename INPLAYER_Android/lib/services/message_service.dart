import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/conversation.dart';
import '../models/chat_message.dart';

final messageServiceProvider = Provider<MessageService>((ref) {
  return MessageService();
});

class MessageService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// GET /api/messages — my conversation list, split the same way the
  /// backend splits it: `requests` is threads someone ELSE started that
  /// I haven't accepted yet, `conversations` is everything else.
  Future<ConversationsResult> getConversations() async {
    try {
      final response = await _dio.get(ApiConstants.messages);
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final conversations = (data['conversations'] as List? ?? [])
            .whereType<Map>()
            .map((j) => Conversation.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        final requests = (data['requests'] as List? ?? [])
            .whereType<Map>()
            .map((j) => Conversation.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return ConversationsResult(conversations: conversations, requests: requests);
      }
      return ConversationsResult(conversations: [], requests: []);
    } catch (e) {
      _logger.e('Error fetching conversations: $e');
      return ConversationsResult(conversations: [], requests: []);
    }
  }

  /// POST /api/messages — starts a new conversation OR sends the next
  /// message in an existing one; same endpoint either way (see that
  /// route's own comment). Replying to a pending request the OTHER person
  /// started implicitly accepts it server-side — nothing extra to do here.
  Future<SendMessageResult> sendMessage({
    required String otherUserId,
    required String text,
  }) async {
    try {
      final response = await _dio.post(
        ApiConstants.messages,
        data: {'otherUserId': otherUserId, 'text': text},
      );

      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        return SendMessageResult(
          success: data['success'] == true,
          conversationId: data['conversationId'] as String?,
          requestStatus: data['requestStatus'] as String?,
        );
      }

      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return SendMessageResult(success: false, error: error ?? "Couldn't send that message.");
    } catch (e) {
      _logger.e('Error sending message: $e');
      return SendMessageResult(
        success: false,
        error: "Couldn't send that message. Check your connection.",
      );
    }
  }

  /// GET /api/messages/{id} — loads one conversation (also marks it read
  /// as a side effect) plus the other participant's live online status.
  Future<ConversationDetail?> getConversation(String conversationId) async {
    try {
      final response = await _dio.get('${ApiConstants.messages}/$conversationId');
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        if (data['conversation'] is! Map) return null;
        return ConversationDetail(
          conversation: Conversation.fromJson(
            Map<String, dynamic>.from(data['conversation'] as Map),
          ),
          otherIsOnline: data['otherIsOnline'] == true,
          otherLastActiveAt: data['otherLastActiveAt'] as String?,
        );
      }
      return null;
    } catch (e) {
      _logger.e('Error fetching conversation: $e');
      return null;
    }
  }

  /// PATCH /api/messages/{id} — accept/decline a request, block/unblock,
  /// mute/unmute. (Chat wallpaper themes and disappearing-messages timers
  /// also live on this action endpoint but aren't exposed in the app yet.)
  Future<bool> conversationAction(String conversationId, String action) async {
    try {
      final response = await _dio.patch(
        '${ApiConstants.messages}/$conversationId',
        data: {'action': action},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error applying conversation action "$action": $e');
      return false;
    }
  }

  /// GET /api/messages/{id}/messages — the thread's message history. Every
  /// call also records a read receipt and returns whether the other
  /// participant is currently typing, so this one poll (called every few
  /// seconds while a thread is open) covers messages + read receipts +
  /// typing indicator in a single round trip, same as the website does.
  Future<MessagesResult> getMessages(String conversationId) async {
    try {
      final response = await _dio.get('${ApiConstants.messages}/$conversationId/messages');
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final messages = (data['messages'] as List? ?? [])
            .whereType<Map>()
            .map((j) => ChatMessage.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return MessagesResult(
          messages: messages,
          otherLastReadAt: data['otherLastReadAt'] as String?,
          otherIsTyping: data['otherIsTyping'] == true,
        );
      }
      return MessagesResult(messages: []);
    } catch (e) {
      _logger.e('Error fetching messages: $e');
      return MessagesResult(messages: []);
    }
  }

  /// PATCH /api/messages/{id}/messages — WhatsApp-style delete. "delete_for_me"
  /// only hides it from my own view; "delete_for_everyone" is sender-only
  /// and replaces the text with a placeholder for both sides.
  Future<bool> deleteMessage(
    String conversationId,
    String messageId,
    String action, // 'delete_for_me' | 'delete_for_everyone'
  ) async {
    try {
      final response = await _dio.patch(
        '${ApiConstants.messages}/$conversationId/messages',
        data: {'messageId': messageId, 'action': action},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error deleting message: $e');
      return false;
    }
  }

  /// POST /api/messages/{id}/typing — a best-effort "I'm typing" ping,
  /// debounced client-side (see conversation_page.dart). Never worth
  /// surfacing an error for, so failures are swallowed here.
  Future<void> sendTyping(String conversationId) async {
    try {
      await _dio.post('${ApiConstants.messages}/$conversationId/typing');
    } catch (e) {
      _logger.d('Typing ping failed (non-fatal): $e');
    }
  }
}

class ConversationsResult {
  final List<Conversation> conversations;
  final List<Conversation> requests;
  ConversationsResult({required this.conversations, required this.requests});
}

class SendMessageResult {
  final bool success;
  final String? conversationId;
  final String? requestStatus;
  final String? error;
  SendMessageResult({
    required this.success,
    this.conversationId,
    this.requestStatus,
    this.error,
  });
}

class ConversationDetail {
  final Conversation conversation;
  final bool otherIsOnline;
  final String? otherLastActiveAt;
  ConversationDetail({
    required this.conversation,
    required this.otherIsOnline,
    this.otherLastActiveAt,
  });
}

class MessagesResult {
  final List<ChatMessage> messages;
  final String? otherLastReadAt;
  final bool otherIsTyping;
  MessagesResult({required this.messages, this.otherLastReadAt, this.otherIsTyping = false});
}
