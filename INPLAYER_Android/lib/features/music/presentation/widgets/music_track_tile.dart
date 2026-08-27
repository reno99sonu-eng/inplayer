import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/video.dart';
import '../../../../services/music_player_service.dart';
import '../../../watch/presentation/widgets/video_options_sheet.dart';
import 'mini_equalizer.dart';

/// One row in a music list — square cover, title/artist, a live
/// playing indicator when this is the current track, and a "⋮ more"
/// button that opens the same options sheet the rest of the app already
/// uses (Add to Playlist / Report / feedback), so Music doesn't need its
/// own duplicate of that logic. Shared by the Music hub, Genre, and
/// Liked Songs screens.
class MusicTrackTile extends ConsumerWidget {
  final Video track;
  /// The full ordered list this tile belongs to — tapping starts playback
  /// of this whole list from this track, so next/previous inside Now
  /// Playing moves through the same list the person was browsing.
  final List<Video> queue;
  final int index;

  const MusicTrackTile({
    super.key,
    required this.track,
    required this.queue,
    required this.index,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final player = ref.watch(musicPlayerServiceProvider);
    final isCurrent = player.currentTrack?.videoId == track.videoId && track.videoId.isNotEmpty;
    final coverUrl = track.covers.isNotEmpty ? track.covers.first : track.thumbnail;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: track.videoId.isEmpty
            ? null
            : () => ref.read(musicPlayerServiceProvider).playQueue(queue, startIndex: index),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      coverUrl.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: coverUrl,
                              fit: BoxFit.cover,
                              errorWidget: (context, url, error) => _fallbackArt(context),
                            )
                          : _fallbackArt(context),
                      if (isCurrent)
                        Container(
                          color: Colors.black.withValues(alpha: 0.45),
                          child: Center(
                            child: MiniEqualizer(playing: player.isPlaying, height: 18),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      track.title.isEmpty ? 'Untitled track' : track.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: isCurrent ? AppColors.brandOrangeLight : context.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      (track.artist?.isNotEmpty == true ? track.artist! : track.creator),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: context.textSecondary, fontSize: 12),
                    ),
                  ],
                ),
              ),
              if (track.duration.isNotEmpty) ...[
                Text(
                  track.duration,
                  style: TextStyle(color: context.textDim, fontSize: 11, fontWeight: FontWeight.w600),
                ),
                const SizedBox(width: 4),
              ],
              IconButton(
                icon: Icon(Icons.more_vert, color: context.textSecondary, size: 20),
                onPressed: track.videoId.isEmpty ? null : () => showMusicTrackQuickActions(context, ref, track: track, queue: queue),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _fallbackArt(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFE8590C), Color(0xFF1E1E1E)],
        ),
      ),
      child: const Center(
        child: Icon(Icons.music_note_rounded, color: Colors.white70, size: 22),
      ),
    );
  }
}

/// The "⋮" quick-actions sheet for a track row — Play Next / Add to Queue
/// (queue edits, handled entirely by [MusicPlayerService] so they never
/// interrupt what's currently playing), then a divider into "More options"
/// which hands off to the app's existing shared options sheet (Like info
/// aside, this is where Add to Playlist / Report / feedback already live —
/// deliberately not duplicated here). Reused by every screen that lists
/// tracks (Music hub, Genre, Liked Songs).
void showMusicTrackQuickActions(
  BuildContext context,
  WidgetRef ref, {
  required Video track,
  required List<Video> queue,
}) {
  showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (ctx) {
      return Container(
        padding: const EdgeInsets.fromLTRB(8, 12, 8, 24),
        decoration: BoxDecoration(
          color: ctx.bgModal,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: ctx.borderSubtle),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 14),
              decoration: BoxDecoration(color: ctx.textDim.withValues(alpha: 0.4), borderRadius: BorderRadius.circular(2)),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: SizedBox(
                      width: 40,
                      height: 40,
                      child: (track.covers.isNotEmpty ? track.covers.first : track.thumbnail).isNotEmpty
                          ? CachedNetworkImage(imageUrl: track.covers.isNotEmpty ? track.covers.first : track.thumbnail, fit: BoxFit.cover)
                          : Container(color: AppColors.music.withValues(alpha: 0.25)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          track.title.isEmpty ? 'Untitled track' : track.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: ctx.textPrimary, fontSize: 14, fontWeight: FontWeight.w800),
                        ),
                        Text(
                          track.artist?.isNotEmpty == true ? track.artist! : track.creator,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: ctx.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            _quickActionTile(
              context: ctx,
              icon: Icons.playlist_play_rounded,
              label: 'Play next',
              onTap: () {
                Navigator.pop(ctx);
                ref.read(musicPlayerServiceProvider).playNext(track);
                _showQueuedSnack(context, 'Playing next');
              },
            ),
            _quickActionTile(
              context: ctx,
              icon: Icons.queue_music_rounded,
              label: 'Add to queue',
              onTap: () {
                Navigator.pop(ctx);
                ref.read(musicPlayerServiceProvider).addToQueue(track);
                _showQueuedSnack(context, 'Added to queue');
              },
            ),
            Divider(color: ctx.borderSubtle, height: 20, indent: 16, endIndent: 16),
            _quickActionTile(
              context: ctx,
              icon: Icons.more_horiz_rounded,
              label: 'More options',
              onTap: () {
                Navigator.pop(ctx);
                showVideoOptionsSheet(context, track);
              },
            ),
          ],
        ),
      );
    },
  );
}

Widget _quickActionTile({
  required BuildContext context,
  required IconData icon,
  required String label,
  required VoidCallback onTap,
}) {
  return Material(
    color: Colors.transparent,
    child: InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Icon(icon, color: AppColors.brandOrangeLight, size: 20),
            const SizedBox(width: 14),
            Text(label, style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    ),
  );
}

void _showQueuedSnack(BuildContext context, String message) {
  if (!context.mounted) return;
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(message),
      backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      duration: const Duration(seconds: 2),
    ),
  );
}
