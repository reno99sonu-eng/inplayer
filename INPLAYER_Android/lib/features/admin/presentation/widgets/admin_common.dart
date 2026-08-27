import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';

void showAdminSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
    ),
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
      backgroundColor: context.bgModal,
      title: Text(title, style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
      content: Text(content, style: TextStyle(color: context.textSecondary)),
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
            Icon(Icons.storage_outlined, color: context.textDim, size: 40),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: TextStyle(color: context.textSecondary)),
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
          Icon(icon, color: context.textDim, size: 40),
          const SizedBox(height: 12),
          Text(message, style: TextStyle(color: context.textSecondary)),
        ],
      ),
    );
  }
}

const adminLoadingCenter = Center(child: CircularProgressIndicator(color: AppColors.brandOrange));

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

class AdminSectionPage extends StatelessWidget {
  final String title;
  final Widget child;
  const AdminSectionPage({super.key, required this.title, required this.child});

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
            title,
            style: TextStyle(fontWeight: FontWeight.w800, color: context.textPrimary, letterSpacing: -0.5),
          ),
        ),
        body: child,
      ),
    );
  }
}
