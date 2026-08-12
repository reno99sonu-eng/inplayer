import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/channel_service.dart';
import '../../../../models/channel.dart';

/// Picks a recipient (via the same GET /api/users/search?q= the search
/// page and channel lookups use) and hands off to ConversationPage in
/// "compose" mode — no conversation exists yet, only once the first
/// message actually sends does a real conversationId come back.
class NewMessagePage extends ConsumerStatefulWidget {
  const NewMessagePage({super.key});

  @override
  ConsumerState<NewMessagePage> createState() => _NewMessagePageState();
}

class _NewMessagePageState extends ConsumerState<NewMessagePage> {
  final _controller = TextEditingController();
  Timer? _debounce;
  bool _loading = false;
  List<Channel> _results = [];

  @override
  void dispose() {
    _controller.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  void _onChanged(String query) {
    _debounce?.cancel();
    if (query.trim().length < 2) {
      setState(() => _results = []);
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () => _search(query));
  }

  Future<void> _search(String query) async {
    setState(() => _loading = true);
    final results = await ref.read(channelServiceProvider).searchChannels(query);
    if (!mounted) return;
    setState(() {
      _results = results;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text(
          'New Message',
          style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Container(
              height: 44,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.04),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
              ),
              child: TextField(
                controller: _controller,
                autofocus: true,
                onChanged: _onChanged,
                style: const TextStyle(color: Colors.white, fontSize: 14),
                decoration: InputDecoration(
                  hintText: 'Search by username...',
                  hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 14),
                  prefixIcon: Icon(Icons.search, color: Colors.white.withValues(alpha: 0.4), size: 20),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
              ),
            ),
          ),
          if (_loading) const Padding(
            padding: EdgeInsets.only(top: 24),
            child: CircularProgressIndicator(color: AppColors.brandOrange),
          ),
          if (!_loading)
            Expanded(
              child: _results.isEmpty
                  ? Center(
                      child: Text(
                        _controller.text.trim().length < 2
                            ? 'Search for someone to message'
                            : 'No users found',
                        style: const TextStyle(color: AppColors.textSecondaryDark),
                      ),
                    )
                  : ListView.builder(
                      itemCount: _results.length,
                      itemBuilder: (context, index) {
                        final user = _results[index];
                        final avatar = user.avatarUrl != null ? smartImageProvider(user.avatarUrl!) : null;
                        return ListTile(
                          leading: CircleAvatar(
                            backgroundColor: AppColors.surfaceDark,
                            backgroundImage: avatar,
                            child: avatar == null
                                ? const Icon(Icons.person, color: AppColors.textSecondaryDark)
                                : null,
                          ),
                          title: Text(user.name, style: const TextStyle(color: AppColors.textPrimaryDark)),
                          subtitle: Text('@${user.username}', style: const TextStyle(color: AppColors.textSecondaryDark)),
                          onTap: () {
                            context.pushReplacement(
                              '/messages/compose',
                              extra: {
                                'otherUserId': user.creatorId,
                                'otherUsername': user.username,
                                'otherAvatarUrl': user.avatarUrl,
                              },
                            );
                          },
                        );
                      },
                    ),
            ),
        ],
      ),
    );
  }
}
