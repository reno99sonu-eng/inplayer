import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/channel_service.dart';
import '../../../../models/channel.dart';

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
    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: Text(
            'New Message',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
        ),
        body: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Container(
                height: 44,
                decoration: BoxDecoration(
                  color: context.bgCard,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: context.borderSubtle),
                ),
                child: TextField(
                  controller: _controller,
                  autofocus: true,
                  onChanged: _onChanged,
                  style: TextStyle(color: context.textPrimary, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Search by username...',
                    hintStyle: TextStyle(color: context.textDim, fontSize: 14),
                    prefixIcon: Icon(Icons.search, color: context.textDim, size: 20),
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
                          style: TextStyle(color: context.textSecondary),
                        ),
                      )
                    : ListView.builder(
                        itemCount: _results.length,
                        itemBuilder: (context, index) {
                          final user = _results[index];
                          final avatar = user.avatarUrl != null ? smartImageProvider(user.avatarUrl!) : null;
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                              backgroundImage: avatar,
                              child: avatar == null
                                  ? Icon(Icons.person, color: context.textSecondary)
                                  : null,
                            ),
                            title: Text(user.name, style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
                            subtitle: Text('@${user.username}', style: TextStyle(color: context.textSecondary)),
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
      ),
    );
  }
}
