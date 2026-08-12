import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/admin_service.dart';

/// Maintenance tools — one-time/idempotent repair jobs mirrored from
/// app/api/admin/{recaption,self-heal-videos,backfill-short-thumbnails}/
/// route.ts. Every one of these is designed by the backend to be safe to
/// re-run (already-fixed rows are skipped), so there's no destructive
/// confirmation needed here — just a clear "what did it do" result.
class AdminMaintenanceTab extends StatelessWidget {
  const AdminMaintenanceTab({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: const [
        _RecaptionCard(),
        SizedBox(height: 16),
        _SelfHealCard(),
        SizedBox(height: 16),
        _BackfillThumbnailsCard(),
      ],
    );
  }
}

class _ToolCard extends StatelessWidget {
  final String title;
  final String description;
  final Widget child;
  const _ToolCard({required this.title, required this.description, required this.child});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(color: AppColors.textPrimaryDark, fontWeight: FontWeight.bold, fontSize: 15)),
          const SizedBox(height: 6),
          Text(description, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class _RecaptionCard extends ConsumerStatefulWidget {
  const _RecaptionCard();

  @override
  ConsumerState<_RecaptionCard> createState() => _RecaptionCardState();
}

class _RecaptionCardState extends ConsumerState<_RecaptionCard> {
  bool _running = false;
  String? _result;
  int _shortsTotal = 0;
  int _videosTotal = 0;

  Future<void> _run() async {
    setState(() {
      _running = true;
      _result = null;
      _shortsTotal = 0;
      _videosTotal = 0;
    });

    final service = ref.read(adminServiceProvider);
    var done = false;
    var passes = 0;
    while (!done && passes < 20 && mounted) {
      passes++;
      final run = await service.repairCaptions();
      if (run == null) {
        setState(() => _result = 'Failed to run — check your connection and try again.');
        break;
      }
      _shortsTotal += run.shortsProcessed;
      _videosTotal += run.videosProcessed;
      done = run.done;
      if (!mounted) return;
      setState(() => _result = done
          ? 'Done — $_shortsTotal Shorts, $_videosTotal videos repaired.'
          : 'In progress — $_shortsTotal Shorts, $_videosTotal videos so far, ${run.remainingVideos} left...');
    }
    if (mounted) setState(() => _running = false);
  }

  @override
  Widget build(BuildContext context) {
    return _ToolCard(
      title: 'Repair captions',
      description: 'Rebuilds multi-language captions for every already-published video/Short from its existing transcript. Safe to re-run — already-fixed items are skipped.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ElevatedButton(
            onPressed: _running ? null : _run,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange),
            child: _running
                ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Run'),
          ),
          if (_result != null) ...[
            const SizedBox(height: 10),
            Text(_result!, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}

class _SelfHealCard extends ConsumerStatefulWidget {
  const _SelfHealCard();

  @override
  ConsumerState<_SelfHealCard> createState() => _SelfHealCardState();
}

class _SelfHealCardState extends ConsumerState<_SelfHealCard> {
  bool _running = false;
  String? _result;

  Future<void> _run() async {
    setState(() {
      _running = true;
      _result = null;
    });
    final run = await ref.read(adminServiceProvider).selfHealVideos();
    if (!mounted) return;
    setState(() {
      _running = false;
      _result = run == null
          ? 'Failed to run — check your connection and try again.'
          : '${run.totalStuck} stuck found — ${run.healedToReady} recovered, ${run.healedToError} marked failed, ${run.stillProcessing} still processing.';
    });
  }

  @override
  Widget build(BuildContext context) {
    return _ToolCard(
      title: 'Self-heal stuck videos',
      description: 'Rescues uploads stuck at "processing" (caused by a now-fixed geo-restriction gap) by asking Mux directly whether they actually finished.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ElevatedButton(
            onPressed: _running ? null : _run,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange),
            child: _running
                ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Run'),
          ),
          if (_result != null) ...[
            const SizedBox(height: 10),
            Text(_result!, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}

class _BackfillThumbnailsCard extends ConsumerStatefulWidget {
  const _BackfillThumbnailsCard();

  @override
  ConsumerState<_BackfillThumbnailsCard> createState() => _BackfillThumbnailsCardState();
}

class _BackfillThumbnailsCardState extends ConsumerState<_BackfillThumbnailsCard> {
  bool _running = false;
  String? _result;

  Future<void> _run() async {
    setState(() {
      _running = true;
      _result = null;
    });
    final run = await ref.read(adminServiceProvider).backfillShortThumbnails();
    if (!mounted) return;
    setState(() {
      _running = false;
      _result = run == null
          ? 'Failed to run — check your connection and try again.'
          : '${run.processed} Shorts fixed — ${run.skippedCustomThumbnail} skipped (custom thumbnail), ${run.skippedNoPlaybackId} skipped (not ready).';
    });
  }

  @override
  Widget build(BuildContext context) {
    return _ToolCard(
      title: 'Fix Shorts thumbnails',
      description: 'Corrects stretched landscape thumbnails on Shorts uploaded before the portrait-thumbnail fix. Skips anything with a creator-set custom thumbnail.',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ElevatedButton(
            onPressed: _running ? null : _run,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange),
            child: _running
                ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Run'),
          ),
          if (_result != null) ...[
            const SizedBox(height: 10),
            Text(_result!, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
          ],
        ],
      ),
    );
  }
}
