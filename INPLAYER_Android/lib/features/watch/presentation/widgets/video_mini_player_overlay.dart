import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../../services/video_mini_player_service.dart';

/// The small, draggable floating video window — the video equivalent of
/// mini_player_bar.dart's docked music bar, but a free-floating corner
/// window instead of a full-width dock (a video needs to stay visible
/// while you browse, the way YouTube's own mini player works, rather than
/// just a title/scrubber strip). Lives in home_page.dart's body Stack as a
/// bare, self-positioning child — same pattern as FloatingAIButton there —
/// so it persists across the 5 bottom-nav tabs exactly the way that button
/// and the music mini bar do. Renders nothing when nothing is minimized.
///
/// Defaults to the bottom-LEFT corner deliberately: FloatingAIButton
/// already docks bottom-right in this same Stack, and the two would
/// otherwise overlap on first appearance.
class VideoMiniPlayerOverlay extends ConsumerStatefulWidget {
  const VideoMiniPlayerOverlay({super.key});

  @override
  ConsumerState<VideoMiniPlayerOverlay> createState() => _VideoMiniPlayerOverlayState();
}

class _VideoMiniPlayerOverlayState extends ConsumerState<VideoMiniPlayerOverlay> {
  // Two shapes, because two kinds of thing can be minimized. A 16:9 watch
  // video gets the wider landscape window; a 9:16 Raftaar short gets a
  // narrower portrait one, so a vertical video isn't letterboxed into a
  // sliver inside a landscape box.
  static const _landscapeWidth = 160.0;
  static const _portraitWidth = 108.0;

  // Null until the viewer actually drags it — starts pinned near the
  // bottom-left, clear of both the bottom nav bar and FloatingAIButton.
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
    if (controller == null) return Container(color: Colors.black);

    // Music tracks render cover art rather than their raw decoded frame,
    // matching watch_page.dart's own _buildMediaSurface() split — full size
    // they're drawn by MusicStage, not VideoPlayer, so the frame is usually
    // blank. artUrl is empty for everything else.
    final art = service.artUrl;
    if (art.isNotEmpty) {
      return CachedNetworkImage(
        imageUrl: art,
        fit: BoxFit.cover,
        errorWidget: (context, url, error) => Container(color: Colors.black),
      );
    }
    if (!controller.value.isInitialized) return Container(color: Colors.black);
    return FittedBox(
      fit: BoxFit.cover,
      child: SizedBox(
        width: controller.value.size.width,
        height: controller.value.size.height,
        child: VideoPlayer(controller),
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

    // 84 mirrors FloatingAIButton's own "clear of the bottom nav" offset
    // in this same Stack; the extra headroom keeps a freshly-minimized
    // window from landing directly behind that button on first appearance.
    const clearOfNavBar = 84.0;
    final defaultOffset = Offset(16, screenSize.height - height - clearOfNavBar - 64);
    final raw = _dragOffset ?? defaultOffset;
    final left = raw.dx.clamp(8.0, screenSize.width - width - 8.0);
    // max() guards the portrait window on a short screen, where the window
    // can be taller than the space between the two clamps — without it the
    // lower bound would fall below the upper one and clamp() throws.
    final topMax = (screenSize.height - height - clearOfNavBar).clamp(40.0, double.infinity);
    final top = raw.dy.clamp(40.0, topMax);

    return Positioned(
      left: left,
      top: top,
      child: GestureDetector(
        onPanUpdate: (details) {
          setState(() => _dragOffset = (_dragOffset ?? defaultOffset) + details.delta);
        },
        onTap: () => _restore(context, service),
        child: Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.45),
                blurRadius: 20,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox.expand(child: _buildSurface(service)),

              // Tap-through-looking play/pause hint — mirrors PlayerChrome's
              // own center icon, shown only while actually paused.
              AnimatedBuilder(
                animation: controller,
                builder: (context, _) {
                  if (controller.value.isPlaying) return const SizedBox.shrink();
                  return Container(
                    color: Colors.black.withValues(alpha: 0.25),
                    child: const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 30),
                  );
                },
              ),

              Positioned(
                top: 2,
                right: 2,
                child: GestureDetector(
                  onTap: () => ref.read(videoMiniPlayerServiceProvider).close(),
                  child: Container(
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.55),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.close_rounded, color: Colors.white, size: 14),
                  ),
                ),
              ),

              Positioned(
                left: 4,
                right: 24,
                bottom: 4,
                child: Text(
                  service.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    shadows: [Shadow(color: Colors.black, blurRadius: 4)],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
