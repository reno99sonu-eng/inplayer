import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// The real native "About InPlayer" dialog — app name, live version/build
/// number (via PackageInfo), and a one-line description. Originally lived
/// only in Settings > Support; extracted here so the hamburger drawer's
/// Company > About item can show the same real dialog instead of trying to
/// open https://inplayer.in/about, which doesn't exist on the live site.
Future<void> showInPlayerAboutDialog(BuildContext context) async {
  final info = await PackageInfo.fromPlatform();
  if (!context.mounted) return;
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: ctx.bgModal,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(20),
        side: BorderSide(color: ctx.borderSubtle),
      ),
      title: Text('InPlayer', style: TextStyle(color: ctx.textPrimary, fontWeight: FontWeight.bold)),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Version ${info.version} (build ${info.buildNumber})',
              style: TextStyle(color: ctx.textSecondary)),
          const SizedBox(height: 8),
          Text(
            'The InPlayer Android app — high quality video streaming with creator marketplace.',
            style: TextStyle(color: ctx.textSecondary),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(ctx).pop(),
          child: const Text('Close', style: TextStyle(color: AppColors.brandOrange, fontWeight: FontWeight.bold)),
        ),
      ],
    ),
  );
}
