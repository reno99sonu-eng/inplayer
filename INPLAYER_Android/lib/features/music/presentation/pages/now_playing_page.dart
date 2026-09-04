import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:just_audio/just_audio.dart' show LoopMode;

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/music_track_utils.dart';
import '../../../../core/utils/share_utils.dart';
import '../../../../models/video.dart';
import '../../../../services/download_manager.dart';
import '../../../../services/download_service.dart';
import '../../../../services/like_service.dart';
import '../../../../services/music_player_service.dart';
import '../../../../services/premium_service.dart';
import '../../../watch/presentation/widgets/video_options_sheet.dart';
import '../widgets/mini_equalizer.dart';

/// The dedicated full-screen music player — deliberately NOT a Spotify
/// reskin. Two things make it different: it reads the app's real
/// light/dark/system theme instead of forcing a fixed black canvas (a
/// warm frosted wash in light mode, a deep obsidian one in dark mode,
/// both derived from the same theme tokens the rest of the app uses), and
/// the backdrop is the track's own blurred cover art with a slow
/// breathing glow behind the sleeve rather than a flat background.
///
/// Reads everything from the ambient [musicPlayerServiceProvider] — no
/// constructor arguments — so it can be opened the same way from the mini
/// player, a track tile, or anywhere else without threading a videoId
/// through a route.
class NowPlayingPage extends ConsumerStatefulWidget {
  const NowPlayingPage({super.key});

  @override
  ConsumerState<NowPlayingPage> createState() => _NowPlayingPageState();
}

class _NowPlayingPageState extends ConsumerState<NowPlayingPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _glowController;
  final ScrollController _lyricsScroll = ScrollController();
  int _lastLyricIndex = -1;

  /// Position, in ms, that the finger is currently holding on the scrubber —
  /// null when not scrubbing. While non-null the slider follows this instead
  /// of the position stream, so the thumb cannot be yanked back mid-drag.
  double? _dragMs;

  bool _downloadBusy = false;

  @override
  void initState() {
    super.initState();
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _glowController.dispose();
    _lyricsScroll.dispose();
    super.dispose();
  }

  void _scrollLyricsTo(int index) {
    if (index == _lastLyricIndex || !_lyricsScroll.hasClients || index < 0) {
      return;
    }
    _lastLyricIndex = index;
    const itemExtent = 46.0;
    final target = (index * itemExtent) - 120.0;
    _lyricsScroll.animateTo(
      target.clamp(0.0, _lyricsScroll.position.maxScrollExtent),
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  Future<void> _toggleLike(Video track) async {
    final likeService = ref.read(likeServiceProvider);
    final status = await likeService.getStatus(track.videoId);
    final currentlyLiked = status['myReaction'] == 'like';
    await likeService.react(track.videoId, currentlyLiked ? 'remove' : 'like');
    if (mounted) setState(() {});
  }

  Future<void> _toggleDislike(Video track) async {
    final likeService = ref.read(likeServiceProvider);
    final status = await likeService.getStatus(track.videoId);
    final currentlyDisliked = status['myReaction'] == 'dislike';
    await likeService.react(
      track.videoId,
      currentlyDisliked ? 'remove' : 'dislike',
    );
    if (mounted) setState(() {});
  }

  Future<void> _handleDownload(Video track) async {
    if (_downloadBusy) return;
    setState(() => _downloadBusy = true);

    try {
      final premium = await ref.read(premiumServiceProvider).getStatus();
      if (!premium.premium) {
        if (!mounted) return;
        await _showPremiumRequiredSheet();
        return;
      }

      final downloadService = ref.read(downloadServiceProvider);
      final manager = ref.read(downloadManagerProvider);

      if (manager.isDownloaded(track.videoId) ||
          manager.taskFor(track.videoId) != null) {
        return;
      }

      final prep = await downloadService.prepareDownload(track.videoId);
      if (prep.status == 'unavailable' || prep.status == 'error') {
        _showSnack(
          prep.error ??
              "Couldn't prepare this track for offline listening right now.",
        );
        return;
      }

      final status = await downloadService.checkDownloadStatus(track.videoId);
      final rendition = status.renditions['audio-only'];
      if (status.downloadStatus == 'ready' && rendition != null) {
        await manager.download(
          video: track,
          quality: 'audio-only',
          fileName: rendition,
        );
      } else {
        _showSnack(
          "Still preparing this track for offline listening — try again in a moment.",
        );
      }
    } catch (_) {
      _showSnack("Couldn't start the download. Please try again.");
    } finally {
      if (mounted) setState(() => _downloadBusy = false);
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: context.isDark
            ? AppColors.surfaceDark
            : AppColors.surfaceLight,
      ),
    );
  }

  Future<void> _showPremiumRequiredSheet() async {
    await showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(24, 28, 24, 36),
        decoration: BoxDecoration(
          color: ctx.bgModal,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: ctx.borderSubtle),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(
              Icons.workspace_premium_rounded,
              color: AppColors.brandGold,
              size: 30,
            ),
            const SizedBox(height: 12),
            Text(
              'Offline listening is a Premium feature',
              style: TextStyle(
                color: ctx.textPrimary,
                fontSize: 17,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Download tracks to listen without a connection with an InPlayer Premium plan.',
              style: TextStyle(
                color: ctx.textSecondary,
                fontSize: 13,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brandOrange,
              ),
              onPressed: () {
                Navigator.pop(ctx);
                Navigator.of(context, rootNavigator: true).pop();
                context.push('/settings/plans');
              },
              child: const Text(
                'View Plans',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _openQueueSheet(BuildContext context, MusicPlayerService player) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) {
        // A modal sheet is its own route, so the `ref.watch` in this page's
        // build() does NOT rebuild it. Without this Consumer the queue was
        // frozen: removing a track, reordering, or jumping to another song
        // all fired correctly but left the visible list unchanged, which
        // read as the queue being completely broken.
        return Consumer(
          builder: (ctx, ref, _) {
            final player = ref.watch(musicPlayerServiceProvider);
            return DraggableScrollableSheet(
          initialChildSize: 0.6,
          maxChildSize: 0.9,
          minChildSize: 0.4,
          expand: false,
          builder: (context, scrollController) {
            return Container(
              decoration: BoxDecoration(
                color: context.bgModal,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
                border: Border.all(color: context.borderSubtle),
              ),
              child: Column(
                children: [
                  const SizedBox(height: 12),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: context.textDim.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 14, 20, 8),
                    child: Row(
                      children: [
                        Text(
                          'Up Next',
                          style: TextStyle(
                            color: context.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const Spacer(),
                        Text(
                          '${player.queue.length} tracks',
                          style: TextStyle(
                            color: context.textDim,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 6),
                    child: Text(
                      'Drag to reorder — the track playing now stays pinned in place.',
                      style: TextStyle(color: context.textDim, fontSize: 11),
                    ),
                  ),
                  Expanded(
                    child: ReorderableListView.builder(
                      scrollController: scrollController,
                      buildDefaultDragHandles: false,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 4,
                      ),
                      itemCount: player.queue.length,
                      // onReorder is deprecated as of Flutter 3.41 in
                      // favour of onReorderItem, which hands back a newIndex
                      // that has ALREADY been corrected for the item lifted
                      // out at oldIndex. Exactly one of the two may be given.
                      //
                      // MusicPlayerService.reorderQueue still speaks the old
                      // raw convention — it does that correction itself, and
                      // it is shared — so the correction is undone here
                      // rather than changing a service contract for one call
                      // site. Dragging down: raw = new + 1; dragging up: raw
                      // = new; equal is a no-op either way.
                      onReorderItem: (oldIndex, newIndex) {
                        final rawIndex = oldIndex < newIndex
                            ? newIndex + 1
                            : newIndex;
                        ref
                            .read(musicPlayerServiceProvider)
                            .reorderQueue(oldIndex, rawIndex);
                      },
                      itemBuilder: (context, i) {
                        final t = player.queue[i];
                        final isCurrent = i == player.currentIndex;
                        return ListTile(
                          key: ValueKey('queue_${i}_${t.videoId}'),
                          onTap: () {
                            ref.read(musicPlayerServiceProvider).jumpTo(i);
                          },
                          leading: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: SizedBox(
                              width: 40,
                              height: 40,
                              child:
                                  (t.covers.isNotEmpty
                                          ? t.covers.first
                                          : t.thumbnail)
                                      .isNotEmpty
                                  ? CachedNetworkImage(
                                      imageUrl: t.covers.isNotEmpty
                                          ? t.covers.first
                                          : t.thumbnail,
                                      fit: BoxFit.cover,
                                    )
                                  : Container(
                                      color: AppColors.music.withValues(
                                        alpha: 0.25,
                                      ),
                                    ),
                            ),
                          ),
                          title: Text(
                            t.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: isCurrent
                                  ? AppColors.brandOrangeLight
                                  : context.textPrimary,
                              fontWeight: isCurrent
                                  ? FontWeight.w800
                                  : FontWeight.w600,
                              fontSize: 13,
                            ),
                          ),
                          subtitle: Text(
                            t.artist?.isNotEmpty == true
                                ? t.artist!
                                : t.creator,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: context.textSecondary,
                              fontSize: 11,
                            ),
                          ),
                          trailing: isCurrent
                              ? MiniEqualizer(
                                  playing: player.isPlaying,
                                  height: 18,
                                )
                              : Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    IconButton(
                                      padding: EdgeInsets.zero,
                                      constraints: const BoxConstraints(
                                        minWidth: 30,
                                        minHeight: 30,
                                      ),
                                      icon: Icon(
                                        Icons.close_rounded,
                                        color: context.textDim,
                                        size: 18,
                                      ),
                                      onPressed: () => ref
                                          .read(musicPlayerServiceProvider)
                                          .removeFromQueue(i),
                                    ),
                                    ReorderableDragStartListener(
                                      index: i,
                                      child: Icon(
                                        Icons.drag_handle_rounded,
                                        color: context.textDim,
                                        size: 20,
                                      ),
                                    ),
                                  ],
                                ),
                        );
                      },
                    ),
                  ),
                ],
              ),
            );
          },
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final player = ref.watch(musicPlayerServiceProvider);
    final track = player.currentTrack;
    final isDark = context.isDark;

    if (track == null) {
      // Guard against the sheet staying open through a stop() elsewhere.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).maybePop();
      });
      return const SizedBox.shrink();
    }

    final coverUrl = track.covers.isNotEmpty
        ? track.covers.first
        : track.thumbnail;

    return Scaffold(
      backgroundColor: context.bgCanvas,
      body: Stack(
        fit: StackFit.expand,
        children: [
          if (coverUrl.isNotEmpty)
            Positioned.fill(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 900),
                child: CachedNetworkImage(
                  key: ValueKey(coverUrl),
                  imageUrl: coverUrl,
                  fit: BoxFit.cover,
                ),
              ),
            )
          else
            Positioned.fill(child: Container(color: context.bgCanvas)),
          // Theme-adaptive wash — a warm parchment tint in light mode, an
          // obsidian one in dark mode, both derived from the same tokens
          // the rest of the app uses. This (not a fixed black canvas) is
          // the deliberate departure from the usual dark-only music-player
          // convention.
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 44, sigmaY: 44),
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: isDark
                        ? [
                            AppColors.backgroundDark.withValues(alpha: 0.75),
                            AppColors.canvasDark.withValues(alpha: 0.88),
                            Colors.black.withValues(alpha: 0.92),
                          ]
                        : [
                            AppColors.backgroundLight.withValues(alpha: 0.80),
                            AppColors.canvasLight.withValues(alpha: 0.90),
                            AppColors.surfaceLight.withValues(alpha: 0.95),
                          ],
                  ),
                ),
              ),
            ),
          ),
          SafeArea(
            child: Column(
              children: [
                _buildTopBar(context, player),
                Expanded(
                  child: SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    padding: const EdgeInsets.symmetric(horizontal: 18),
                    child: Column(
                      children: [
                        const SizedBox(height: 8),
                        _buildSleeve(context, coverUrl),
                        const SizedBox(height: 16),
                        _buildTitleRow(context, track),
                        const SizedBox(height: 16),
                        _buildScrubber(context, player),
                        const SizedBox(height: 6),
                        _buildTransport(context, player),
                        const SizedBox(height: 16),
                        _buildSecondaryActions(context, player, track),
                        if (track.lyrics.isNotEmpty) ...[
                          const SizedBox(height: 20),
                          _buildLyricsSection(context, player, track),
                        ],
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopBar(BuildContext context, MusicPlayerService player) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 4, 12, 0),
      child: Row(
        children: [
          // Was a bare, backdrop-less icon sitting directly on a
          // photographic cover-art background — on a bright/busy cover it
          // could disappear into the image entirely, reading as "no back
          // button." Given a real circular backdrop (matching the pattern
          // already used for header icons elsewhere, e.g. home_page.dart's
          // _buildHeaderIcon) so it's always visible regardless of what's
          // behind it. Pop now also explicitly targets the root navigator,
          // matching the `rootNavigator: true` this page was pushed with in
          // mini_player_bar.dart, so a stray nested-Navigator resolution
          // can't make the tap silently do nothing.
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: (context.isDark ? Colors.black : Colors.white).withValues(
                alpha: 0.28,
              ),
              border: Border.all(color: context.borderSubtle),
            ),
            child: IconButton(
              padding: EdgeInsets.zero,
              icon: Icon(
                Icons.keyboard_arrow_down_rounded,
                color: context.textPrimary,
                size: 26,
              ),
              onPressed: () =>
                  Navigator.of(context, rootNavigator: true).maybePop(),
            ),
          ),
          Expanded(
            child: Center(
              child: Text(
                'NOW PLAYING',
                style: TextStyle(
                  color: context.textDim,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 2,
                ),
              ),
            ),
          ),
          IconButton(
            icon: Icon(
              Icons.queue_music_rounded,
              color: context.textPrimary,
              size: 24,
            ),
            onPressed: () => _openQueueSheet(context, player),
          ),
          IconButton(
            icon: Icon(
              Icons.tune_rounded,
              color: context.textPrimary,
              size: 22,
            ),
            tooltip: 'Player settings',
            onPressed: () => context.push('/settings/music'),
          ),
        ],
      ),
    );
  }

  Widget _buildSleeve(BuildContext context, String coverUrl) {
    return AnimatedBuilder(
      animation: _glowController,
      builder: (context, child) {
        final glow = 0.25 + (_glowController.value * 0.20);
        return Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppColors.brandOrange.withValues(alpha: glow),
                blurRadius: 46,
                spreadRadius: 2,
              ),
              BoxShadow(
                color: Colors.black.withValues(
                  alpha: context.isDark ? 0.5 : 0.18,
                ),
                blurRadius: 30,
                offset: const Offset(0, 18),
              ),
            ],
          ),
          child: child,
        );
      },
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: AspectRatio(
          aspectRatio: 1,
          child: coverUrl.isNotEmpty
              ? CachedNetworkImage(imageUrl: coverUrl, fit: BoxFit.cover)
              : Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFFE8590C), Color(0xFF1E1E1E)],
                    ),
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.music_note_rounded,
                      color: Colors.white70,
                      size: 64,
                    ),
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildTitleRow(BuildContext context, Video track) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                track.title.isEmpty ? 'Untitled track' : track.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: context.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 4),
              GestureDetector(
                onTap:
                    track.uploaderUsername != null &&
                        track.uploaderUsername!.isNotEmpty
                    ? () {
                        Navigator.of(context, rootNavigator: true).maybePop();
                        context.push(
                          '/channel/${Uri.encodeComponent(track.uploaderUsername!)}',
                        );
                      }
                    : null,
                child: Text(
                  track.artist?.isNotEmpty == true
                      ? track.artist!
                      : track.creator,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: context.textSecondary,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
        IconButton(
          icon: Icon(
            Icons.more_horiz_rounded,
            color: context.textSecondary,
            size: 26,
          ),
          onPressed: () => showVideoOptionsSheet(context, track),
        ),
      ],
    );
  }

  Widget _buildScrubber(BuildContext context, MusicPlayerService player) {
    // Duration is watched as a STREAM rather than read as a plain getter.
    // Read as a getter inside a builder driven only by positionStream, it is
    // whatever it happened to be at the last position tick — so on a track
    // change, where the playhead resets a beat before the new length
    // arrives, the bar was briefly drawn against the PREVIOUS track's
    // duration.
    return StreamBuilder<Duration?>(
      stream: player.durationStream,
      builder: (context, durSnapshot) {
        return StreamBuilder<Duration>(
          stream: player.positionStream,
          builder: (context, snapshot) {
        final pos = snapshot.data ?? Duration.zero;
        final dur = durSnapshot.data ?? player.duration ?? Duration.zero;
        final hasDuration = dur.inMilliseconds > 0;
        final maxMs = hasDuration ? dur.inMilliseconds.toDouble() : 1.0;
        // While a drag is in progress the thumb follows the finger, NOT the
        // position stream. Letting the stream drive it mid-drag is what made
        // the thumb rubber-band back under your finger.
        //
        // The `hasDuration` guard on the fallback is load-bearing and was
        // missing: with no duration yet, maxMs is 1.0, so clamping the
        // position into 0..1 gave 1 for any playhead past a single
        // millisecond — against a slider whose max is also 1. The bar
        // therefore rendered COMPLETELY FULL for the whole window before
        // duration resolved, and stayed full forever on any stream that
        // never reported one. Showing nothing is the honest answer while
        // the length is unknown.
        final value = _dragMs ??
            (hasDuration
                ? pos.inMilliseconds.clamp(0, maxMs.toInt()).toDouble()
                : 0.0);

        return Column(
          children: [
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                trackHeight: 3,
                activeTrackColor: AppColors.brandOrange,
                inactiveTrackColor: context.borderMedium,
                thumbColor: Colors.white,
                thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                overlayShape: const RoundSliderOverlayShape(overlayRadius: 14),
              ),
              child: Slider(
                min: 0,
                max: maxMs,
                value: value.clamp(0.0, maxMs),
                // Seek ONCE, on release. This used to call seek() on every
                // drag update, firing a storm of seeks at the audio backend
                // and stuttering playback while scrubbing.
                onChanged: hasDuration
                    ? (v) => setState(() => _dragMs = v)
                    : null,
                onChangeStart: hasDuration
                    ? (v) => setState(() => _dragMs = v)
                    : null,
                onChangeEnd: hasDuration
                    ? (v) {
                        player.seek(Duration(milliseconds: v.round()));
                        setState(() => _dragMs = null);
                      }
                    : null,
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    // Show where the finger is while scrubbing.
                    _fmt(_dragMs != null
                        ? Duration(milliseconds: _dragMs!.round())
                        : pos),
                    style: TextStyle(
                      color: context.textDim,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    _fmt(dur),
                    style: TextStyle(
                      color: context.textDim,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
          },
        );
      },
    );
  }

  String _fmt(Duration d) {
    if (d.isNegative || d == Duration.zero) return '0:00';
    final h = d.inHours;
    final m = d.inMinutes % 60;
    final s = d.inSeconds % 60;
    final ss = s.toString().padLeft(2, '0');
    // Without the hours branch a 65-minute track rendered as "65:03".
    if (h > 0) return '$h:${m.toString().padLeft(2, '0')}:$ss';
    return '$m:$ss';
  }

  Widget _buildTransport(BuildContext context, MusicPlayerService player) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
      children: [
        IconButton(
          icon: Icon(
            Icons.shuffle_rounded,
            color: player.isShuffled
                ? AppColors.brandOrangeLight
                : context.textSecondary,
            size: 20,
          ),
          onPressed: () => player.toggleShuffle(),
        ),
        IconButton(
          icon: Icon(
            Icons.skip_previous_rounded,
            color: context.textPrimary,
            size: 34,
          ),
          onPressed: () => player.previous(),
        ),
        Container(
          width: 68,
          height: 68,
          decoration: const BoxDecoration(
            gradient: AppColors.flameGradient,
            shape: BoxShape.circle,
          ),
          child: IconButton(
            icon: Icon(
              player.isBuffering
                  ? Icons.hourglass_top_rounded
                  : (player.isPlaying
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded),
              color: Colors.white,
              size: 34,
            ),
            onPressed: player.isBuffering
                ? null
                : () => player.togglePlayPause(),
          ),
        ),
        IconButton(
          icon: Icon(
            Icons.skip_next_rounded,
            color: context.textPrimary,
            size: 34,
          ),
          onPressed: () => player.next(),
        ),
        IconButton(
          icon: Icon(
            player.loopMode == LoopMode.one
                ? Icons.repeat_one_rounded
                : Icons.repeat_rounded,
            color: player.loopMode != LoopMode.off
                ? AppColors.brandOrangeLight
                : context.textSecondary,
            size: 20,
          ),
          onPressed: () => player.cycleRepeatMode(),
        ),
      ],
    );
  }

  void _showSpeedSelector(BuildContext context, MusicPlayerService player) {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0];
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        decoration: BoxDecoration(
          color: ctx.bgModal,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: ctx.borderSubtle),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Playback Speed',
              style: TextStyle(
                color: ctx.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            Wrap(
              spacing: 8,
              children: speeds.map((s) {
                final selected = (player.speed - s).abs() < 0.01;
                return ChoiceChip(
                  label: Text('${s}x'),
                  selected: selected,
                  onSelected: (_) {
                    player.setSpeed(s);
                    Navigator.pop(ctx);
                  },
                  selectedColor: AppColors.brandOrange,
                  backgroundColor: ctx.bgCard,
                  labelStyle: TextStyle(
                    color: selected ? Colors.white : ctx.textSecondary,
                    fontWeight: FontWeight.bold,
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSecondaryActions(
    BuildContext context,
    MusicPlayerService player,
    Video track,
  ) {
    final manager = ref.watch(downloadManagerProvider);
    final isDownloaded = manager.isDownloaded(track.videoId);
    final activeTask = manager.taskFor(track.videoId);

    // Wrap rather than Row. This row went from five actions to six, and six
    // 46px circles plus their labels is close enough to a narrow phone's
    // usable width that a Row would overflow on the smallest screens. Wrap
    // spreads them identically when they fit and drops to a second line
    // when they don't, instead of painting an overflow stripe.
    return Wrap(
      alignment: WrapAlignment.spaceAround,
      spacing: 4,
      runSpacing: 14,
      children: [
        _pillAction(
          context,
          icon: Icons.favorite_border_rounded,
          label: 'Like',
          onTap: () => _toggleLike(track),
        ),
        _pillAction(
          context,
          icon: Icons.thumb_down_outlined,
          label: 'Dislike',
          onTap: () => _toggleDislike(track),
        ),
        _pillAction(
          context,
          icon: Icons.speed_rounded,
          label: '${player.speed}x',
          onTap: () => _showSpeedSelector(context, player),
        ),
        _pillAction(
          context,
          icon: Icons.playlist_add_rounded,
          label: 'Playlist',
          onTap: () => showVideoOptionsSheet(context, track),
        ),
        if (activeTask != null)
          _pillAction(
            context,
            icon: Icons.downloading_rounded,
            label: '${(activeTask.progress * 100).round()}%',
            onTap: () {},
          )
        else
          _pillAction(
            context,
            icon: isDownloaded
                ? Icons.download_done_rounded
                : Icons.download_for_offline_outlined,
            label: isDownloaded ? 'Saved' : 'Offline',
            highlighted: isDownloaded,
            busy: _downloadBusy,
            onTap: isDownloaded ? () {} : () => _handleDownload(track),
          ),
        // Appended rather than slotted in among the others so the existing
        // actions keep the positions people already reach for.
        _pillAction(
          context,
          icon: Icons.reply_outlined,
          label: 'Share',
          onTap: () => shareVideoLink(track),
        ),
      ],
    );
  }

  Widget _pillAction(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    bool highlighted = false,
    bool busy = false,
  }) {
    return GestureDetector(
      onTap: busy ? null : onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 46,
            height: 46,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: highlighted
                  ? AppColors.brandOrange.withValues(alpha: 0.16)
                  : context.bgCard.withValues(alpha: 0.7),
              border: Border.all(
                color: highlighted
                    ? AppColors.brandOrange.withValues(alpha: 0.5)
                    : context.borderSubtle,
              ),
            ),
            child: busy
                ? Padding(
                    padding: const EdgeInsets.all(14),
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: context.textSecondary,
                    ),
                  )
                : Icon(
                    icon,
                    color: highlighted
                        ? AppColors.brandOrangeLight
                        : context.textPrimary,
                    size: 20,
                  ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              color: context.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLyricsSection(
    BuildContext context,
    MusicPlayerService player,
    Video track,
  ) {
    return StreamBuilder<Duration>(
      stream: player.positionStream,
      builder: (context, snapshot) {
        final seconds =
            (snapshot.data ?? Duration.zero).inMilliseconds / 1000.0;
        final activeIndex = activeLyricIndex(track.lyrics, seconds);
        final durationSeconds =
            (player.duration ?? Duration.zero).inMilliseconds / 1000.0;
        final sweep = lyricLineProgress(
          track.lyrics,
          activeIndex,
          seconds,
          durationSeconds: durationSeconds,
        );

        if (activeIndex >= 0 && activeIndex != _lastLyricIndex) {
          WidgetsBinding.instance.addPostFrameCallback(
            (_) => _scrollLyricsTo(activeIndex),
          );
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Text(
                  'LYRICS',
                  style: TextStyle(
                    color: context.textDim,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.6,
                  ),
                ),
                const Spacer(),
                Text(
                  'Tap line to jump',
                  style: TextStyle(color: context.textDim, fontSize: 10),
                ),
              ],
            ),
            const SizedBox(height: 10),
            SizedBox(
              height: 260,
              child: ListView.builder(
                controller: _lyricsScroll,
                physics: const BouncingScrollPhysics(),
                itemCount: track.lyrics.length,
                itemBuilder: (context, i) {
                  final line = track.lyrics[i];
                  final isActive = i == activeIndex;
                  final distance = (i - activeIndex).abs();

                  return GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      player.seek(
                        Duration(milliseconds: (line.time * 1000).round()),
                      );
                    },
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 5),
                      child: AnimatedDefaultTextStyle(
                        duration: const Duration(milliseconds: 250),
                        style: TextStyle(
                          fontSize: isActive ? 19 : (distance == 1 ? 16 : 14),
                          fontWeight: isActive
                              ? FontWeight.w900
                              : FontWeight.w600,
                          height: 1.3,
                          color: isActive
                              ? context.textPrimary
                              : context.textPrimary.withValues(
                                  alpha: distance == 1 ? 0.55 : 0.30,
                                ),
                        ),
                        child: isActive
                            ? ShaderMask(
                                shaderCallback: (bounds) {
                                  final base = context.textPrimary;
                                  return LinearGradient(
                                    begin: Alignment.centerLeft,
                                    end: Alignment.centerRight,
                                    colors: [
                                      AppColors.brandOrangeLight,
                                      AppColors.brandOrangeLight,
                                      base.withValues(alpha: 0.45),
                                      base.withValues(alpha: 0.45),
                                    ],
                                    stops: [
                                      0.0,
                                      sweep.clamp(0.0, 1.0),
                                      (sweep + 0.04).clamp(0.0, 1.0),
                                      1.0,
                                    ],
                                  ).createShader(bounds);
                                },
                                child: Text(
                                  line.text,
                                  style: const TextStyle(color: Colors.white),
                                ),
                              )
                            : Text(line.text),
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
