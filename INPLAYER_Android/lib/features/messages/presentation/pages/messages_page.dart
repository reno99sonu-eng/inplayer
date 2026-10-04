import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/message_service.dart';
import '../../../../services/channel_service.dart';
import '../../../../models/conversation.dart';
import '../../../../models/channel.dart';

class MessagesPage extends ConsumerStatefulWidget {
  const MessagesPage({super.key});

  @override
  ConsumerState<MessagesPage> createState() => _MessagesPageState();
}

class _MessagesPageState extends ConsumerState<MessagesPage> {
  bool _loading = true;
  bool _searchOpen = false;
  bool _showRequests = false;
  String? _loadError;
  String? _respondingId;
  List<Conversation> _conversations = [];
  List<Conversation> _requests = [];
  final _searchController = TextEditingController();
  bool _loadInProgress = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool showLoader = false}) async {
    if (_loadInProgress) return;
    _loadInProgress = true;
    if (showLoader && mounted) setState(() => _loading = true);

    final result = await ref.read(messageServiceProvider).getConversations();
    if (mounted) {
      setState(() {
        _loading = false;
        _loadError = result.success
            ? null
            : result.error ?? "Couldn't load your chats.";
        if (result.success) {
          _conversations = result.conversations;
          _requests = result.requests;
        }
      });
    }
    _loadInProgress = false;
  }

  Future<void> _openConversation(Conversation c) async {
    await context.push(
      '/messages/${c.conversationId}',
      extra: {
        'otherUserId': c.otherUserId,
        'otherUsername': c.isGroup ? (c.groupName ?? c.otherUsername) : c.otherUsername,
        'otherAvatarUrl': c.otherAvatarUrl,
      },
    );
    if (mounted) _load();
  }

  void _showCreateGroupModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.bgModal,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => _CreateGroupSheet(
        onCreated: (convId, groupName) {
          Navigator.of(ctx).pop();
          _load();
          context.push(
            '/messages/$convId',
            extra: {
              'otherUserId': '',
              'otherUsername': groupName,
            },
          );
        },
      ),
    );
  }

  Future<void> _respondToRequest(Conversation conversation, bool accept) async {
    if (_respondingId != null) return;
    setState(() => _respondingId = conversation.conversationId);
    final ok = await ref
        .read(messageServiceProvider)
        .conversationAction(
          conversation.conversationId,
          accept ? 'accept' : 'decline',
        );
    if (!mounted) return;

    if (ok) {
      setState(() {
        _requests = _requests
            .where((item) => item.conversationId != conversation.conversationId)
            .toList();
        if (accept) {
          _conversations = [
            conversation.copyWith(requestStatus: 'accepted', unreadCount: 0),
            ..._conversations.where(
              (item) => item.conversationId != conversation.conversationId,
            ),
          ];
        }
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            "Couldn't ${accept ? 'accept' : 'decline'} that request. Try again.",
          ),
        ),
      );
    }
    setState(() => _respondingId = null);
  }

  void _toggleSearch() {
    setState(() {
      _searchOpen = !_searchOpen;
      _searchController.clear();
    });
  }

  List<Conversation> _filteredItems() {
    final items = _showRequests ? _requests : _conversations;
    final query = _searchController.text.trim().toLowerCase();
    if (query.isEmpty) return items;
    return items.where((conversation) {
      return [
        conversation.otherUsername,
        conversation.lastMessageText,
        conversation.otherUserId,
      ].whereType<String>().any((value) => value.toLowerCase().contains(query));
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final items = _filteredItems();

    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: _searchOpen
              ? TextField(
                  controller: _searchController,
                  autofocus: true,
                  onChanged: (_) => setState(() {}),
                  style: TextStyle(color: context.textPrimary, fontSize: 16),
                  decoration: InputDecoration(
                    hintText: 'Search chats...',
                    hintStyle: TextStyle(color: context.textDim, fontSize: 15),
                    border: InputBorder.none,
                  ),
                )
              : Text(
                  'MilonBook',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    color: context.textPrimary,
                    letterSpacing: -0.5,
                  ),
                ),
          actions: [
            IconButton(
              tooltip: _searchOpen ? 'Close chat search' : 'Search chats',
              icon: Icon(
                _searchOpen ? Icons.close : Icons.search,
                color: context.textPrimary,
              ),
              onPressed: _toggleSearch,
            ),
            IconButton(
              tooltip: 'Create group',
              icon: Icon(Icons.group_add_outlined, color: context.textPrimary),
              onPressed: _showCreateGroupModal,
            ),
            IconButton(
              tooltip: 'New message',
              icon: Icon(Icons.edit_outlined, color: context.textPrimary),
              onPressed: () async {
                await context.push('/messages/new');
                if (mounted) _load();
              },
            ),
          ],
        ),
        body: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.brandOrange),
              )
            : Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: Column(
                    children: [
                      _buildTabs(),
                      Expanded(
                        child: _loadError != null
                            ? _buildLoadError()
                            : _buildList(items),
                      ),
                    ],
                  ),
                ),
              ),
      ),
    );
  }

  Widget _buildTabs() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
      child: Row(
        children: [
          Expanded(child: _tabButton('Chats', selected: !_showRequests)),
          const SizedBox(width: 10),
          Expanded(
            child: _tabButton(
              'Requests',
              selected: _showRequests,
              count: _requests.length,
            ),
          ),
        ],
      ),
    );
  }

  Widget _tabButton(String label, {required bool selected, int count = 0}) {
    return OutlinedButton(
      onPressed: () => setState(() => _showRequests = label == 'Requests'),
      style: OutlinedButton.styleFrom(
        backgroundColor: selected
            ? AppColors.brandOrange.withValues(alpha: 0.14)
            : Colors.transparent,
        side: BorderSide(
          color: selected ? AppColors.brandOrange : context.borderSubtle,
        ),
        foregroundColor: selected
            ? AppColors.brandOrange
            : context.textSecondary,
        shape: const StadiumBorder(),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
          if (count > 0) ...[
            const SizedBox(width: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.brandOrange,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$count',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLoadError() {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [
        SizedBox(
          height: MediaQuery.of(context).size.height * 0.55,
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.cloud_off_outlined,
                    size: 44,
                    color: context.textDim,
                  ),
                  const SizedBox(height: 14),
                  Text(
                    _loadError!,
                    textAlign: TextAlign.center,
                    style: TextStyle(color: context.textSecondary),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: () => _load(showLoader: true),
                    icon: const Icon(Icons.refresh),
                    label: const Text('Try again'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildList(List<Conversation> items) {
    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: context.bgCard,
      onRefresh: _load,
      child: items.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: [
                SizedBox(
                  height: MediaQuery.of(context).size.height * 0.55,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _searchController.text.isNotEmpty
                              ? Icons.search_off
                              : _showRequests
                              ? Icons.inbox_outlined
                              : Icons.chat_bubble_outline,
                          size: 48,
                          color: context.textDim,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          _searchController.text.isNotEmpty
                              ? 'No chats match that search'
                              : _showRequests
                              ? 'No message requests'
                              : 'No messages yet',
                          style: TextStyle(color: context.textSecondary),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _searchController.text.isNotEmpty
                              ? 'Try another name or message.'
                              : _showRequests
                              ? 'Requests from people you are not connected with appear here.'
                              : 'Tap the pencil to start a conversation',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: context.textDim,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            )
          : ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              itemCount: items.length,
              separatorBuilder: (context, index) =>
                  Divider(height: 1, color: context.borderSubtle),
              itemBuilder: (context, index) =>
                  _buildConversationTile(items[index]),
            ),
    );
  }

  Widget _buildConversationTile(Conversation conversation) {
    final avatar = conversation.otherAvatarUrl != null
        ? smartImageProvider(conversation.otherAvatarUrl!)
        : null;
    final unread = conversation.unreadCount > 0;
    final isRequest = _showRequests;
    final isResponding = _respondingId == conversation.conversationId;

    return ListTile(
      onTap: () => _openConversation(conversation),
      tileColor: unread ? AppColors.brandOrange.withValues(alpha: 0.08) : null,
      leading: CircleAvatar(
        radius: 22,
        backgroundColor: context.isDark
            ? AppColors.surfaceDark
            : AppColors.surfaceLight,
        backgroundImage: conversation.isGroup ? null : avatar,
        child: conversation.isGroup
            ? const Icon(Icons.group, color: AppColors.brandOrange)
            : (avatar == null
                ? Icon(Icons.person, color: context.textSecondary)
                : null),
      ),
      title: Row(
        children: [
          if (conversation.isGroup) ...[
            const Icon(Icons.group, size: 14, color: AppColors.brandOrange),
            const SizedBox(width: 4),
          ],
          Expanded(
            child: Text(
              conversation.isGroup
                  ? (conversation.groupName ?? conversation.otherUsername ?? 'Group Chat')
                  : (conversation.otherUsername ?? 'Unknown'),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: context.textPrimary,
                fontWeight: unread ? FontWeight.bold : FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
      subtitle: Text(
        conversation.lastMessageText.isEmpty
            ? 'Say hello 👋'
            : conversation.lastMessageText,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: TextStyle(
          color: unread ? context.textPrimary : context.textSecondary,
          fontWeight: unread ? FontWeight.w600 : FontWeight.normal,
        ),
      ),
      trailing: isRequest
          ? SizedBox(
              width: 88,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  IconButton(
                    tooltip: 'Accept request',
                    visualDensity: VisualDensity.compact,
                    onPressed: isResponding
                        ? null
                        : () => _respondToRequest(conversation, true),
                    icon: isResponding
                        ? const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.check_circle_outline),
                    color: AppColors.success,
                  ),
                  IconButton(
                    tooltip: 'Decline request',
                    visualDensity: VisualDensity.compact,
                    onPressed: isResponding
                        ? null
                        : () => _respondToRequest(conversation, false),
                    icon: const Icon(Icons.cancel_outlined),
                    color: AppColors.error,
                  ),
                ],
              ),
            )
          : SizedBox(
              width: 74,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    formatTimeAgo(conversation.lastMessageAt),
                    maxLines: 1,
                    style: TextStyle(color: context.textDim, fontSize: 11),
                  ),
                  if (unread) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.brandOrange,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${conversation.unreadCount}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
    );
  }
}

class _CreateGroupSheet extends ConsumerStatefulWidget {
  final void Function(String conversationId, String groupName) onCreated;
  const _CreateGroupSheet({required this.onCreated});

  @override
  ConsumerState<_CreateGroupSheet> createState() => _CreateGroupSheetState();
}

class _CreateGroupSheetState extends ConsumerState<_CreateGroupSheet> {
  final _groupNameController = TextEditingController();
  final _searchController = TextEditingController();
  final List<Channel> _selectedUsers = [];
  List<Channel> _searchResults = [];
  bool _searching = false;
  bool _creating = false;
  Timer? _debounce;

  @override
  void dispose() {
    _groupNameController.dispose();
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onSearchChanged(String q) {
    _debounce?.cancel();
    if (q.trim().length < 2) {
      setState(() => _searchResults = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(q));
  }

  Future<void> _search(String query) async {
    setState(() => _searching = true);
    final results = await ref.read(channelServiceProvider).searchChannels(query);
    if (!mounted) {
      return;
    }
    setState(() {
      _searchResults = results;
      _searching = false;
    });
  }

  void _toggleUser(Channel user) {
    setState(() {
      final exists = _selectedUsers.any((u) => u.creatorId == user.creatorId);
      if (exists) {
        _selectedUsers.removeWhere((u) => u.creatorId == user.creatorId);
      } else {
        _selectedUsers.add(user);
      }
    });
  }

  Future<void> _create() async {
    final name = _groupNameController.text.trim();
    if (name.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a group name (at least 2 letters).')),
      );
      return;
    }
    if (_selectedUsers.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please select at least 1 member to add.')),
      );
      return;
    }

    setState(() => _creating = true);
    final res = await ref.read(messageServiceProvider).createGroup(
      groupName: name,
      memberUserIds: _selectedUsers.map((u) => u.creatorId).toList(),
    );
    if (!mounted) {
      return;
    }
    setState(() => _creating = false);

    if (res.success && res.conversationId != null) {
      widget.onCreated(res.conversationId!, res.groupName ?? name);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(res.error ?? "Failed to create group.")),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 20,
      ),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: context.borderSubtle,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              children: [
                const Icon(Icons.group_add, color: AppColors.brandOrange),
                const SizedBox(width: 8),
                Text(
                  'Create Group',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: context.textPrimary,
                  ),
                ),
                const Spacer(),
                FilledButton(
                  onPressed: _creating ? null : _create,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  ),
                  child: _creating
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text('Create (${_selectedUsers.length})'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _groupNameController,
              style: TextStyle(color: context.textPrimary),
              decoration: InputDecoration(
                hintText: 'Group Name (e.g. Friends Circle)',
                hintStyle: TextStyle(color: context.textDim),
                prefixIcon: const Icon(Icons.label_outline, color: AppColors.brandOrange),
                filled: true,
                fillColor: context.bgCard,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: context.borderSubtle),
                ),
              ),
            ),
            const SizedBox(height: 12),
            if (_selectedUsers.isNotEmpty) ...[
              SizedBox(
                height: 38,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: _selectedUsers.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 6),
                  itemBuilder: (ctx, i) {
                    final u = _selectedUsers[i];
                    return Chip(
                      backgroundColor: AppColors.brandOrange.withValues(alpha: 0.15),
                      side: const BorderSide(color: AppColors.brandOrange),
                      avatar: CircleAvatar(
                        backgroundImage: u.avatarUrl != null
                            ? smartImageProvider(u.avatarUrl!)
                            : null,
                        child: u.avatarUrl == null
                            ? const Icon(Icons.person, size: 12)
                            : null,
                      ),
                      label: Text(
                        '@${u.username}',
                        style: TextStyle(color: context.textPrimary, fontSize: 12),
                      ),
                      deleteIcon: const Icon(Icons.close, size: 14),
                      onDeleted: () => _toggleUser(u),
                    );
                  },
                ),
              ),
              const SizedBox(height: 10),
            ],
            TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              style: TextStyle(color: context.textPrimary),
              decoration: InputDecoration(
                hintText: 'Search people to add...',
                hintStyle: TextStyle(color: context.textDim),
                prefixIcon: Icon(Icons.search, color: context.textDim),
                filled: true,
                fillColor: context.bgCard,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: context.borderSubtle),
                ),
              ),
            ),
            const SizedBox(height: 8),
            if (_searching)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(16),
                  child: CircularProgressIndicator(color: AppColors.brandOrange),
                ),
              )
            else
              Expanded(
                child: _searchResults.isEmpty
                    ? Center(
                        child: Text(
                          _searchController.text.trim().length < 2
                              ? 'Type a username to search members'
                              : 'No users found',
                          style: TextStyle(color: context.textSecondary),
                        ),
                      )
                    : ListView.builder(
                        itemCount: _searchResults.length,
                        itemBuilder: (ctx, index) {
                          final user = _searchResults[index];
                          final isSelected = _selectedUsers.any((u) => u.creatorId == user.creatorId);
                          final avatar = user.avatarUrl != null ? smartImageProvider(user.avatarUrl!) : null;
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                              backgroundImage: avatar,
                              child: avatar == null
                                  ? Icon(Icons.person, color: context.textSecondary)
                                  : null,
                            ),
                            title: Text(
                              user.name,
                              style: TextStyle(
                                color: context.textPrimary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            subtitle: Text('@${user.username}', style: TextStyle(color: context.textSecondary)),
                            trailing: Icon(
                              isSelected ? Icons.check_circle : Icons.circle_outlined,
                              color: isSelected ? AppColors.brandOrange : context.textDim,
                            ),
                            onTap: () => _toggleUser(user),
                          );
                        },
                      ),
              ),
          ],
        ),
      ),
    );
  }
}
