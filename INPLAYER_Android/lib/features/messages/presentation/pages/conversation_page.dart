import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/message_service.dart';
import '../../../../models/chat_message.dart';

/// One chat thread. Two modes, driven purely by whether [conversationId]
/// is null:
///  - existing thread (came from the Messages list / a Request): polls
///    real messages every few seconds, same cadence the website's own
///    thread view polls at.
///  - "compose" (came from New Message, no conversation exists yet):
///    nothing to poll until the first real send returns a conversationId
///    from POST /api/messages — from that point on it behaves exactly
///    like an existing thread.
class ConversationPage extends ConsumerStatefulWidget {
  final String? conversationId;
  final String otherUserId;
  final String? otherUsername;
  final String? otherAvatarUrl;

  const ConversationPage({
    super.key,
    this.conversationId,
    required this.otherUserId,
    this.otherUsername,
    this.otherAvatarUrl,
  });

  @override
  ConsumerState<ConversationPage> createState() => _ConversationPageState();
}

class _ConversationPageState extends ConsumerState<ConversationPage> {
  String? _conversationId;
  String? _otherUsername;
  String? _otherAvatarUrl;
  String _requestStatus = 'accepted';
  String _initiatedBy = '';
  bool _blocked = false;
  bool _blockedByOther = false;
  bool _muted = false;
  bool _otherIsOnline = false;
  bool _otherIsTyping = false;

  bool _loadingMeta = true;
  List<ChatMessage> _messages = [];
  bool _sending = false;

  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _pollTimer;
  Timer? _typingDebounce;
  DateTime? _lastTypingPing;

  @override
  void initState() {
    super.initState();
    _conversationId = widget.conversationId;
    _otherUsername = widget.otherUsername;
    _otherAvatarUrl = widget.otherAvatarUrl;
    _loadingMeta = false;

    if (_conversationId != null) {
      _loadMeta();
      _loadMessages();
      _startPolling();
    }

    _inputController.addListener(_onTyping);
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _typingDebounce?.cancel();
    _inputController.removeListener(_onTyping);
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  String? get _myUserId {
    final state = ref.read(authStateProvider);
    return state is AuthStateAuthenticated ? state.user.userId : null;
  }

  void _onTyping() {
    if (_conversationId == null || _inputController.text.trim().isEmpty) return;
    final now = DateTime.now();
    if (_lastTypingPing != null && now.difference(_lastTypingPing!).inSeconds < 2) return;
    _lastTypingPing = now;
    ref.read(messageServiceProvider).sendTyping(_conversationId!);
  }

  Future<void> _loadMeta() async {
    final id = _conversationId;
    if (id == null) return;
    final detail = await ref.read(messageServiceProvider).getConversation(id);
    if (!mounted || detail == null) return;
    setState(() {
      _otherUsername = detail.conversation.otherUsername ?? _otherUsername;
      _otherAvatarUrl = detail.conversation.otherAvatarUrl ?? _otherAvatarUrl;
      _requestStatus = detail.conversation.requestStatus;
      _initiatedBy = detail.conversation.initiatedBy;
      _blocked = detail.conversation.blocked;
      _blockedByOther = detail.conversation.blockedByOther;
      _muted = detail.conversation.muted;
      _otherIsOnline = detail.otherIsOnline;
    });
  }

  Future<void> _loadMessages() async {
    final id = _conversationId;
    if (id == null) return;
    final result = await ref.read(messageServiceProvider).getMessages(id);
    if (!mounted) return;
    final wasAtBottom = _isNearBottom();
    setState(() {
      _messages = result.messages;
      _otherIsTyping = result.otherIsTyping;
    });
    if (wasAtBottom) _scrollToBottom();
  }

  bool _isNearBottom() {
    if (!_scrollController.hasClients) return true;
    return _scrollController.position.maxScrollExtent - _scrollController.position.pixels < 200;
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) => _loadMessages());
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
    );
  }

  Future<void> _send() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);
    _inputController.clear();

    final result = await ref.read(messageServiceProvider).sendMessage(
          otherUserId: widget.otherUserId,
          text: text,
        );

    if (!mounted) return;

    if (!result.success) {
      setState(() => _sending = false);
      _inputController.text = text;
      _showSnack(result.error ?? "Couldn't send that message.");
      return;
    }

    final isFirstSend = _conversationId == null;
    _conversationId = result.conversationId ?? _conversationId;
    if (result.requestStatus != null) _requestStatus = result.requestStatus!;

    if (isFirstSend && _conversationId != null) {
      _startPolling();
    }

    await _loadMessages();
    if (!mounted) return;
    setState(() => _sending = false);
    _scrollToBottom();
  }

  Future<void> _handleMenuAction(String action) async {
    final id = _conversationId;
    if (id == null) return;

    if (action == 'delete_for_me' || action == 'delete_for_everyone') return;

    final ok = await ref.read(messageServiceProvider).conversationAction(id, action);
    if (!mounted) return;
    if (!ok) {
      _showSnack("Couldn't do that. Try again.");
      return;
    }
    setState(() {
      switch (action) {
        case 'block':
          _blocked = true;
          break;
        case 'unblock':
          _blocked = false;
          break;
        case 'mute':
          _muted = true;
          break;
        case 'unmute':
          _muted = false;
          break;
        case 'accept':
          _requestStatus = 'accepted';
          break;
      }
    });
  }

  Future<void> _respondToRequest(bool accept) async {
    final id = _conversationId;
    if (id == null) return;
    final ok = await ref.read(messageServiceProvider).conversationAction(id, accept ? 'accept' : 'decline');
    if (!mounted) return;
    if (accept && ok) {
      setState(() => _requestStatus = 'accepted');
    } else if (!accept && ok) {
      Navigator.of(context).pop();
    } else {
      _showSnack("Couldn't do that. Try again.");
    }
  }

  Future<void> _showMessageOptions(ChatMessage message) async {
    final isMine = message.senderId == _myUserId;
    if (message.deletedForEveryone) return;

    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.cardDark,
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.delete_outline, color: AppColors.textPrimaryDark),
              title: const Text('Delete for me', style: TextStyle(color: AppColors.textPrimaryDark)),
              onTap: () => Navigator.of(context).pop('delete_for_me'),
            ),
            if (isMine)
              ListTile(
                leading: const Icon(Icons.delete_forever, color: AppColors.error),
                title: const Text('Delete for everyone', style: TextStyle(color: AppColors.error)),
                onTap: () => Navigator.of(context).pop('delete_for_everyone'),
              ),
          ],
        ),
      ),
    );

    if (action == null || _conversationId == null) return;
    final ok = await ref
        .read(messageServiceProvider)
        .deleteMessage(_conversationId!, message.messageId, action);
    if (!mounted) return;
    if (ok) {
      _loadMessages();
    } else {
      _showSnack("Couldn't delete that message.");
    }
  }

  @override
  Widget build(BuildContext context) {
    final avatar = _otherAvatarUrl != null ? smartImageProvider(_otherAvatarUrl!) : null;
    final isPendingFromThem = _requestStatus == 'pending' && _initiatedBy == widget.otherUserId;
    final canChat = !_blocked && !_blockedByOther;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        titleSpacing: 0,
        title: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundColor: AppColors.surfaceDark,
              backgroundImage: avatar,
              child: avatar == null ? const Icon(Icons.person, color: AppColors.textSecondaryDark, size: 18) : null,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    _otherUsername ?? 'Chat',
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                  Text(
                    _otherIsTyping ? 'typing...' : (_otherIsOnline ? 'Online' : ''),
                    style: TextStyle(
                      color: _otherIsTyping ? AppColors.brandOrange : AppColors.textSecondaryDark,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          if (_conversationId != null)
            PopupMenuButton<String>(
              icon: const Icon(Icons.more_vert, color: AppColors.textPrimaryDark),
              color: AppColors.cardDark,
              onSelected: _handleMenuAction,
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: _muted ? 'unmute' : 'mute',
                  child: Text(_muted ? 'Unmute' : 'Mute',
                      style: const TextStyle(color: AppColors.textPrimaryDark)),
                ),
                PopupMenuItem(
                  value: _blocked ? 'unblock' : 'block',
                  child: Text(_blocked ? 'Unblock' : 'Block',
                      style: const TextStyle(color: AppColors.error)),
                ),
              ],
            ),
        ],
      ),
      body: _loadingMeta
          ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
          : Column(
              children: [
                if (isPendingFromThem)
                  Container(
                    width: double.infinity,
                    color: AppColors.cardDark,
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      children: [
                        Text(
                          '@${_otherUsername ?? 'this user'} wants to send you a message',
                          textAlign: TextAlign.center,
                          style: const TextStyle(color: AppColors.textPrimaryDark, fontSize: 13),
                        ),
                        const SizedBox(height: 10),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            OutlinedButton(
                              onPressed: () => _respondToRequest(false),
                              child: const Text('Decline'),
                            ),
                            const SizedBox(width: 12),
                            ElevatedButton(
                              onPressed: () => _respondToRequest(true),
                              child: const Text('Accept'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                if (_blockedByOther)
                  Container(
                    width: double.infinity,
                    color: AppColors.cardDark,
                    padding: const EdgeInsets.all(12),
                    child: const Text(
                      "You can't reply to this conversation.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
                    ),
                  ),
                Expanded(
                  child: _messages.isEmpty
                      ? Center(
                          child: Text(
                            'Say hello 👋',
                            style: TextStyle(color: AppColors.textSecondaryDark.withValues(alpha: 0.7)),
                          ),
                        )
                      : ListView.builder(
                          controller: _scrollController,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                          itemCount: _messages.length,
                          itemBuilder: (context, index) => _buildBubble(_messages[index]),
                        ),
                ),
                if (canChat)
                  SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Row(
                        children: [
                          Expanded(
                            child: Container(
                              decoration: BoxDecoration(
                                color: AppColors.cardDark,
                                borderRadius: BorderRadius.circular(24),
                              ),
                              child: TextField(
                                controller: _inputController,
                                minLines: 1,
                                maxLines: 4,
                                style: const TextStyle(color: AppColors.textPrimaryDark),
                                decoration: InputDecoration(
                                  hintText: 'Message...',
                                  hintStyle: TextStyle(color: AppColors.textSecondaryDark.withValues(alpha: 0.6)),
                                  border: InputBorder.none,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          _sending
                              ? const SizedBox(
                                  width: 40,
                                  height: 40,
                                  child: Padding(
                                    padding: EdgeInsets.all(8),
                                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandOrange),
                                  ),
                                )
                              : IconButton(
                                  icon: const Icon(Icons.send, color: AppColors.brandOrange),
                                  onPressed: _send,
                                ),
                        ],
                      ),
                    ),
                  )
                else
                  const SizedBox(height: 8),
              ],
            ),
    );
  }

  Widget _buildBubble(ChatMessage message) {
    final isMine = message.senderId == _myUserId;
    final avatar = !isMine && _otherAvatarUrl != null ? smartImageProvider(_otherAvatarUrl!) : null;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: isMine ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine) ...[
            CircleAvatar(
              radius: 12,
              backgroundColor: AppColors.surfaceDark,
              backgroundImage: avatar,
              child: avatar == null ? const Icon(Icons.person, size: 12, color: AppColors.textSecondaryDark) : null,
            ),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: GestureDetector(
              onLongPress: () => _showMessageOptions(message),
              child: Container(
                constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
                decoration: BoxDecoration(
                  color: isMine ? AppColors.brandOrange : AppColors.cardDark,
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(16),
                    topRight: const Radius.circular(16),
                    bottomLeft: Radius.circular(isMine ? 16 : 4),
                    bottomRight: Radius.circular(isMine ? 4 : 16),
                  ),
                ),
                child: Text(
                  message.deletedForEveryone ? 'This message was deleted.' : message.text,
                  style: TextStyle(
                    color: isMine ? Colors.white : AppColors.textPrimaryDark,
                    fontStyle: message.deletedForEveryone ? FontStyle.italic : FontStyle.normal,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
