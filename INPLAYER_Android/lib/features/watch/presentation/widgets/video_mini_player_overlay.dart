import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../../services/video_mini_player_service.dart';

/// The floating video window — the video equivalent of mini_player_bar.dart's
/// docked music bar, but a free-floating window instead of a full-width dock
/// (a video needs to stay visible while you browse, the way YouTube's own
/// mini player works). Lives in home_page.dart's body Stack as a bare,
/// self-positioning child, so it persists across the bottom-nav tabs.
/// Renders nothing when nothing is minimized.
///
/// Docks to the RIGHT edge, vertically centred. It used to sit bottom-left
/// specifically to dodge FloatingAIButton's bottom-right corner; that button
/// is now Home-tab-only (see home_page.dart), so the window is free to take
/// the side of the screen, and centring it vertically keeps it clear of both
/// the bottom nav bar and the button on the one tab they can share.
class VideoMiniPlayerOverlay extends ConsumerStatefulWidget {
  const VideoMiniPlayerOverlay({super.key});

  @override
  ConsumerState<VideoMiniPlayerOverlay> createState() =>
      _VideoMiniPlayerOverlayState();
}

class _VideoMiniPlayerOverlayState
    extends ConsumerState<VideoMiniPlayerOverlay> {
  // Two shapes, because two kinds of thing can be minimized. A 16:9 watch
  // video gets the wider landscape window; a 9:16 Raftaar short gets a
  // narrower portrait one, so a vertical video isn't letterboxed into a
  // sliver inside a landscape box. Both sized up substantially from the old
  // 160/108 — at that size the picture was a thumbnail and there was no room
  // for real controls.
  static const _landscapeWidth = 248.0;
  static const _portraitWidth = 156.0;

  /// Null until the viewer drags it — until then it sits at the right edge.
  Offset? _dragOffset;

  void _restore(BuildContext context, VideoMiniPlayerService service) {
    final route = service.restoreRoute;
    if (service.kind == MiniPlayerKind.video) {
      final controller = service.detachForRestore();
      if (controller == null) return;
      // The /watch/:videoId route (app_router.dart) reads this exact
      // controller back out via `state.extra` — WatchPage's `adoptController`
      // param then skips creating a new one, so playback continues from
      // whatever position/play-state it's already at instead of restarting.
      context.push(route, extra: controller);
      return;
    }
    // Shorts: no controller handoff exists (see VideoMiniPlayerService.close
    // for why), so tear this one down and let the feed build a fresh one at
    // that video. The short restarts.
    service.close();
    context.push(route);
  }

  Widget _buildSurface(VideoMiniPlayerService service) {
    final controller = service.controller;
    if (controller == null) return const ColoredBox(color: Colors.black);

    // Music tracks render cover art rather than their raw decoded frame,
    // matching watch_page.dart's own _buildMediaSurface() split — full size
    // they're drawn by MusicStage, not VideoPlayer, so the frame is usually
    // blank. artUrl is empty for everything else.
    final art = service.artUrl;
    if (art.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: art,
        fit: BoxFit.cover,
        errorWidget: (context, url, error) =>
            const ColoredBox(color: Colors.black),
      );
    }
    if (!controller.value.isInitialized) {
      return const ColoredBox(color: Colors.black);
    }
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: controller.value.size.width,
        height: controller.value.size.height,
        child: VideoPlayer(controller),
      ),
    );
  }

  /// One of the small circular glass buttons in the window's corners.
  Widget _cornerButton({
    required IconData icon,
    required VoidCallback onTap,
    required String tooltip,
    double size = 26,
    double iconSize = 15,
  }) {
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.62),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
          ),
          child: Icon(icon, color: Colors.white, size: iconSize),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final service = ref.watch(videoMiniPlayerServiceProvider);
    if (!service.isActive) return const SizedBox.shrink();

    final controller = service.controller!;
    final screenSize = MediaQuery.of(context).size;

    final width = service.isPortrait ? _portraitWidth : _landscapeWidth;
    final height = service.isPortrait ? width * 16 / 9 : width * 9 / 16;

    // Right edge, vertically centred, rather than tucked into a corner.
    final defaultOffset = Offset(
      screenSize.width - width - 12,
      (screenSize.height - height) / 2,
    );
    final raw = _dragOffset ?? defaultOffset;
    final left = raw.dx.clamp(8.0, screenSize.width - width - 8.0);
    // max() guards the portrait window on a short screen, where the window
    // can be taller than the space between the two clamps — without it the
    // lower bound would fall below the upper one and clamp() throws.
    final topMax =
        (screenSize.height - height - 24.0).clamp(40.0, double.infinity);
    final top = raw.dy.clamp(40.0, topMax);

    return Positioned(
      left: left,
      top: top,
      child: GestureDetector(
        // Drag anywhere on the window to reposition it.
        onPanUpdate: (details) {
          setState(
            () => _dragOffset = (_dragOffset ?? defaultOffset) + details.delta,
          );
        },
        child: Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: Colors.white.withValues(alpha: 0.18)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.5),
                blurRadius: 24,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            children: [
              Positioned.fill(child: _buildSurface(service)),

              // Scrims so the controls stay legible over any frame.
              const Positioned(
                top: 0,
                left: 0,
                right: 0,
                height: 46,
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.black54, Colors.transparent],
                      ),
                    ),
                  ),
                ),
              ),
              const Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                height: 52,
                child: IgnorePointer(
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [Colors.black87, Colors.transparent],
                      ),
                    ),
                  ),
                ),
              ),

              // Expand back to the full player — top-left.
              Positioned(
                top: 5,
                left: 5,
                child: _cornerButton(
                  icon: Icons.open_in_full_rounded,
                  tooltip: 'Expand',
                  onTap: () => _restore(context, service),
                ),
              ),

              // Close — top-right.
              Positioned(
                top: 5,
                right: 5,
                child: _cornerButton(
                  icon: Icons.close_rounded,
                  tooltip: 'Close',
                  onTap: () =>
                      ref.read(videoMiniPlayerServiceProvider).close(),
                ),
              ),

              // Centre play/pause. Rebuilt off the controller itself so the
              // icon stays truthful when playback ends, stalls, or loops.
              Center(
                child: AnimatedBuilder(
                  animation: controller,
                  builder: (context, _) {
                    final playing = controller.value.isPlaying;
                    return GestureDetector(
                      onTap: () => ref
                          .read(videoMiniPlayerServiceProvider)
                          .togglePlayPause(),
                      behavior: HitTestBehavior.opaque,
                      child: Container(
                        width: 42,
                        height: 42,
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.5),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.25),
                          ),
                        ),
                        child: Icon(
                          playing
                              ? Icons.pause_rounded
                              : Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 24,
                        ),
                      ),
                    );
                  },
                ),
              ),

              // Title + progress along the bottom.
              Positioned(
                left: 8,
                right: 8,
                bottom: 6,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      service.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                      ),
                    ),
                    const SizedBox(height: 5),
                    AnimatedBuilder(
                      animation: controller,
                      builder: (context, _) {
                        final value = controller.value;
                        final total = value.duration.inMilliseconds;
                        final progress = total > 0
                            ? (value.position.inMilliseconds / total)
                                .clamp(0.0, 1.0)
                            : 0.0;
                        return ClipRRect(
                          borderRadius: BorderRadius.circular(2),
                          child: LinearProgressIndicator(
                            value: progress,
                            minHeight: 3,
                            backgroundColor:
                                Colors.white.withValues(alpha: 0.25),
                            valueColor: const AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
