import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/message_service.dart';
import '../../../../models/conversation.dart';

class MessagesPage extends ConsumerStatefulWidget {
  const MessagesPage({super.key});

  @override
  ConsumerState<MessagesPage> createState() => _MessagesPageState();
}

class _MessagesPageState extends ConsumerState<MessagesPage> {
  bool _loading = true;
  List<Conversation> _conversations = [];
  List<Conversation> _requests = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(messageServiceProvider).getConversations();
    if (!mounted) return;
    setState(() {
      _conversations = result.conversations;
      _requests = result.requests;
      _loading = false;
    });
  }

  Future<void> _openConversation(Conversation c) async {
    await context.push(
      '/messages/${c.conversationId}',
      extra: {
        'otherUserId': c.otherUserId,
        'otherUsername': c.otherUsername,
        'otherAvatarUrl': c.otherAvatarUrl,
      },
    );
    if (mounted) _load();
  }

  Future<void> _respondToRequest(Conversation c, bool accept) async {
    setState(() => _requests = List.of(_requests)..remove(c));
    final ok = await ref
        .read(messageServiceProvider)
        .conversationAction(c.conversationId, accept ? 'accept' : 'decline');
    if (!mounted) return;
    if (ok && accept) {
      setState(() => _conversations = [c, ..._conversations]);
    } else if (!ok) {
      setState(() => _requests = [c, ..._requests]);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Couldn't do that. Try again."),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(
          backgroundColor: AppColors.backgroundDark,
          elevation: 0,
          title: const Text(
            'Messages',
            style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.edit_outlined, color: AppColors.textPrimaryDark),
              onPressed: () async {
                await context.push('/messages/new');
                if (mounted) _load();
              },
            ),
          ],
          bottom: TabBar(
            indicatorColor: AppColors.brandOrange,
            labelColor: AppColors.brandOrange,
            unselectedLabelColor: AppColors.textSecondaryDark,
            tabs: [
              const Tab(text: 'Messages'),
              Tab(text: _requests.isEmpty ? 'Requests' : 'Requests (${_requests.length})'),
            ],
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
            : TabBarView(
                children: [
                  _buildList(_conversations, isRequests: false),
                  _buildList(_requests, isRequests: true),
                ],
              ),
      ),
    );
  }

  Widget _buildList(List<Conversation> items, {required bool isRequests}) {
    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: AppColors.surfaceDark,
      onRefresh: _load,
      child: items.isEmpty
          ? ListView(
              children: [
                SizedBox(
                  height: MediaQuery.of(context).size.height * 0.6,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          isRequests ? Icons.mail_outline : Icons.chat_bubble_outline,
                          size: 48,
                          color: AppColors.textSecondaryDark.withValues(alpha: 0.5),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          isRequests ? 'No message requests' : 'No messages yet',
                          style: const TextStyle(color: AppColors.textSecondaryDark),
                        ),
                        if (!isRequests) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Tap the pencil to start a conversation',
                            style: TextStyle(
                              color: AppColors.textSecondaryDark.withValues(alpha: 0.7),
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            )
          : ListView.separated(
              itemCount: items.length,
              separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
              itemBuilder: (context, index) {
                final c = items[index];
                final avatar = c.otherAvatarUrl != null ? smartImageProvider(c.otherAvatarUrl!) : null;
                final unread = !isRequests && c.unreadCount > 0;

                return ListTile(
                  onTap: () => _openConversation(c),
                  tileColor: unread ? AppColors.brandOrange.withValues(alpha: 0.06) : null,
                  leading: CircleAvatar(
                    radius: 22,
                    backgroundColor: AppColors.surfaceDark,
                    backgroundImage: avatar,
                    child: avatar == null
                        ? const Icon(Icons.person, color: AppColors.textSecondaryDark)
                        : null,
                  ),
                  title: Text(
                    c.otherUsername ?? 'Unknown',
                    style: TextStyle(
                      color: AppColors.textPrimaryDark,
                      fontWeight: unread ? FontWeight.bold : FontWeight.w600,
                    ),
                  ),
                  subtitle: Text(
                    c.lastMessageText.isEmpty ? 'Say hello 👋' : c.lastMessageText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: unread ? AppColors.textPrimaryDark : AppColors.textSecondaryDark,
                      fontWeight: unread ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                  trailing: isRequests
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.close, color: AppColors.textSecondaryDark),
                              onPressed: () => _respondToRequest(c, false),
                            ),
                            IconButton(
                              icon: const Icon(Icons.check_circle, color: AppColors.brandOrange),
                              onPressed: () => _respondToRequest(c, true),
                            ),
                          ],
                        )
                      : Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              formatTimeAgo(c.lastMessageAt),
                              style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11),
                            ),
                            if (unread) ...[
                              const SizedBox(height: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                decoration: BoxDecoration(
                                  color: AppColors.brandOrange,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '${c.unreadCount}',
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
              },
            ),
    );
  }
}
