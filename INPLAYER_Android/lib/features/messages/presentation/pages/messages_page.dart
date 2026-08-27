import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
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
        SnackBar(
          content: const Text("Couldn't do that. Try again."),
          backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: PatternBackground(
        child: Scaffold(
          backgroundColor: Colors.transparent,
          appBar: AppBar(
            backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
            elevation: 0,
            iconTheme: IconThemeData(color: context.textPrimary),
            title: Text(
              'MilonBook',
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: context.textPrimary,
                letterSpacing: -0.5,
              ),
            ),
            actions: [
              IconButton(
                icon: Icon(Icons.edit_outlined, color: context.textPrimary),
                onPressed: () async {
                  await context.push('/messages/new');
                  if (mounted) _load();
                },
              ),
            ],
            bottom: TabBar(
              indicatorColor: AppColors.brandOrange,
              labelColor: AppColors.brandOrange,
              unselectedLabelColor: context.textSecondary,
              tabs: [
                const Tab(text: 'MilonBook'),
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
      ),
    );
  }

  Widget _buildList(List<Conversation> items, {required bool isRequests}) {
    return RefreshIndicator(
      color: AppColors.brandOrange,
      backgroundColor: context.bgCard,
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
                          color: context.textDim,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          isRequests ? 'No message requests' : 'No messages yet',
                          style: TextStyle(color: context.textSecondary),
                        ),
                        if (!isRequests) ...[
                          const SizedBox(height: 8),
                          Text(
                            'Tap the pencil to start a conversation',
                            style: TextStyle(
                              color: context.textDim,
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
              separatorBuilder: (context, index) => Divider(height: 1, color: context.borderSubtle),
              itemBuilder: (context, index) {
                final c = items[index];
                final avatar = c.otherAvatarUrl != null ? smartImageProvider(c.otherAvatarUrl!) : null;
                final unread = !isRequests && c.unreadCount > 0;

                return ListTile(
                  onTap: () => _openConversation(c),
                  tileColor: unread ? AppColors.brandOrange.withValues(alpha: 0.08) : null,
                  leading: CircleAvatar(
                    radius: 22,
                    backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                    backgroundImage: avatar,
                    child: avatar == null
                        ? Icon(Icons.person, color: context.textSecondary)
                        : null,
                  ),
                  title: Text(
                    c.otherUsername ?? 'Unknown',
                    style: TextStyle(
                      color: context.textPrimary,
                      fontWeight: unread ? FontWeight.bold : FontWeight.w600,
                    ),
                  ),
                  subtitle: Text(
                    c.lastMessageText.isEmpty ? 'Say hello 👋' : c.lastMessageText,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: unread ? context.textPrimary : context.textSecondary,
                      fontWeight: unread ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                  trailing: isRequests
                      ? Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: Icon(Icons.close, color: context.textSecondary),
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
                              style: TextStyle(color: context.textDim, fontSize: 11),
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
