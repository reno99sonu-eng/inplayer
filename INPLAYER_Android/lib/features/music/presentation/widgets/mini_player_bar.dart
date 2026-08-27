import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../services/music_player_service.dart';
import '../pages/now_playing_page.dart';

/// The persistent bar that keeps a track visible and controllable no
/// matter which bottom-nav tab is open — sits directly above the bottom
/// navigation bar in home_page.dart's Scaffold (outside the IndexedStack,
/// so it survives switching tabs). Renders nothing when nothing is
/// loaded. Deliberately its own glass idiom rather than a copy of
/// Spotify's flat mini player: frosted blur + a brand-orange glow behind
/// the art, matching the "ultra premium" language already used by this
/// app's own bottom nav and app bar.
class MiniPlayerBar extends ConsumerWidget {
  const MiniPlayerBar({super.key});

  void _openNowPlaying(BuildContext context) {
    Navigator.of(context, rootNavigator: true).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black.withValues(alpha: 0.001),
        transitionDuration: const Duration(milliseconds: 280),
        pageBuilder: (context, animation, secondaryAnimation) => const NowPlayingPage(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutCubic);
          return SlideTransition(
            position: Tween<Offset>(begin: const Offset(0, 1), end: Offset.zero).animate(curved),
            child: child,
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final player = ref.watch(musicPlayerServiceProvider);
    final track = player.currentTrack;
    if (track == null) return const SizedBox.shrink();

    final isDark = context.isDark;
    final coverUrl = track.covers.isNotEmpty ? track.covers.first : track.thumbnail;

    return GestureDetector(
      onTap: () => _openNowPlaying(context),
      onVerticalDragEnd: (details) {
        if ((details.primaryVelocity ?? 0) < -250) _openNowPlaying(context);
      },
      child: ClipRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 30, sigmaY: 30),
          child: Container(
            margin: const EdgeInsets.fromLTRB(10, 0, 10, 6),
            decoration: BoxDecoration(
              color: (isDark ? AppColors.navbarDark : AppColors.navbarLight).withValues(alpha: 0.96),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: isDark ? Colors.white.withValues(alpha: 0.10) : Colors.black.withValues(alpha: 0.08),
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.brandOrange.withValues(alpha: isDark ? 0.18 : 0.10),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Slim progress line along the top edge.
                  StreamBuilder<Duration>(
                    stream: player.positionStream,
                    builder: (context, snapshot) {
                      final pos = snapshot.data ?? Duration.zero;
                      final dur = player.duration ?? Duration.zero;
                      final ratio = dur.inMilliseconds > 0
                          ? (pos.inMilliseconds / dur.inMilliseconds).clamp(0.0, 1.0)
                          : 0.0;
                      return SizedBox(
                        height: 2,
                        child: LinearProgressIndicator(
                          value: ratio,
                          minHeight: 2,
                          backgroundColor: Colors.transparent,
                          valueColor: const AlwaysStoppedAnimation<Color>(AppColors.brandOrange),
                        ),
                      );
                    },
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(9),
                          child: SizedBox(
                            width: 40,
                            height: 40,
                            child: coverUrl.isNotEmpty
                                ? CachedNetworkImage(
                                    imageUrl: coverUrl,
                                    fit: BoxFit.cover,
                                    errorWidget: (context, url, error) => Container(
                                      color: AppColors.music.withValues(alpha: 0.25),
                                      child: const Icon(Icons.music_note_rounded, color: Colors.white70, size: 18),
                                    ),
                                  )
                                : Container(
                                    color: AppColors.music.withValues(alpha: 0.25),
                                    child: const Icon(Icons.music_note_rounded, color: Colors.white70, size: 18),
                                  ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                track.title.isEmpty ? 'Untitled track' : track.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: context.textPrimary,
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                              Text(
                                (track.artist?.isNotEmpty == true ? track.artist! : track.creator),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(color: context.textSecondary, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                          icon: Icon(
                            player.isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                            color: context.textPrimary,
                            size: 26,
                          ),
                          onPressed: () => ref.read(musicPlayerServiceProvider).togglePlayPause(),
                        ),
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                          icon: Icon(Icons.skip_next_rounded, color: context.textPrimary, size: 24),
                          onPressed: () => ref.read(musicPlayerServiceProvider).next(),
                        ),
                        // Dismiss. Until now this bar could only be got rid
                        // of by playing a track to the end of the queue —
                        // there was no way out of it at all, which is the
                        // complaint this fixes. stop() is the service's own
                        // existing teardown (stops playback, empties the
                        // queue, nulls the index), and because the whole
                        // widget early-returns SizedBox.shrink() when
                        // currentTrack is null, clearing the queue is
                        // exactly what makes the bar disappear — no separate
                        // visibility flag to keep in sync. It also drops the
                        // lock-screen/notification media controls, which is
                        // the behaviour people expect from an X here.
                        //
                        // Deliberately dimmer and smaller than the transport
                        // controls beside it: it's a destructive action, so
                        // it shouldn't compete with play/pause for the
                        // thumb, but it still gets the same 34px minimum
                        // target so it stays comfortably tappable.
                        IconButton(
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(minWidth: 34, minHeight: 34),
                          tooltip: 'Close player',
                          icon: Icon(
                            Icons.close_rounded,
                            color: context.textSecondary,
                            size: 20,
                          ),
                          onPressed: () => ref.read(musicPlayerServiceProvider).stop(),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
