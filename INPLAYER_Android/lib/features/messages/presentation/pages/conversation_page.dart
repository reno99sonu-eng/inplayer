import 'dart:async';
import 'dart:convert';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:image/image.dart' as img;
import 'package:image_picker/image_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/message_service.dart';
import '../../../../models/chat_message.dart';
import '../widgets/chat_themes.dart';

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
  String? _initiatedBy;
  bool _muted = false;
  bool _otherIsOnline = false;
  String? _otherLastActiveAt;
  bool _otherIsTyping = false;
  bool _isGroup = false;
  String? _groupName;
  List<String> _memberUserIds = [];
  bool _hasInitialMessagesLoaded = false;

  bool _loadingMeta = true;
  bool _messagesLoading = true;
  bool _processingAttachment = false;
  bool _messageFetchInProgress = false;
  bool _pollInProgress = false;
  String? _messagesError;
  List<ChatMessage> _messages = [];
  bool _sending = false;

  final _inputController = TextEditingController();
  final _scrollController = ScrollController();
  Timer? _pollTimer;
  Timer? _typingDebounce;
  DateTime? _lastTypingPing;

  String? _chatThemeId;

  @override
  void initState() {
    super.initState();
    _conversationId = widget.conversationId;
    _otherUsername = widget.otherUsername;
    _otherAvatarUrl = widget.otherAvatarUrl;
    _isGroup = _conversationId?.startsWith('group_') ?? false;
    _loadingMeta = false;
    _messagesLoading = _conversationId != null;

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
    if (_lastTypingPing != null &&
        now.difference(_lastTypingPing!).inSeconds < 2) {
      return;
    }
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
      _otherIsOnline = detail.otherIsOnline;
      _otherLastActiveAt = detail.otherLastActiveAt;
      _chatThemeId = detail.conversation.chatTheme;
      _isGroup = detail.conversation.isGroup || id.startsWith('group_');
      _groupName = detail.conversation.groupName;
      _memberUserIds = detail.conversation.memberUserIds;
      _loadingMeta = false;
    });
  }

  String _lastSeenLabel() {
    if (_otherIsOnline) return 'Online';
    final raw = _otherLastActiveAt;
    if (raw == null || raw.trim().isEmpty) return '';

    final lastActive = DateTime.tryParse(raw)?.toLocal();
    if (lastActive == null) return '';
    final age = DateTime.now().difference(lastActive);
    if (age.isNegative || age.inSeconds < 60) return 'Last seen just now';
    if (age.inMinutes < 60) return 'Last seen ${age.inMinutes}m ago';
    if (age.inHours < 24) return 'Last seen ${age.inHours}h ago';

    final now = DateTime.now();
    final lastDay = DateTime(lastActive.year, lastActive.month, lastActive.day);
    final today = DateTime(now.year, now.month, now.day);
    final calendarDays = today.difference(lastDay).inDays;
    if (calendarDays == 1) return 'Last seen yesterday';
    return 'Last seen ${lastActive.day}/${lastActive.month}/${lastActive.year}';
  }

  Future<void> _loadMessages() async {
    final id = _conversationId;
    if (id == null || _messageFetchInProgress) return;
    _messageFetchInProgress = true;
    try {
      final result = await ref.read(messageServiceProvider).getMessages(id);
      if (!mounted) return;

      if (!result.success) {
        setState(() {
          _messagesLoading = false;
          _messagesError = result.error ?? "Couldn't load messages.";
        });
        return;
      }

      final messagesChanged = !_sameMessages(_messages, result.messages);

      // Sound notification for new incoming message
      if (_hasInitialMessagesLoaded && messagesChanged && result.messages.isNotEmpty) {
        final lastMsg = result.messages.last;
        if (lastMsg.senderId != _myUserId) {
          SystemSound.play(SystemSoundType.alert);
          HapticFeedback.mediumImpact();
        }
      }
      _hasInitialMessagesLoaded = true;

      setState(() {
        _messagesLoading = false;
        _messagesError = null;
        _otherIsTyping = result.otherIsTyping;
        if (messagesChanged) _messages = result.messages;
      });
      if (messagesChanged) _scrollToBottom();
    } finally {
      _messageFetchInProgress = false;
    }
  }

  bool _sameMessages(List<ChatMessage> current, List<ChatMessage> next) {
    if (current.length != next.length) return false;
    for (var i = 0; i < current.length; i++) {
      final a = current[i];
      final b = next[i];
      if (a.messageId != b.messageId ||
          a.senderId != b.senderId ||
          a.text != b.text ||
          a.imageUrl != b.imageUrl ||
          a.audioUrl != b.audioUrl ||
          a.deletedForEveryone != b.deletedForEveryone) {
        return false;
      }
    }
    return true;
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) async {
      final id = _conversationId;
      if (id == null || _pollInProgress || _messageFetchInProgress) return;
      _pollInProgress = true;
      try {
        await _loadMeta();
        await _loadMessages();
      } finally {
        _pollInProgress = false;
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

  void _openImageViewer(String imageUrl) {
    showDialog(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.95),
      builder: (ctx) => Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          elevation: 0,
          leading: IconButton(
            icon: const Icon(Icons.close, color: Colors.white, size: 28),
            onPressed: () => Navigator.of(ctx).pop(),
          ),
        ),
        body: Center(
          child: InteractiveViewer(
            panEnabled: true,
            minScale: 0.8,
            maxScale: 4.0,
            child: SafeAppImage(
              imageUrl: imageUrl,
              fit: BoxFit.contain,
              placeholder: (context, url) => const Center(
                child: CircularProgressIndicator(color: AppColors.brandOrange),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _send({String? text, String? imageUrl}) async {
    final textToSend = text ?? _inputController.text.trim();
    if ((textToSend.isEmpty && imageUrl == null) ||
        _sending ||
        _processingAttachment) {
      return;
    }

    if (text == null) _inputController.clear();

    final tempId = 'temp_${DateTime.now().millisecondsSinceEpoch}';
    final optimisticMsg = ChatMessage(
      messageId: tempId,
      senderId: _myUserId ?? '',
      senderUsername: 'You',
      text: textToSend,
      imageUrl: imageUrl,
      createdAt: DateTime.now().toIso8601String(),
    );

    setState(() {
      _sending = true;
      _messages = [..._messages, optimisticMsg];
    });
    _scrollToBottom();

    // Instant send sound + haptic feedback
    SystemSound.play(SystemSoundType.click);
    HapticFeedback.lightImpact();

    try {
      final res = await ref
          .read(messageServiceProvider)
          .sendMessage(
            conversationId: _conversationId,
            otherUserId: widget.otherUserId.isNotEmpty ? widget.otherUserId : null,
            text: textToSend.isEmpty ? null : textToSend,
            imageUrl: imageUrl,
          );

      if (!mounted) return;
      if (res.success) {
        final wasCompose = _conversationId == null;
        if (res.conversationId != null) {
          _conversationId = res.conversationId;
        }
        if (wasCompose) _initiatedBy = _myUserId;
        final newReqStatus = res.requestStatus;
        if (newReqStatus != null) _requestStatus = newReqStatus;

        if (res.flagged) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'This message was held for review and was not delivered.',
              ),
            ),
          );
        } else {
          await _loadMessages();
        }
        if (wasCompose && _conversationId != null) _startPolling();
        _scrollToBottom();
      } else {
        setState(() {
          _messages = _messages.where((m) => m.messageId != tempId).toList();
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(res.error ?? "Couldn't send message."),
            backgroundColor: context.isDark
                ? AppColors.surfaceDark
                : AppColors.surfaceLight,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _messages = _messages.where((m) => m.messageId != tempId).toList();
        });
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  Future<void> _pickAndSendImage() async {
    if (_sending || _processingAttachment) return;
    setState(() => _processingAttachment = true);
    try {
      final file = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
        maxWidth: 1600,
      );
      if (file == null || !mounted) return;

      final imageUrl = await _prepareMessageImage(file);
      if (!mounted) return;
      setState(() => _processingAttachment = false);
      // Let _send own the sending state. Previously this method set
      // `_sending` first, then called `_send`, whose busy guard immediately
      // returned, so the picker appeared to succeed while no photo was sent.
      await _send(imageUrl: imageUrl);
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text("Couldn't attach that photo: $e")));
    } finally {
      if (mounted) setState(() => _processingAttachment = false);
    }
  }

  Future<String> _prepareMessageImage(XFile file) async {
    const maxDataUrlLength = 280000; // backend accepts up to 300,000 chars.
    final sourceBytes = await file.readAsBytes();
    if (sourceBytes.isEmpty) throw StateError('The selected photo is empty.');

    final mime = _imageMimeType(sourceBytes);
    final originalDataUrl = 'data:$mime;base64,${base64Encode(sourceBytes)}';
    if (originalDataUrl.length <= maxDataUrlLength) return originalDataUrl;

    final decoded = img.decodeImage(sourceBytes);
    if (decoded == null) {
      throw StateError(
        'This photo format could not be compressed. Choose a JPEG or PNG image.',
      );
    }
    final oriented = img.bakeOrientation(decoded);
    for (final width in [1280, 1024, 800, 640, 480]) {
      final resized = oriented.width > width
          ? img.copyResize(oriented, width: width)
          : oriented;
      for (final quality in [85, 75, 65, 55, 45, 35]) {
        final encoded = img.encodeJpg(resized, quality: quality);
        final dataUrl = 'data:image/jpeg;base64,${base64Encode(encoded)}';
        if (dataUrl.length <= maxDataUrlLength) return dataUrl;
      }
    }
    throw StateError(
      'That photo is too large to attach. Choose a smaller image.',
    );
  }

  String _imageMimeType(List<int> bytes) {
    if (bytes.length >= 8 &&
        bytes[0] == 0x89 &&
        bytes[1] == 0x50 &&
        bytes[2] == 0x4E &&
        bytes[3] == 0x47) {
      return 'image/png';
    }
    if (bytes.length >= 12 &&
        bytes[0] == 0x52 &&
        bytes[1] == 0x49 &&
        bytes[2] == 0x46 &&
        bytes[3] == 0x46 &&
        bytes[8] == 0x57 &&
        bytes[9] == 0x45 &&
        bytes[10] == 0x42 &&
        bytes[11] == 0x50) {
      return 'image/webp';
    }
    return 'image/jpeg';
  }

  Future<void> _respondToRequest(bool accept) async {
    final id = _conversationId;
    if (id == null) return;
    final ok = await ref
        .read(messageServiceProvider)
        .conversationAction(id, accept ? 'accept' : 'decline');
    if (!mounted) return;
    if (ok) {
      if (accept) {
        setState(() => _requestStatus = 'accepted');
      } else {
        Navigator.of(context).pop();
      }
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "Couldn't ${accept ? 'accept' : 'decline'} that request. Try again.",
          ),
        ),
      );
    }
  }

  void _showProfileDrawer() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.bgModal,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.7,
          minChildSize: 0.5,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return ListView(
              controller: scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 24),
                    decoration: BoxDecoration(
                      color: context.borderSubtle,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Center(
                  child: CircleAvatar(
                    radius: 40,
                    backgroundColor: context.isDark
                        ? AppColors.surfaceDark
                        : AppColors.surfaceLight,
                    backgroundImage: _otherAvatarUrl != null
                        ? smartImageProvider(_otherAvatarUrl!)
                        : null,
                    child: _otherAvatarUrl == null
                        ? Icon(
                            Icons.person,
                            size: 40,
                            color: context.textSecondary,
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 16),
                Center(
                  child: Text(
                    _otherUsername ?? 'User',
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                Text(
                  'CHAT SETTINGS',
                  style: TextStyle(
                    color: context.textSecondary,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    'Chat Theme',
                    style: TextStyle(color: context.textPrimary),
                  ),
                  trailing: Text(
                    AppChatThemes.themes[_chatThemeId ?? 'default']?.name ??
                        'Default',
                    style: TextStyle(color: context.textSecondary),
                  ),
                  onTap: () {
                    Navigator.pop(context);
                    _showThemeSelector();
                  },
                ),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: Text(
                    'Mute Notifications',
                    style: TextStyle(color: context.textPrimary),
                  ),
                  activeThumbColor: AppColors.brandOrange,
                  value: _muted,
                  onChanged: (val) {
                    _handleMenuAction(val ? 'mute' : 'unmute');
                    Navigator.pop(context);
                  },
                ),
                const SizedBox(height: 32),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text(
                    'Block User',
                    style: TextStyle(color: AppColors.error),
                  ),
                  onTap: () {
                    _handleMenuAction('block');
                    Navigator.pop(context);
                    Navigator.pop(
                      context,
                    ); // go back to messages list after blocking
                  },
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showThemeSelector() {
    showModalBottomSheet(
      context: context,
      backgroundColor: context.bgModal,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.6,
          minChildSize: 0.5,
          maxChildSize: 0.9,
          expand: false,
          builder: (context, scrollController) {
            return ListView.builder(
              controller: scrollController,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              itemCount: AppChatThemes.themes.length + 1,
              itemBuilder: (context, index) {
                if (index == 0) {
                  return const Padding(
                    padding: EdgeInsets.only(bottom: 16),
                    child: Text(
                      'SELECT THEME',
                      style: TextStyle(
                        color: Colors.grey,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  );
                }
                final theme = AppChatThemes.themes.values.elementAt(index - 1);
                final isSelected = (_chatThemeId ?? 'default') == theme.id;
                return ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: CircleAvatar(
                    backgroundColor: theme.bgColor,
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: theme.bubbleMineBgColor,
                          width: 2,
                        ),
                      ),
                    ),
                  ),
                  title: Text(
                    theme.name,
                    style: TextStyle(
                      color: context.textPrimary,
                      fontWeight: isSelected
                          ? FontWeight.bold
                          : FontWeight.normal,
                    ),
                  ),
                  trailing: isSelected
                      ? const Icon(Icons.check, color: AppColors.brandOrange)
                      : null,
                  onTap: () {
                    _setTheme(theme.id);
                    Navigator.pop(context);
                  },
                );
              },
            );
          },
        );
      },
    );
  }

  Future<void> _setTheme(String themeId) async {
    final id = _conversationId;
    if (id == null) return;

    // Optimistic update
    setState(() {
      _chatThemeId = themeId;
    });

    final ok = await ref
        .read(messageServiceProvider)
        .conversationAction(id, 'set_theme', theme: themeId);
    if (!ok && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text("Failed to update theme")));
      _loadMeta(); // revert
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
              content: Text(
                action == 'block' ? 'User blocked.' : 'User unblocked.',
              ),
              backgroundColor: context.isDark
                  ? AppColors.surfaceDark
                  : AppColors.surfaceLight,
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
              title: const Text(
                'Delete for me',
                style: TextStyle(color: AppColors.error),
              ),
              onTap: () async {
                Navigator.of(context).pop();
                if (_conversationId != null) {
                  await ref
                      .read(messageServiceProvider)
                      .deleteMessage(
                        _conversationId!,
                        m.messageId,
                        'delete_for_me',
                      );
                  setState(
                    () => _messages = _messages
                        .where((x) => x.messageId != m.messageId)
                        .toList(),
                  );
                }
              },
            ),
            if (isMine)
              ListTile(
                leading: const Icon(
                  Icons.delete_forever,
                  color: AppColors.error,
                ),
                title: const Text(
                  'Delete for everyone',
                  style: TextStyle(color: AppColors.error),
                ),
                onTap: () async {
                  Navigator.of(context).pop();
                  if (_conversationId != null) {
                    await ref
                        .read(messageServiceProvider)
                        .deleteMessage(
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
    final avatar = _otherAvatarUrl != null
        ? smartImageProvider(_otherAvatarUrl!)
        : null;
    final isPendingFromThem =
        _requestStatus == 'pending' && _initiatedBy != _myUserId;
    final canChat = !isPendingFromThem;

    final currentTheme =
        AppChatThemes.themes[_chatThemeId ?? 'default'] ??
        AppChatThemes.themes['default']!;

    return Stack(
      children: [
        Container(color: currentTheme.bgColor),
        Opacity(
          opacity: currentTheme.isLight ? 0.1 : 0.15,
          child: CachedNetworkImage(
            imageUrl: currentTheme.backgroundImageUrl,
            fit: BoxFit.cover,
            width: double.infinity,
            height: double.infinity,
          ),
        ),
        Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: currentTheme.bgColor.withValues(alpha: 0.95),
            elevation: 0,
            iconTheme: IconThemeData(color: currentTheme.textColor),
            titleSpacing: 0,
            title: GestureDetector(
              onTap: _showProfileDrawer,
              behavior: HitTestBehavior.opaque,
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 18,
                    backgroundColor: context.isDark
                        ? AppColors.surfaceDark
                        : AppColors.surfaceLight,
                    backgroundImage: _isGroup ? null : avatar,
                    child: _isGroup
                        ? const Icon(
                            Icons.group,
                            size: 20,
                            color: AppColors.brandOrange,
                          )
                        : (avatar == null
                            ? Icon(
                                Icons.person,
                                size: 18,
                                color: context.textSecondary,
                              )
                            : null),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _isGroup
                              ? (_groupName ?? _otherUsername ?? 'Group Chat')
                              : (_otherUsername ?? 'Chat'),
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: currentTheme.textColor,
                            fontWeight: FontWeight.bold,
                            fontSize: 15,
                          ),
                        ),
                        Text(
                          _isGroup
                              ? (_memberUserIds.isNotEmpty
                                  ? '${_memberUserIds.length} members'
                                  : 'Group')
                              : (_otherIsTyping ? 'typing...' : _lastSeenLabel()),
                          style: TextStyle(
                            color: _otherIsTyping
                                ? AppColors.brandOrange
                                : currentTheme.textColor.withValues(alpha: 0.6),
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            actions: [
              if (_conversationId != null)
                IconButton(
                  icon: Icon(Icons.more_vert, color: currentTheme.textColor),
                  onPressed: _showProfileDrawer,
                ),
            ],
          ),
          body: _loadingMeta
              ? const Center(
                  child: CircularProgressIndicator(
                    color: AppColors.brandOrange,
                  ),
                )
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
                              _isGroup
                                  ? 'You were invited to join "${_groupName ?? _otherUsername ?? 'this group'}"'
                                  : '@${_otherUsername ?? 'this user'} wants to send you a message',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: context.textPrimary,
                                fontSize: 13,
                              ),
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
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppColors.brandOrange,
                                    foregroundColor: Colors.white,
                                  ),
                                  child: const Text('Accept'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    Expanded(
                      child: _messagesLoading && _messages.isEmpty
                          ? const Center(
                              child: CircularProgressIndicator(
                                color: AppColors.brandOrange,
                              ),
                            )
                          : _messagesError != null && _messages.isEmpty
                          ? Center(
                              child: Padding(
                                padding: const EdgeInsets.all(24),
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      _messagesError!,
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        color: context.textSecondary,
                                      ),
                                    ),
                                    const SizedBox(height: 12),
                                    OutlinedButton.icon(
                                      onPressed: _loadMessages,
                                      icon: const Icon(Icons.refresh),
                                      label: const Text('Try again'),
                                    ),
                                  ],
                                ),
                              ),
                            )
                          : _messages.isEmpty
                          ? Center(
                              child: Text(
                                'Say hello 👋',
                                style: TextStyle(color: context.textDim),
                              ),
                            )
                          : ListView.builder(
                              controller: _scrollController,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 12,
                              ),
                              itemCount: _messages.length,
                              itemBuilder: (context, index) =>
                                  _buildBubble(_messages[index], currentTheme),
                            ),
                    ),
                    if (canChat)
                      SafeArea(
                        top: false,
                        child: Padding(
                          padding: const EdgeInsets.all(10),
                          child: Row(
                            children: [
                              IconButton(
                                icon: Icon(
                                  Icons.attach_file,
                                  color: currentTheme.textColor.withValues(
                                    alpha: 0.6,
                                  ),
                                ),
                                onPressed: _sending || _processingAttachment
                                    ? null
                                    : _pickAndSendImage,
                              ),
                              Expanded(
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: currentTheme.bgColor.withValues(
                                      alpha: 0.9,
                                    ),
                                    borderRadius: BorderRadius.circular(24),
                                    border: Border.all(
                                      color: currentTheme.textColor.withValues(
                                        alpha: 0.2,
                                      ),
                                    ),
                                  ),
                                  child: TextField(
                                    controller: _inputController,
                                    enabled: !_processingAttachment,
                                    minLines: 1,
                                    maxLines: 4,
                                    style: TextStyle(
                                      color: currentTheme.textColor,
                                    ),
                                    decoration: InputDecoration(
                                      hintText: 'Message...',
                                      hintStyle: TextStyle(
                                        color: currentTheme.textColor
                                            .withValues(alpha: 0.5),
                                      ),
                                      border: InputBorder.none,
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                            horizontal: 16,
                                            vertical: 10,
                                          ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              CircleAvatar(
                                radius: 20,
                                backgroundColor: AppColors.brandOrange,
                                child: IconButton(
                                  icon: _sending || _processingAttachment
                                      ? const SizedBox(
                                          width: 16,
                                          height: 16,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Icon(
                                          Icons.send,
                                          color: Colors.white,
                                          size: 18,
                                        ),
                                  onPressed: _sending || _processingAttachment
                                      ? null
                                      : _send,
                                ),
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
      ],
    );
  }

  Widget _buildBubble(ChatMessage message, ChatTheme theme) {
    if (message.isSystem) {
      return Center(
        child: Container(
          margin: const EdgeInsets.symmetric(vertical: 8),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            color: theme.textColor.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Text(
            message.text,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 12,
              color: theme.textColor.withValues(alpha: 0.7),
            ),
          ),
        ),
      );
    }

    final isMine = message.senderId == _myUserId;
    final avatar = !isMine && _otherAvatarUrl != null
        ? smartImageProvider(_otherAvatarUrl!)
        : null;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: isMine
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isMine) ...[
            CircleAvatar(
              radius: 12,
              backgroundColor: context.isDark
                  ? AppColors.surfaceDark
                  : AppColors.surfaceLight,
              backgroundImage: avatar,
              child: avatar == null
                  ? Icon(Icons.person, size: 12, color: context.textSecondary)
                  : null,
            ),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: GestureDetector(
              onLongPress: () => _showMessageOptions(message),
              child: Container(
                constraints: BoxConstraints(
                  maxWidth: MediaQuery.of(context).size.width * 0.72,
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 14,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  color: isMine
                      ? theme.bubbleMineBgColor
                      : theme.bubbleOtherBgColor,
                  border: isMine
                      ? null
                      : Border.all(
                          color: theme.textColor.withValues(alpha: 0.1),
                        ),
                  borderRadius: BorderRadius.only(
                    topLeft: const Radius.circular(16),
                    topRight: const Radius.circular(16),
                    bottomLeft: Radius.circular(isMine ? 16 : 4),
                    bottomRight: Radius.circular(isMine ? 4 : 16),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: isMine
                      ? CrossAxisAlignment.end
                      : CrossAxisAlignment.start,
                  children: [
                    if (_isGroup &&
                        !isMine &&
                        message.senderUsername != null &&
                        message.senderUsername!.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 4),
                        child: Text(
                          message.senderUsername!.startsWith('@')
                              ? message.senderUsername!
                              : '@${message.senderUsername}',
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: AppColors.brandOrange,
                          ),
                        ),
                      ),
                    if (!message.deletedForEveryone && message.imageUrl != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: GestureDetector(
                          onTap: () => _openImageViewer(message.imageUrl!),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Stack(
                              children: [
                                SafeAppImage(
                                  imageUrl: message.imageUrl!,
                                  width: 200,
                                  height: 260,
                                  fit: BoxFit.cover,
                                  placeholder: (context, url) => Container(
                                    width: 200,
                                    height: 150,
                                    color: theme.textColor.withValues(alpha: 0.1),
                                    child: const Center(
                                      child: CircularProgressIndicator(),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  bottom: 6,
                                  right: 6,
                                  child: Container(
                                    padding: const EdgeInsets.all(4),
                                    decoration: BoxDecoration(
                                      color: Colors.black54,
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Icon(
                                      Icons.fullscreen,
                                      color: Colors.white,
                                      size: 16,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    if (!message.deletedForEveryone && message.audioUrl != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.mic,
                              color: isMine
                                  ? theme.bubbleMineTextColor
                                  : theme.bubbleOtherTextColor,
                              size: 20,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'Voice message',
                              style: TextStyle(
                                color: isMine
                                    ? theme.bubbleMineTextColor
                                    : theme.bubbleOtherTextColor,
                                fontStyle: FontStyle.italic,
                              ),
                            ),
                          ],
                        ),
                      ),
                    if (message.deletedForEveryone || message.text.isNotEmpty)
                      Text(
                        message.deletedForEveryone
                            ? 'This message was deleted.'
                            : message.text,
                        style: TextStyle(
                          color: isMine
                              ? theme.bubbleMineTextColor
                              : theme.bubbleOtherTextColor,
                          fontStyle: message.deletedForEveryone
                              ? FontStyle.italic
                              : FontStyle.normal,
                          fontSize: 14,
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
