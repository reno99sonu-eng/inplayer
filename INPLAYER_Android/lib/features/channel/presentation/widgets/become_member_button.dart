import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../../core/constants/api_constants.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/channel_service.dart';
import '../../../../providers/auth_provider.dart';

/// "Become a Member" button for a creator's channel. Membership purchase
/// itself needs a full payment flow this app can't safely build/verify
/// without a compiler, so this button honestly shows the real membership
/// status (fetched from GET /api/memberships/status) and, if not already a
/// member, opens the real website's membership page to complete the
/// purchase there. Never rendered on the signed-in user's own channel.
class BecomeMemberButton extends ConsumerStatefulWidget {
  final String creatorId;
  final String creatorName;
  final String username;

  /// Compact variant is used in dense contexts like the Discover Creators
  /// grid card; the full variant is used on the channel page itself.
  final bool compact;

  const BecomeMemberButton({
    super.key,
    required this.creatorId,
    required this.creatorName,
    required this.username,
    this.compact = false,
  });

  @override
  ConsumerState<BecomeMemberButton> createState() => _BecomeMemberButtonState();
}

class _BecomeMemberButtonState extends ConsumerState<BecomeMemberButton> {
  bool _loading = true;
  bool _isMember = false;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  Future<void> _loadStatus() async {
    try {
      final isMember = await ref.read(channelServiceProvider).getMembershipStatus(widget.creatorId);
      if (mounted) {
        setState(() {
          _isMember = isMember;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openMembershipPage() async {
    final uri = Uri.parse('${ApiConstants.websiteOrigin}/${widget.username}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authStateProvider);
    final isOwnChannel = authState is AuthStateAuthenticated && authState.user.userId == widget.creatorId;
    if (isOwnChannel) return const SizedBox.shrink();

    if (_loading) {
      return SizedBox(
        height: widget.compact ? 32 : 40,
        child: const Center(
          child: SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (_isMember) {
      return _buildButton(
        label: 'Member',
        icon: Icons.check_circle,
        background: Colors.transparent,
        foreground: AppColors.brandOrange,
        border: AppColors.brandOrange,
        onTap: _openMembershipPage,
      );
    }

    return _buildButton(
      label: 'Become a Member',
      icon: Icons.workspace_premium_outlined,
      background: AppColors.brandOrange,
      foreground: Colors.white,
      border: AppColors.brandOrange,
      onTap: _openMembershipPage,
    );
  }

  Widget _buildButton({
    required String label,
    required IconData icon,
    required Color background,
    required Color foreground,
    required Color border,
    required VoidCallback onTap,
  }) {
    return SizedBox(
      height: widget.compact ? 32 : 40,
      child: OutlinedButton.icon(
        onPressed: onTap,
        icon: Icon(icon, size: widget.compact ? 14 : 18, color: foreground),
        label: Text(
          label,
          style: TextStyle(fontSize: widget.compact ? 12 : 14, color: foreground, fontWeight: FontWeight.w600),
        ),
        style: OutlinedButton.styleFrom(
          backgroundColor: background,
          side: BorderSide(color: border),
          padding: EdgeInsets.symmetric(horizontal: widget.compact ? 8 : 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(widget.compact ? 16 : 20)),
        ),
      ),
    );
  }
}
