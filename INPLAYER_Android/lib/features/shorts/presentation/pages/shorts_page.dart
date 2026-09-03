import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/utils/video_preview_gate.dart';
import '../../../../services/short_warm_cache.dart';
import '../../../../services/video_mini_player_service.dart';
import '../../../../services/video_service.dart';
import '../../../../models/short.dart';
import '../widgets/short_player_widget.dart';

class ShortsPage extends ConsumerStatefulWidget {
  final bool isActive;
  // Set when this page is opened from a deep link to one specific short
  // (e.g. a shared /shorts/{videoId} link) — once the shorts list loads,
  // the feed jumps straight to this video instead of starting at index 0.
  final String? startVideoId;

  /// What the back button does when this page is a TAB rather than a pushed
  /// route. Inside HomePage there is nothing on the navigator to pop back
  /// to — the shell is still the same route — so HomePage passes a callback
  /// that switches the selected tab back to Home instead. Null (the
  /// standalone pushed /shorts route) falls back to a normal pop.
  final VoidCallback? onExit;

  /// Height of the home shell's bottom navigation bar, which floats over
  /// this page because HomePage's Scaffold uses `extendBody: true`. Passed
  /// through to each ShortPlayerWidget so its bottom-anchored controls
  /// clear the bar instead of being hidden behind it. 0 for the standalone
  /// route, which has no bar over it.
  final double bottomInset;

  /// Bumped by HomePage whenever content-access or platform-update state
  /// changes, meaning the feed's contents may no longer be correct.
  ///
  /// This arrives as a plain field, NOT as part of this page's key, and
  /// that distinction is the whole point. HomePage used to fold the same
  /// value into `ValueKey('shorts-$feedRevision')`, so the instant either
  /// revision changed, Flutter treated this as a different widget and
  /// destroyed the entire feed — PageController, player, decoder and all —
  /// then rebuilt it from nothing. Landing on Raftaar triggers exactly the
  /// API calls that bump those revisions, so the page was routinely being
  /// torn down and recreated a second after you opened it, mid-playback.
  /// That teardown-and-restart is what the flicker was.
  ///
  /// Reacting to it as a field instead lets the feed simply re-fetch its
  /// list (see didUpdateWidget) while the current short keeps playing.
  final String feedRevision;

  const ShortsPage({
    super.key,
    this.isActive = true,
    this.startVideoId,
    this.onExit,
    this.bottomInset = 0,
    this.feedRevision = '',
  });

  @override
  ConsumerState<ShortsPage> createState() => _ShortsPageState();
}

class _ShortsPageState extends ConsumerState<ShortsPage> {
  late PageController _pageController;
  int _currentIndex = 0;
  List<Short>? _shorts;
  bool _isLoading = true;
  bool _hasError = false;

  /// Whether THIS page currently holds a feed-preview suspension, so the
  /// suspend/resume calls stay balanced no matter how the page is entered
  /// or left (tab toggle, deep link, dispose).
  bool _previewsSuspended = false;

  /// Holds off the next-short warm-up until the current one is playing
  /// steadily — see _warmNextShort.
  Timer? _warmDelayTimer;

  /// Feed previews are a second hardware video decoder running underneath
  /// this feed — see VideoPreviewGate.suspend for why a second decoder is
  /// what corrupted and stalled Raftaar playback. The feed owns the
  /// decoder while it is on screen and hands it back when it isn't.
  void _setPreviewSuspension(bool suspended) {
    if (suspended == _previewsSuspended) return;
    _previewsSuspended = suspended;
    if (suspended) {
      VideoPreviewGate.instance.suspend();
    } else {
      VideoPreviewGate.instance.resume();
    }
    // The floating mini-window is the OTHER second decoder that renders
    // over this feed — it sits in the home shell's Stack on every tab, so
    // a minimized 16:9 video keeps decoding underneath Raftaar unless it
    // is told to stand down. It also owns its own audio, which is what
    // made tapping a short to pause feel like it did nothing.
    // Guarded: this also runs from dispose(), where reading a provider can
    // throw if the container is already being torn down. Failing to resume
    // a mini window that is going away anyway is harmless; throwing here
    // would take the whole teardown with it.
    try {
      final miniPlayer = ref.read(videoMiniPlayerServiceProvider);
      if (suspended) {
        miniPlayer.suspendForFullscreenPlayer();
      } else {
        miniPlayer.releaseFullscreenSuspension();
      }
    } catch (_) {}
  }

  @override
  void initState() {
    super.initState();
    final cached = VideoService.cachedShorts;
    if (cached != null && cached.isNotEmpty) {
      _shorts = cached;
      _isLoading = false;
      if (widget.startVideoId != null && widget.startVideoId!.isNotEmpty) {
        final found = cached.indexWhere((s) => s.videoId == widget.startVideoId);
        if (found >= 0) {
          _currentIndex = found;
        }
      }
    }
    _pageController = PageController(initialPage: _currentIndex);
    _setPreviewSuspension(widget.isActive);
    _fetchShorts();
    // Cached shorts are already in hand on this path, so their posters can
    // start warming immediately rather than waiting on the network fetch.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _precacheUpcomingPosters();
    });
  }

  /// Warms the poster images for the current short and the next couple.
  ///
  /// This is image prefetch only — an HTTP fetch into the image cache. It
  /// deliberately does NOT create video controllers or touch a decoder,
  /// which is what made the earlier "preload the next video" attempts
  /// unsafe on some hardware. The payoff is that a card paints a real
  /// picture on its very first frame instead of showing a flat
  /// placeholder that pops to the thumbnail a moment later — that pop,
  /// repeated on every swipe, is what read as flickering before playback.
  void _precacheUpcomingPosters() {
    if (!mounted) return;
    final shorts = _shorts;
    if (shorts == null || shorts.isEmpty) return;
    for (var offset = 0; offset <= 2; offset++) {
      final index = _currentIndex + offset;
      if (index < 0 || index >= shorts.length) continue;
      final url = shortPosterUrl(shorts[index]);
      if (url.isEmpty || isDataImageUrl(url)) continue;
      precacheImage(CachedNetworkImageProvider(url), context);
    }
  }

  /// Warms the NEXT short's decoder, called only once the current short
  /// has actually rendered a frame (see ShortPlayerWidget.onFirstFrame).
  ///
  /// Unlike the poster prefetch above, this DOES allocate a hardware
  /// decoder — deliberately, and strictly one. ShortWarmCache enforces the
  /// cap; `kWarmNextShortEnabled` in that file turns the whole thing off.
  void _warmNextShort() {
    if (!mounted || !widget.isActive) return;
    // Deliberately NOT immediate.
    //
    // onFirstFrame fires as soon as the playhead passes ~80ms, which is
    // still inside the window where the decoder is filling its pipeline —
    // logcat shows the current short only managing ~23fps through its
    // first second before settling to ~29fps. Allocating a second decoder
    // in the middle of that steals bandwidth from the short you are
    // actually watching and shows up as stutter right after it starts.
    // Waiting until playback is genuinely steady moves the allocation
    // into quiet time, well before the next swipe needs it.
    _warmDelayTimer?.cancel();
    _warmDelayTimer = Timer(const Duration(milliseconds: 1600), () {
      if (!mounted || !widget.isActive) return;
      final shorts = _shorts;
      if (shorts == null) return;
      final nextIndex = _currentIndex + 1;
      if (nextIndex >= shorts.length) return;
      final next = shorts[nextIndex];
      final url = shortStreamUrl(next);
      if (url == null) return;
      unawaited(ShortWarmCache.instance.warm(next.videoId, Uri.parse(url)));
    });
  }

  @override
  void didUpdateWidget(covariant ShortsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    // Inside HomePage this page stays mounted when the user switches tabs,
    // so isActive — not dispose — is what tells us the feed is really off
    // screen and the home feed may preview again.
    if (widget.isActive != oldWidget.isActive) {
      _setPreviewSuspension(widget.isActive);
      // Leaving the feed: hand the warm decoder back rather than holding
      // hardware for a short nobody is going to watch.
      if (!widget.isActive) {
        _warmDelayTimer?.cancel();
        unawaited(ShortWarmCache.instance.discard());
      }
    }
    // Content access (or a platform update) changed what this feed is
    // allowed to show. Refresh the list in place — the shorts are keyed by
    // videoId, so anything still present keeps its state and the short
    // currently on screen carries on playing untouched.
    if (widget.feedRevision != oldWidget.feedRevision) {
      unawaited(_fetchShorts(forceRefresh: true));
    }
    // If deep link target changed while already loaded, jump straight to target index
    if (widget.startVideoId != null &&
        widget.startVideoId != oldWidget.startVideoId &&
        _shorts != null) {
      final index = _shorts!.indexWhere((s) => s.videoId == widget.startVideoId);
      if (index >= 0 && index != _currentIndex) {
        _currentIndex = index;
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_pageController.hasClients) {
            _pageController.jumpToPage(index);
          }
        });
      }
    }
  }

  Future<void> _fetchShorts({bool forceRefresh = false}) async {
    if (_shorts == null || forceRefresh) {
      setState(() {
        _isLoading = _shorts == null || _shorts!.isEmpty;
        _hasError = false;
      });
    }

    try {
      final shorts = await ref
          .read(videoServiceProvider)
          .getShorts(forceRefresh: forceRefresh);

      if (!mounted) return;

      int initialIndex = _currentIndex;
      final targetId = widget.startVideoId;
      if (targetId != null && targetId.isNotEmpty) {
        final found = shorts.indexWhere((s) => s.videoId == targetId);
        if (found >= 0) {
          initialIndex = found;
        }
      }

      setState(() {
        _shorts = shorts;
        _isLoading = false;
        _hasError = false;
        _currentIndex = initialIndex;
      });
      _precacheUpcomingPosters();

      if (_pageController.hasClients && _pageController.page?.round() != initialIndex) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_pageController.hasClients) {
            _pageController.jumpToPage(initialIndex);
          }
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _hasError = _shorts == null || _shorts!.isEmpty;
        });
      }
    }
  }

  @override
  void dispose() {
    _warmDelayTimer?.cancel();
    _setPreviewSuspension(false);
    unawaited(ShortWarmCache.instance.discard());
    _pageController.dispose();
    super.dispose();
  }

  /// Back out of the Raftaar feed.
  void _handleBack() {
    final onExit = widget.onExit;
    if (onExit != null) {
      onExit();
      return;
    }
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black, // Shorts background is always black
      body: Stack(
        children: [
          _buildBody(),
          // Back button.
          Positioned(
            top: 0,
            left: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.only(left: 10, top: 8),
                child: GestureDetector(
                  onTap: _handleBack,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.42),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.arrow_back_rounded,
                      color: Colors.white,
                      size: 21,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading && (_shorts == null || _shorts!.isEmpty)) {
      return Container(
        color: Colors.black,
        child: const Center(
          child: CircularProgressIndicator(color: AppColors.brandOrange),
        ),
      );
    }

    if (_hasError && (_shorts == null || _shorts!.isEmpty)) {
      return Container(
        color: Colors.black,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 48,
                color: AppColors.error,
              ),
              const SizedBox(height: 16),
              const Text(
                'Failed to load shorts',
                style: TextStyle(color: AppColors.textSecondaryDark),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => _fetchShorts(forceRefresh: true),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final shorts = _shorts ?? [];

    if (shorts.isEmpty) {
      return Container(
        color: Colors.black,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.play_circle_outline,
                size: 64,
                color: AppColors.textSecondaryDark.withValues(alpha: 0.5),
              ),
              const SizedBox(height: 16),
              const Text(
                'No shorts available',
                style: TextStyle(
                  color: AppColors.textSecondaryDark,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 12),
              ElevatedButton(
                onPressed: () => _fetchShorts(forceRefresh: true),
                child: const Text('Refresh'),
              ),
            ],
          ),
        ),
      );
    }

    return PageView.builder(
      controller: _pageController,
      physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
      scrollDirection: Axis.vertical,
      itemCount: shorts.length,
      onPageChanged: (index) {
        if (_currentIndex != index) {
          setState(() {
            _currentIndex = index;
          });
          // Keep running two ahead of the swipe.
          _precacheUpcomingPosters();
        }
      },
      itemBuilder: (context, index) {
        final short = shorts[index];
        final isCurrent = _currentIndex == index;
        // The site's signature swipe feel: neighbouring slides sit back at
        // 94% scale and dimmed, and grow into place over 500ms as they
        // become active —
        //   `transition-all duration-500 ease-out
        //    ${isActive ? "scale-100 opacity-100" : "scale-[0.94] opacity-60"}`
        // Without this the feed reads flat compared to the browser.
        //
        // The dimming is a black scrim, NOT an AnimatedOpacity, and that
        // difference is load-bearing. In a browser, `opacity` on a div that
        // already has its own compositing layer is close to free. In Flutter,
        // RenderOpacity at any alpha strictly between 0 and 255 pushes an
        // OpacityLayer, which forces its child — here a full-screen video
        // texture — to be rasterised offscreen for every frame of the
        // animation. Both the outgoing AND incoming slide were paying that
        // for 500ms on every single swipe, on the incoming one at exactly
        // the moment its decoder was starting up. That was the stutter that
        // survived every earlier fix.
        //
        // Against this page's black background, compositing content at 60%
        // opacity and laying 40% black over it are visually the same thing —
        // so the scrim buys back the identical look for an ordinary blended
        // paint with no offscreen layer at all. AnimatedScale is kept as-is:
        // a transform on a texture is a compositor matrix, not a rasterise.
        return AnimatedScale(
          scale: isCurrent ? 1.0 : 0.94,
          duration: const Duration(milliseconds: 500),
          curve: Curves.easeOut,
          child: Stack(
            fit: StackFit.expand,
            children: [
              ShortPlayerWidget(
                key: ValueKey(short.videoId),
                short: short,
                isActive: widget.isActive && isCurrent,
                bottomInset: widget.bottomInset,
                onFirstFrame: _warmNextShort,
                onMinimized: _handleBack,
              ),
              // Never intercept a tap: the player underneath owns every
              // gesture on the slide.
              IgnorePointer(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 500),
                  curve: Curves.easeOut,
                  color: isCurrent
                      ? Colors.transparent
                      : Colors.black.withValues(alpha: 0.4),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
