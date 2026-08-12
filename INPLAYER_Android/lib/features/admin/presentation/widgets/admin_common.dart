import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

/// Small shared helpers reused across every admin section screen added in
/// the "finish whole admin panel" round, so each new tab file doesn't need
/// to redefine its own snackbar/dialog/empty-state boilerplate (the
/// earlier Dashboard/Users/Moderation tabs each rolled their own — this
/// centralizes the pattern now that the panel has grown to 15+ sections).

void showAdminSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
  );
}

Future<bool> confirmAdminDialog(
  BuildContext context, {
  required String title,
  required String content,
  String confirmLabel = 'Confirm',
  bool destructive = true,
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: AppColors.cardDark,
      title: Text(title, style: const TextStyle(color: AppColors.textPrimaryDark)),
      content: Text(content, style: const TextStyle(color: AppColors.textSecondaryDark)),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          style: TextButton.styleFrom(foregroundColor: destructive ? AppColors.error : AppColors.brandOrange),
          child: Text(confirmLabel),
        ),
      ],
    ),
  );
  return confirmed == true;
}

/// Honest "this table doesn't exist in AWS yet" empty state — the backend
/// pattern (see e.g. app/api/admin/revenue/route.ts) is to fail soft and
/// report `tableMissing: true` rather than fabricate a zero. Mirrored here
/// so the app never implies a section is simply "empty" when it's actually
/// not provisioned yet.
class AdminTableMissingNotice extends StatelessWidget {
  final String message;
  const AdminTableMissingNotice({super.key, this.message = "This isn't set up in AWS yet, so there's nothing to show here."});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.storage_outlined, color: AppColors.textSecondaryDark, size: 40),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondaryDark)),
          ],
        ),
      ),
    );
  }
}

class AdminEmptyState extends StatelessWidget {
  final String message;
  final IconData icon;
  const AdminEmptyState({super.key, required this.message, this.icon = Icons.inbox_outlined});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: AppColors.textSecondaryDark, size: 40),
          const SizedBox(height: 12),
          Text(message, style: const TextStyle(color: AppColors.textSecondaryDark)),
        ],
      ),
    );
  }
}

const adminLoadingCenter = Center(child: CircularProgressIndicator(color: AppColors.brandOrange));

/// A muted status pill, e.g. for kycStatus / vendor status / bug report
/// status values — consistent coloring across every section that shows one.
class AdminStatusPill extends StatelessWidget {
  final String label;
  final Color color;
  const AdminStatusPill({super.key, required this.label, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600),
      ),
    );
  }
}

/// Reusable "push a full section as its own page" wrapper for admin_page.dart's
/// menu, so every section gets a consistent AppBar/back button instead of
/// each tab file managing its own Scaffold.
class AdminSectionPage extends StatelessWidget {
  final String title;
  final Widget child;
  const AdminSectionPage({super.key, required this.title, required this.child});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark)),
      ),
      body: child,
    );
  }
}
