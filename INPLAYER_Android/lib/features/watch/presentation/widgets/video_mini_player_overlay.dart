import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/router/app_router.dart';
import '../../../../core/router/pageless_route_observer.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../services/platform_settings_service.dart';
import '../../../../services/video_mini_player_service.dart';

/// The floating video window — the video equivalent of mini_player_bar.dart's
/// docked music bar, but a free-floating window instead of a full-width dock
/// (a video needs to stay visible while you browse, the way YouTube's own
/// mini player works). Mounted app-wide in main.dart's MaterialApp.router
/// builder, above the Navigator, so it persists across every screen — it
/// used to live only in HomePage and vanished whenever a video was minimized
/// from search/channel/notifications or any page was opened over Home.
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

  /// The window lives above the Navigator, so it has to hide itself while a
  /// full-screen player route is on top, and while a dialog / bottom sheet /
  /// Navigator.push()ed screen covers the page — otherwise it would float
  /// over those and steal their taps. There is also no InheritedGoRouter up
  /// here, so navigation goes through the router instance, not context.push.
  late final GoRouter _router = ref.read(routerProvider);
  bool _onFullscreenRoute = false;
  bool _coveredByPageless = false;

  @override
  void initState() {
    super.initState();
    _router.routerDelegate.addListener(_onRouteChanged);
    pagelessRouteObserver.covered.addListener(_onRouteChanged);
    pagelessRouteObserver.drawerOpen.addListener(_onRouteChanged);
    _onRouteChanged();
  }

  @override
  void dispose() {
    _router.routerDelegate.removeListener(_onRouteChanged);
    pagelessRouteObserver.covered.removeListener(_onRouteChanged);
    pagelessRouteObserver.drawerOpen.removeListener(_onRouteChanged);
    super.dispose();
  }

  void _onRouteChanged() {
    // lastOrNull.matchedLocation reflects pushed routes too (a push leaves
    // RouteMatchList.uri unchanged in go_router 16).
    final loc =
        _router
            .routerDelegate
            .currentConfiguration
            .lastOrNull
            ?.matchedLocation ??
        '';
    final hide = loc.startsWith('/watch/') || loc.startsWith('/shorts');
    final covered =
        pagelessRouteObserver.covered.value ||
        pagelessRouteObserver.drawerOpen.value;
    if (hide == _onFullscreenRoute && covered == _coveredByPageless) return;
    _onFullscreenRoute = hide;
    _coveredByPageless = covered;
    // Delegate/observer notifications can arrive mid-build; rebuild after.
    Future.microtask(() {
      if (mounted) setState(() {});
    });
  }

  void _restore(BuildContext context, VideoMiniPlayerService service) {
    final route = service.restoreRoute;
    if (service.kind == MiniPlayerKind.video) {
      final controller = service.detachForRestore();
      if (controller == null) return;
      // The /watch/:videoId route (app_router.dart) reads this exact
      // controller back out via `state.extra` — WatchPage's `adoptController`
      // param then skips creating a new one, so playback continues from
      // whatever position/play-state it's already at instead of restarting.
      _router.push(route, extra: controller);
      return;
    }
    // Shorts: no controller handoff exists (see VideoMiniPlayerService.close
    // for why), so tear this one down and let the feed build a fresh one at
    // that video. The short restarts.
    service.close();
    _router.push(route);
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
      return SafeAppImage(
        imageUrl: art,
        fit: BoxFit.cover,
        errorWidget: (context, url, error) =>
            const ColoredBox(color: Colors.black),
      );
    }
    if (!controller.value.isInitialized) {
      return const ColoredBox(color: Colors.black);
    }
    return Container(
      color: Colors.black,
      alignment: Alignment.center,
      child: Center(
        child: AspectRatio(
          aspectRatio: controller.value.aspectRatio > 0
              ? controller.value.aspectRatio
              : (16 / 9),
          child: VideoPlayer(controller),
        ),
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
    // Semantics, not Tooltip: this widget is mounted above the Navigator,
    // where there is no Overlay ancestor, and Tooltip's OverlayPortal would
    // throw ("No Overlay widget found").
    return Semantics(
      label: tooltip,
      button: true,
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
    if (!service.isActive || _onFullscreenRoute || _coveredByPageless) {
      return const SizedBox.shrink();
    }
    // Now that the window floats over every screen, the on-screen keyboard
    // pushes text fields (chat composer, search box, comment box...) up into
    // where it sits, and it would take their taps — e.g. Send. Step aside
    // while typing.
    if (MediaQuery.viewInsetsOf(context).bottom > 0) {
      return const SizedBox.shrink();
    }
    // HomePage's maintenance screen blocks the app; the window must not
    // float over it (tapping it would reopen /watch around the block).
    // valueOrNull, not value: this sits above every route, and value would
    // rethrow here if the settings request had failed.
    final maintenance =
        ref
            .watch(publicPlatformSettingsProvider)
            .valueOrNull
            ?.maintenanceMode ??
        false;
    if (maintenance) return const SizedBox.shrink();

    final controller = service.controller!;
    final screenSize = MediaQuery.of(context).size;

    final width = service.isPortrait ? _portraitWidth : _landscapeWidth;
    final height = service.isPortrait ? width * 16 / 9 : width * 9 / 16;
    // Android PiP / split-screen can make the whole Flutter view smaller than
    // this window; the clamps below would then throw (upper < lower).
    if (screenSize.width < width + 16 || screenSize.height < height + 64) {
      return const SizedBox.shrink();
    }

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
    final safe = MediaQuery.of(context).viewPadding;
    final topMin = safe.top + 8.0;
    // Keep clear of Home's bottom nav bar (~88) + docked music bar (~64):
    // they are painted over the page, so a window dragged lower had its
    // title/progress/play button covered and its taps taken by the nav items.
    final topMax = (screenSize.height - height - safe.bottom - 152.0).clamp(
      topMin,
      double.infinity,
    );
    final top = raw.dy.clamp(topMin, topMax);

    return Positioned(
      left: left,
      top: top,
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
        // Above the Navigator there is no Material/Scaffold, so Text would
        // inherit MaterialApp's error DefaultTextStyle (yellow double
        // underline). A transparency Material fixes that and absorbs no taps.
        child: Material(
          type: MaterialType.transparency,
          child: MediaQuery.withNoTextScaling(
            child: Stack(
              children: [
                Positioned.fill(
                  child: GestureDetector(
                    // Drag anywhere on the background surface to reposition the
                    // window. Living here — a sibling of the corner and centre
                    // buttons, not their ancestor — keeps the pan recognizer
                    // out of the buttons' gesture arena, so a fingertip's tiny
                    // movement on a button can no longer let the drag win and
                    // swallow the tap.
                    onPanUpdate: (details) {
                      setState(
                        () => _dragOffset =
                            (_dragOffset ?? defaultOffset) + details.delta,
                      );
                    },
                    onTap: () => _restore(context, service),
                    behavior: HitTestBehavior.opaque,
                    child: _buildSurface(service),
                  ),
                ),

                // Scrims so the controls stay legible over any frame.
                const Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 44,
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
                  height: 48,
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
                  top: 6,
                  left: 6,
                  child: _cornerButton(
                    icon: Icons.open_in_full_rounded,
                    tooltip: 'Expand',
                    size: 28,
                    iconSize: 15,
                    onTap: () => _restore(context, service),
                  ),
                ),

                // Close — top-right.
                Positioned(
                  top: 6,
                  right: 6,
                  child: _cornerButton(
                    icon: Icons.close_rounded,
                    tooltip: 'Close',
                    size: 28,
                    iconSize: 16,
                    onTap: () =>
                        ref.read(videoMiniPlayerServiceProvider).close(),
                  ),
                ),

                // Centre play/pause. Sized neatly (36x36) so it NEVER overlaps
                // with top corner buttons or bottom title bar in any aspect ratio.
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
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: Colors.black.withValues(alpha: 0.65),
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.35),
                              width: 1.2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withValues(alpha: 0.4),
                                blurRadius: 8,
                              ),
                            ],
                          ),
                          child: Icon(
                            playing
                                ? Icons.pause_rounded
                                : Icons.play_arrow_rounded,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                      );
                    },
                  ),
                ),

                // Title + progress along the bottom.
                Positioned(
                  left: 10,
                  right: 10,
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
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          height: 1.2,
                          shadows: [
                            Shadow(color: Colors.black, blurRadius: 4),
                            Shadow(color: Colors.black, blurRadius: 8),
                          ],
                        ),
                      ),
                      const SizedBox(height: 4),
                      AnimatedBuilder(
                        animation: controller,
                        builder: (context, _) {
                          final value = controller.value;
                          final total = value.duration.inMilliseconds;
                          final progress = total > 0
                              ? (value.position.inMilliseconds / total).clamp(
                                  0.0,
                                  1.0,
                                )
                              : 0.0;
                          return ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: LinearProgressIndicator(
                              value: progress,
                              minHeight: 2.5,
                              backgroundColor: Colors.white.withValues(
                                alpha: 0.25,
                              ),
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
      ),
    );
  }
}
