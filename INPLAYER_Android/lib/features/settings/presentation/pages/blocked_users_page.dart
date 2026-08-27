import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';

class BlockedUsersPage extends ConsumerStatefulWidget {
  const BlockedUsersPage({super.key});

  @override
  ConsumerState<BlockedUsersPage> createState() => _BlockedUsersPageState();
}

class _BlockedUsersPageState extends ConsumerState<BlockedUsersPage> {
  final List<Map<String, String>> _blockedUsers = [];
  final bool _loading = false;

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
            'Blocked Users',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
        ),
        body: _loading
            ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
            : _blockedUsers.isEmpty
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 64,
                            height: 64,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: context.textPrimary.withValues(alpha: 0.05),
                            ),
                            child: Icon(Icons.block_outlined, size: 32, color: context.textDim),
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'No Blocked Users',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: context.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'You have not blocked any users. Blocked accounts will not be able to message you or comment on your videos.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: context.textSecondary, height: 1.4),
                          ),
                        ],
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _blockedUsers.length,
                    separatorBuilder: (_, index) => Divider(color: context.borderSubtle),
                    itemBuilder: (context, index) {
                      final u = _blockedUsers[index];
                      return ListTile(
                        leading: CircleAvatar(
                          backgroundColor: AppColors.brandOrange.withValues(alpha: 0.1),
                          child: Text(
                            (u['name'] ?? 'U')[0].toUpperCase(),
                            style: const TextStyle(color: AppColors.brandOrange, fontWeight: FontWeight.bold),
                          ),
                        ),
                        title: Text(u['name'] ?? '', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
                        subtitle: Text('@${u['handle'] ?? ''}', style: TextStyle(color: context.textDim, fontSize: 12)),
                        trailing: OutlinedButton(
                          style: OutlinedButton.styleFrom(
                            side: BorderSide(color: context.borderSubtle),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: () {
                            setState(() => _blockedUsers.removeAt(index));
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('User unblocked.')),
                            );
                          },
                          child: const Text('Unblock', style: TextStyle(fontSize: 12)),
                        ),
                      );
                    },
                  ),
      ),
    );
  }
}
