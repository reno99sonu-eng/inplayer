import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../theme/app_colors.dart';
import '../theme/app_theme.dart';

/// Shown beside the version instead of `info.buildNumber`. The version code
/// (the `+4` in `1.0.1+4`) means nothing to a reader, so the dialog shows the
/// build year. Bump this when the year changes.
const String _buildLabel = 'Build 2026';

/// The real native "About InPlayer" dialog — app name, live version, build
/// label, and a one-line description. Originally lived only in
/// Settings > Support; extracted here so the hamburger drawer's
/// Company > About item can show the same real dialog instead of trying to
/// open https://inplayer.in/about, which doesn't exist on the live site.
///
/// The closing line is a licence obligation, not marketing: the bundled age
/// model is FairFace under CC BY 4.0, which requires crediting the authors
/// and saying the work was changed (it was — converted to LiteRT and
/// int8-quantised). It is worded as a privacy note because that is what
/// matters to a reader, but the credit itself cannot be dropped.
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
      // Scrollable: the attribution below pushes this past the available
      // height on short screens, and an AlertDialog will happily overflow
      // rather than scroll on its own.
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Version ${info.version} · $_buildLabel',
                style: TextStyle(color: ctx.textSecondary)),
            const SizedBox(height: 8),
            Text(
              'The InPlayer Android app — high quality video streaming with creator marketplace.',
              style: TextStyle(color: ctx.textSecondary),
            ),
            const SizedBox(height: 16),
            Divider(color: ctx.borderSubtle, height: 1),
            const SizedBox(height: 12),
            Text(
              'Face scanning runs entirely on your device. Nothing captured '
              'during a scan is uploaded, shared or stored. Age model adapted '
              'from FairFace (K. Kärkkäinen, J. Joo), CC BY 4.0.',
              style: TextStyle(
                color: ctx.textMuted,
                fontSize: 11,
                height: 1.45,
              ),
            ),
          ],
        ),
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
