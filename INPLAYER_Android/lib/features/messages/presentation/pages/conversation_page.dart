import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/message_service.dart';
import '../../../../models/chat_message.dart';

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
      _otherIsOnline = detail.otherIsOnline;
      _loadingMeta = false;
    });
  }

  Future<void> _loadMessages() async {
    final id = _conversationId;
    if (id == null) return;
    final result = await ref.read(messageServiceProvider).getMessages(id);
    if (!mounted) return;
    setState(() {
      _messages = result.messages;
      _otherIsTyping = result.otherIsTyping;
    });
    _scrollToBottom();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) async {
      final id = _conversationId;
      if (id == null) return;
      await _loadMeta();
      final result = await ref.read(messageServiceProvider).getMessages(id);
      if (!mounted) return;
      setState(() {
        _otherIsTyping = result.otherIsTyping;
      });
      if (result.messages.length != _messages.length) {
        setState(() => _messages = result.messages);
        _scrollToBottom();
      }
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _send() async {
    final text = _inputController.text.trim();
    if (text.isEmpty || _sending) return;

    setState(() => _sending = true);

    final res = await ref.read(messageServiceProvider).sendMessage(
          otherUserId: widget.otherUserId,
          text: text,
        );

    if (!mounted) return;

    if (res.success) {
      _inputController.clear();
      final wasCompose = _conversationId == null;
      if (res.conversationId != null) {
        _conversationId = res.conversationId;
      }
      await _loadMessages();
      if (wasCompose && _conversationId != null) {
        _startPolling();
      }
      _scrollToBottom();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(res.error ?? "Couldn't send message."),
          backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        ),
      );
    }

    setState(() => _sending = false);
  }

  Future<void> _respondToRequest(bool accept) async {
    final id = _conversationId;
    if (id == null) return;
    final ok = await ref
        .read(messageServiceProvider)
        .conversationAction(id, accept ? 'accept' : 'decline');
    if (!mounted) return;
    if (ok) {
      setState(() => _requestStatus = accept ? 'accepted' : 'declined');
    }
  }

  Future<void> _handleMenuAction(String action) async {
    final id = _conversationId;
    if (id == null) return;
    final service = ref.read(messageServiceProvider);
    switch (action) {
      case 'mute':
      case 'unmute':
        final next = action == 'mute';
        final ok = await service.conversationAction(id, action);
        if (ok && mounted) setState(() => _muted = next);
        break;
      case 'block':
      case 'unblock':
        final ok = await service.conversationAction(id, action);
        if (ok && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(action == 'block' ? 'User blocked.' : 'User unblocked.'),
              backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
            ),
          );
        }
        break;
    }
  }

  void _showMessageOptions(ChatMessage m) {
    final isMine = m.senderId == _myUserId;
    showModalBottomSheet(
      context: context,
      backgroundColor: context.bgModal,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.delete_outline, color: AppColors.error),
              title: const Text('Delete for me', style: TextStyle(color: AppColors.error)),
              onTap: () async {
                Navigator.of(context).pop();
                if (_conversationId != null) {
                  await ref.read(messageServiceProvider).deleteMessage(
                        _conversationId!,
                        m.messageId,
                        'delete_for_me',
                      );
                  setState(() => _messages = _messages.where((x) => x.messageId != m.messageId).toList());
                }
              },
            ),
            if (isMine)
              ListTile(
                leading: const Icon(Icons.delete_forever, color: AppColors.error),
                title: const Text('Delete for everyone', style: TextStyle(color: AppColors.error)),
                onTap: () async {
                  Navigator.of(context).pop();
                  if (_conversationId != null) {
                    await ref.read(messageServiceProvider).deleteMessage(
                          _conversationId!,
                          m.messageId,
                          'delete_for_everyone',
                        );
                    _loadMessages();
                  }
                },
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final avatar = _otherAvatarUrl != null ? smartImageProvider(_otherAvatarUrl!) : null;
    final isPendingFromThem = _requestStatus == 'pending';
    final canChat = !isPendingFromThem;

    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          titleSpacing: 0,
          title: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                backgroundImage: avatar,
                child: avatar == null
                    ? Icon(Icons.person, size: 18, color: context.textSecondary)
                    : null,
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
                      style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    Text(
                      _otherIsTyping ? 'typing...' : (_otherIsOnline ? 'Online' : ''),
                      style: TextStyle(
                        color: _otherIsTyping ? AppColors.brandOrange : context.textDim,
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
                icon: Icon(Icons.more_vert, color: context.textPrimary),
                color: context.bgModal,
                onSelected: _handleMenuAction,
                itemBuilder: (context) => [
                  PopupMenuItem(
                    value: _muted ? 'unmute' : 'mute',
                    child: Text(_muted ? 'Unmute' : 'Mute',
                        style: TextStyle(color: context.textPrimary)),
                  ),
                  const PopupMenuItem(
                    value: 'block',
                    child: Text('Block', style: TextStyle(color: AppColors.error)),
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
                      color: context.bgCard,
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        children: [
                          Text(
                            '@${_otherUsername ?? 'this user'} wants to send you a message',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: context.textPrimary, fontSize: 13),
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
                  Expanded(
                    child: _messages.isEmpty
                        ? Center(
                            child: Text(
                              'Say hello 👋',
                              style: TextStyle(color: context.textDim),
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
                                  color: context.bgCard,
                                  borderRadius: BorderRadius.circular(24),
                                  border: Border.all(color: context.borderSubtle),
                                ),
                                child: TextField(
                                  controller: _inputController,
                                  minLines: 1,
                                  maxLines: 4,
                                  style: TextStyle(color: context.textPrimary),
                                  decoration: InputDecoration(
                                    hintText: 'Message...',
                                    hintStyle: TextStyle(color: context.textDim),
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
              backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
              backgroundImage: avatar,
              child: avatar == null ? Icon(Icons.person, size: 12, color: context.textSecondary) : null,
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
                  color: isMine ? AppColors.brandOrange : context.bgCard,
                  border: isMine ? null : Border.all(color: context.borderSubtle),
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
                    color: isMine ? Colors.white : context.textPrimary,
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
