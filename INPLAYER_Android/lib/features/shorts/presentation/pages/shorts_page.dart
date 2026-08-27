import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
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

  const ShortsPage({
    super.key,
    this.isActive = true,
    this.startVideoId,
    this.onExit,
    this.bottomInset = 0,
  });

  @override
  ConsumerState<ShortsPage> createState() => _ShortsPageState();
}

class _ShortsPageState extends ConsumerState<ShortsPage> {
  final PageController _pageController = PageController();
  int _currentIndex = 0;
  late Future<List<Short>> _shortsFuture;

  @override
  void initState() {
    super.initState();
    _loadShorts();
  }

  void _loadShorts() {
    _shortsFuture = ref.read(videoServiceProvider).getShorts();
    final targetId = widget.startVideoId;
    if (targetId != null && targetId.isNotEmpty) {
      _shortsFuture = _shortsFuture.then((shorts) {
        final index = shorts.indexWhere((s) => s.videoId == targetId);
        if (index > 0) {
          _currentIndex = index;
          // Jump once the PageView has laid out its first frame — jumping
          // during the same build that creates the controller has no page
          // to jump on yet.
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (_pageController.hasClients) {
              _pageController.jumpToPage(index);
            }
          });
        }
        return shorts;
      });
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// Back out of the Raftaar feed.
  ///
  /// Two different exits, because this page shows up two different ways.
  /// As a tab inside HomePage there is nothing to pop — the route never
  /// changed — so HomePage hands down an [onExit] that just flips the
  /// selected tab back to Home. As a pushed route (a shared /shorts link)
  /// a normal pop is right, with a go('/') fallback for the case where the
  /// app was cold-started straight onto that deep link and there is no
  /// history behind it.
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
          _buildFeed(),
          // Back button. Sits in the page Stack rather than inside
          // ShortPlayerWidget so it stays perfectly still while the cards
          // underneath scale, tilt and fade through the swipe transform —
          // and so there is exactly one of it rather than one per card.
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
                      // Same circular scrim the watch player's back button
                      // uses, so it stays legible over a bright frame.
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

  Widget _buildFeed() {
    return FutureBuilder<List<Short>>(
        future: _shortsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange),
            );
          }

          if (snapshot.hasError) {
            return Center(
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
                  const SizedBox(height: 8),
                  ElevatedButton(
                    onPressed: () => setState(() {}),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            );
          }

          final shorts = snapshot.data ?? [];

          if (shorts.isEmpty) {
            return Center(
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
                ],
              ),
            );
          }

          // Tinder-style horizontal swipe (not YouTube's vertical scroll) —
          // cards visibly shrink, tilt, and fade as they're swiped away.
          // Re-applied here: this had shipped once already, but the live
          // device copy of this file had reverted to a plain vertical
          // PageView with no transform (an apparent regression from
          // concurrent edits by another AI tool active in this same repo),
          // confirmed by reading the file fresh before this edit.
          return PageView.builder(
            controller: _pageController,
            scrollDirection: Axis.horizontal,
            itemCount: shorts.length,
            onPageChanged: (index) {
              setState(() {
                _currentIndex = index;
              });
            },
            itemBuilder: (context, index) {
              final short = shorts[index];
              return AnimatedBuilder(
                animation: _pageController,
                builder: (context, child) {
                  // hasClients guards .page — it throws if read before the
                  // PageView has attached to this controller (e.g. the very
                  // first build). .page itself is still null until the
                  // first layout pass has run, hence the extra fallback.
                  double page = _currentIndex.toDouble();
                  if (_pageController.hasClients) {
                    page = _pageController.page ?? page;
                  }
                  final delta = page - index;
                  final scale = (1 - delta.abs() * 0.12).clamp(0.85, 1.0);
                  final angle = delta * -0.15;
                  final opacity = (1 - delta.abs() * 0.6).clamp(0.35, 1.0);

                  return Transform.scale(
                    scale: scale,
                    child: Transform.rotate(
                      angle: angle,
                      child: Opacity(opacity: opacity, child: child),
                    ),
                  );
                },
                child: ShortPlayerWidget(
                  short: short,
                  isActive: widget.isActive && _currentIndex == index,
                  bottomInset: widget.bottomInset,
                  // Once the player is floating in the corner window there
                  // is no reason to still be sitting on the full-screen
                  // feed, so leaving is the same action as backing out.
                  onMinimized: _handleBack,
                ),
              );
            },
          );
        },
    );
  }
}
