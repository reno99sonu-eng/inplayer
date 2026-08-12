import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/admin_service.dart';
import '../../../../models/admin_user.dart';

class AdminUsersTab extends ConsumerStatefulWidget {
  const AdminUsersTab({super.key});

  @override
  ConsumerState<AdminUsersTab> createState() => _AdminUsersTabState();
}

class _AdminUsersTabState extends ConsumerState<AdminUsersTab> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  bool _loading = true;
  bool _loadingMore = false;
  List<AdminUser> _users = [];
  String? _nextCursor;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getUsers(query: _query);
    if (!mounted) return;
    setState(() {
      _users = result.users;
      _nextCursor = result.nextCursor;
      _loading = false;
    });
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    final result = await ref.read(adminServiceProvider).getUsers(query: _query, cursor: _nextCursor);
    if (!mounted) return;
    setState(() {
      _users = [..._users, ...result.users];
      _nextCursor = result.nextCursor;
      _loadingMore = false;
    });
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 400), () {
      _query = value.trim();
      _load();
    });
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
    );
  }

  Future<void> _toggleSuspend(AdminUser user, int index) async {
    final next = !user.isSuspended;
    setState(() => _users = List.of(_users)..[index] = user.copyWith(isSuspended: next));
    final ok = await ref.read(adminServiceProvider).setSuspended(user.userId, next);
    if (!mounted) return;
    if (!ok) {
      setState(() => _users = List.of(_users)..[index] = user);
      _showSnack("Couldn't do that. Try again.");
    }
  }

  Future<void> _confirmDelete(AdminUser user, int index) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text('Delete this account?', style: TextStyle(color: AppColors.textPrimaryDark)),
        content: Text(
          "This permanently deletes @${user.username ?? user.userId}'s videos, profile, and sign-in. This can't be undone.",
          style: const TextStyle(color: AppColors.textSecondaryDark),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed != true) return;

    final result = await ref.read(adminServiceProvider).deleteUser(user.userId);
    if (!mounted) return;
    if (result.success) {
      setState(() => _users = List.of(_users)..removeAt(index));
      _showSnack('Account deleted.');
    } else {
      _showSnack(result.error ?? "Couldn't delete that account.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Container(
            height: 44,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.04),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
            ),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                hintText: 'Search by username or userId...',
                hintStyle: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 14),
                prefixIcon: Icon(Icons.search, color: Colors.white.withValues(alpha: 0.4), size: 20),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
            ),
          ),
        ),
        Expanded(
          child: _loading
              ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
              : _users.isEmpty
                  ? const Center(
                      child: Text('No users found', style: TextStyle(color: AppColors.textSecondaryDark)),
                    )
                  : NotificationListener<ScrollNotification>(
                      onNotification: (notification) {
                        if (notification.metrics.pixels > notification.metrics.maxScrollExtent - 200) {
                          _loadMore();
                        }
                        return false;
                      },
                      child: ListView.separated(
                        itemCount: _users.length + (_nextCursor != null ? 1 : 0),
                        separatorBuilder: (context, index) => const Divider(height: 1, color: AppColors.cardDark),
                        itemBuilder: (context, index) {
                          if (index >= _users.length) {
                            return const Padding(
                              padding: EdgeInsets.all(16),
                              child: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
                            );
                          }
                          final user = _users[index];
                          final avatar = user.avatarUrl != null ? smartImageProvider(user.avatarUrl!) : null;

                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: AppColors.surfaceDark,
                              backgroundImage: avatar,
                              child: avatar == null
                                  ? const Icon(Icons.person, color: AppColors.textSecondaryDark)
                                  : null,
                            ),
                            title: Text(
                              user.name?.isNotEmpty == true ? user.name! : (user.username ?? user.userId),
                              style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              [
                                if (user.username != null) '@${user.username}',
                                if (user.email != null) user.email!,
                              ].join(' • '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
                            ),
                            trailing: PopupMenuButton<String>(
                              icon: Icon(
                                Icons.more_vert,
                                color: user.isSuspended ? AppColors.error : AppColors.textPrimaryDark,
                              ),
                              color: AppColors.cardDark,
                              onSelected: (action) {
                                if (action == 'suspend') {
                                  _toggleSuspend(user, index);
                                } else if (action == 'delete') {
                                  _confirmDelete(user, index);
                                }
                              },
                              itemBuilder: (context) => [
                                PopupMenuItem(
                                  value: 'suspend',
                                  child: Text(
                                    user.isSuspended ? 'Unsuspend' : 'Suspend',
                                    style: const TextStyle(color: AppColors.textPrimaryDark),
                                  ),
                                ),
                                const PopupMenuItem(
                                  value: 'delete',
                                  child: Text('Delete account', style: TextStyle(color: AppColors.error)),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}
