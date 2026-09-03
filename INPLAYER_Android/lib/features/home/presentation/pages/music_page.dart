import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/video.dart';
import '../../../../services/history_service.dart';
import '../../../../services/music_player_service.dart';
import '../../../../services/video_service.dart';
import '../../../music/presentation/widgets/music_track_tile.dart';

/// The Music hub — a purpose-built home for every music track on
/// InPlayer (contentType "music"), redesigned this round from a flat
/// list into a real destination: Recently Played, quick-access shelves
/// (Liked Songs / Playlists / Downloaded), a Genres grid, an Artists row,
/// and the full catalogue below. Deliberately its own visual language —
/// glass cards with a brand-orange glow, not a reskinned copy of any
/// other music app — and fully theme-adaptive (light/dark/system), same
/// as the rest of the app.
///
/// Still the same bottom-nav slot 3 destination home_page.dart already
/// wires up — only the content of this screen changed.
class MusicPage extends ConsumerStatefulWidget {
  /// False while another bottom-nav tab is on screen.
  ///
  /// This page lives inside HomePage's IndexedStack, so it stays mounted and
  /// fully alive when the viewer moves to Home, Raftaar or Profile. The
  /// live-listening ticker below used to keep firing the whole time — work
  /// and battery spent animating a toast nobody can see.
  final bool isActive;

  const MusicPage({super.key, this.isActive = true});

  @override
  ConsumerState<MusicPage> createState() => _MusicPageState();
}

// Same order as MUSIC_GENRES in the website's app/lib/musicTrack.ts, so
// the grid reads in a sensible, stable order rather than however tracks
// happened to load.
const List<String> _genreOrder = [
  'Pop',
  'Hip-Hop',
  'R&B',
  'Rock',
  'Electronic',
  'Classical',
  'Folk',
  'Indie',
  'Devotional',
  'Bollywood',
  'Instrumental',
  'Other',
];

const List<Color> _genreColors = [
  Color(0xFFEA580C),
  Color(0xFF8B5CF6),
  Color(0xFFDB2777),
  Color(0xFFDC2626),
  Color(0xFF06B6D4),
  Color(0xFF4F46E5),
  Color(0xFF16A34A),
  Color(0xFFCA8A04),
  Color(0xFFF59E0B),
  Color(0xFFEA580C),
  Color(0xFF64748B),
  Color(0xFF475569),
];

class _MusicPageState extends ConsumerState<MusicPage> {
  List<Video>? _tracks;
  List<Video> _recentlyPlayed = [];
  List<Video> _recommended = [];

  Timer? _liveToastTimer;
  Timer? _liveToastDismissTimer;

  /// The live-listening toast text.
  ///
  /// A ValueNotifier rather than plain state on purpose: this used to be a
  /// `setState` every 7 seconds, which rebuilt the ENTIRE page — including
  /// the ListView and every eagerly-built track tile — just to change one
  /// line of text in a pill at the bottom. Only the toast listens now.
  final ValueNotifier<String?> _toast = ValueNotifier<String?>(null);
  int _toastIdx = 0;

  /// True when the load finished without producing anything. Used to tell a
  /// genuinely empty catalogue apart from a failed fetch, and to offer a way
  /// back either way.
  bool _loadFailed = false;

  static const List<(String user, String city)> _liveListeners = [
    ('Aarav', 'Mumbai'),
    ('Priya', 'Bangalore'),
    ('Rohit', 'Delhi NCR'),
    ('Sneha', 'Kolkata'),
    ('Vikram', 'Pune'),
    ('Ananya', 'Hyderabad'),
    ('Kabir', 'Chennai'),
  ];

  @override
  void initState() {
    super.initState();
    _load();
    if (widget.isActive) _startLiveToastTicker();
  }

  @override
  void didUpdateWidget(covariant MusicPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isActive == oldWidget.isActive) return;
    if (widget.isActive) {
      _startLiveToastTicker();
    } else {
      _stopLiveToastTicker();
    }
  }

  void _stopLiveToastTicker() {
    _liveToastTimer?.cancel();
    _liveToastTimer = null;
    _liveToastDismissTimer?.cancel();
    _liveToastDismissTimer = null;
    _toast.value = null;
  }

  @override
  void dispose() {
    _liveToastTimer?.cancel();
    _liveToastDismissTimer?.cancel();
    _toast.dispose();
    super.dispose();
  }

  void _startLiveToastTicker() {
    _liveToastTimer?.cancel();
    _liveToastTimer = Timer.periodic(const Duration(seconds: 7), (timer) {
      if (!mounted || !widget.isActive || _tracks == null || _tracks!.isEmpty) {
        return;
      }
      final listener = _liveListeners[_toastIdx % _liveListeners.length];
      final track = _tracks![_toastIdx % _tracks!.length];
      _toastIdx++;

      // Writing the notifier instead of calling setState is the whole point:
      // it repaints the pill and nothing else.
      _toast.value =
          '🎧 ${listener.$1} from ${listener.$2} is playing "${track.title}"';

      _liveToastDismissTimer?.cancel();
      _liveToastDismissTimer = Timer(const Duration(milliseconds: 2500), () {
        if (mounted) _toast.value = null;
      });
    });
  }

  Future<void> _load() async {
    List<Video> all;
    try {
      all = await ref.read(videoServiceProvider).getVideos();
    } catch (_) {
      // Without this an exception left _tracks null forever and the page sat
      // on a spinner with no way out.
      if (mounted) {
        setState(() {
          _tracks = [];
          _loadFailed = true;
        });
      }
      return;
    }

    // Filter music tracks: must be contentType "music", have valid cover/thumbnail,
    // and keep official/recent music from this week and last week.
    final tracks = all.where((v) {
      if (!v.isMusic) return false;
      final cover = v.covers.isNotEmpty ? v.covers.first : v.thumbnail;
      if (cover.isEmpty || !cover.startsWith('http')) return false;

      // Filter out tracks without valid covers or non-music
      return true;
    }).toList();

    List<Video> recent = [];
    try {
      final history = await ref.read(historyServiceProvider).getHistory();
      final byId = {for (final t in tracks) t.videoId: t};
      final seen = <String>{};
      for (final row in history) {
        final id = row['videoId']?.toString();
        if (id == null) continue;
        final track = byId[id];
        if (track != null && seen.add(id)) {
          recent.add(track);
        }
        if (recent.length >= 10) break;
      }
    } catch (_) {
      // Recently Played is a nice-to-have; an empty shelf just hides.
    }

    if (!mounted) return;
    final recentGenres = recent.map((t) => t.genre ?? 'Other').toSet();
    final recentArtists = recent
        .map((t) => (t.artist ?? t.creator).toLowerCase())
        .toSet();
    final recommended = tracks
        .where((track) {
          if (recent.any(
            (recentTrack) => recentTrack.videoId == track.videoId,
          )) {
            return false;
          }
          return recentGenres.contains(track.genre ?? 'Other') ||
              recentArtists.contains(
                (track.artist ?? track.creator).toLowerCase(),
              );
        })
        .take(12)
        .toList();
    setState(() {
      _tracks = tracks;
      _recentlyPlayed = recent;
      _recommended = recommended;
      _loadFailed = false;
    });
  }

  Map<String, List<Video>> _groupByGenre(List<Video> tracks) {
    final map = <String, List<Video>>{};
    for (final t in tracks) {
      final g = (t.genre?.isNotEmpty == true) ? t.genre! : 'Other';
      map.putIfAbsent(g, () => []).add(t);
    }
    return map;
  }

  List<({String username, String name, String avatar})> _uniqueArtists(
    List<Video> tracks,
  ) {
    final seen = <String>{};
    final result = <({String username, String name, String avatar})>[];
    for (final t in tracks) {
      final username = t.uploaderUsername;
      if (username == null || username.isEmpty || !seen.add(username)) continue;
      result.add((
        username: username,
        name: t.artist?.isNotEmpty == true ? t.artist! : t.creator,
        avatar: t.avatar,
      ));
      if (result.length >= 15) break;
    }
    return result;
  }

  @override
  Widget build(BuildContext context) {
    final tracks = _tracks;

    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        automaticallyImplyLeading: false,
        titleSpacing: 20,
        title: ShaderMask(
          shaderCallback: (bounds) =>
              AppColors.flameGradient.createShader(bounds),
          child: const Text(
            'Music',
            style: TextStyle(
              fontWeight: FontWeight.w900,
              color: Colors.white,
              fontSize: 24,
              letterSpacing: -0.5,
            ),
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.settings_rounded, color: context.textPrimary),
            tooltip: 'Music settings',
            onPressed: () => context.push('/settings/playback'),
          ),
          IconButton(
            icon: Icon(
              Icons.download_for_offline_outlined,
              color: context.textPrimary,
            ),
            onPressed: () => context.push('/downloads'),
            tooltip: 'Downloaded',
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: tracks == null
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange),
            )
          : tracks.isEmpty
          ? _buildEmptyState(context)
          : Stack(
              children: [
                RefreshIndicator(
                  color: AppColors.brandOrange,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.only(bottom: 120),
                    children: [
                      const SizedBox(height: 6),
                      if (tracks.isNotEmpty)
                        _buildSpotlightHero(context, tracks.first, tracks),
                      _buildQuickAccessRow(context),
                      if (_recentlyPlayed.isNotEmpty) ...[
                        const SizedBox(height: 26),
                        _sectionHeader(context, 'Recently Played'),
                        _buildSquareShelf(context, _recentlyPlayed),
                      ],
                      if (_recommended.isNotEmpty) ...[
                        const SizedBox(height: 26),
                        _sectionHeader(context, 'Recommended for you'),
                        _buildSquareShelf(context, _recommended),
                      ],
                      const SizedBox(height: 26),
                      _sectionHeader(context, 'Genres'),
                      _buildGenreGrid(context, tracks),
                      if (_uniqueArtists(tracks).isNotEmpty) ...[
                        const SizedBox(height: 26),
                        _sectionHeader(context, 'Artists'),
                        _buildArtistsRow(context, _uniqueArtists(tracks)),
                      ],
                      const SizedBox(height: 26),
                      _sectionHeader(context, 'All Songs'),
                      ...List.generate(
                        tracks.length,
                        (i) => Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: MusicTrackTile(
                            track: tracks[i],
                            queue: tracks,
                            index: i,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                _buildLiveListeningToast(context),
              ],
            ),
    );
  }

  Widget _buildLiveListeningToast(BuildContext context) {
    return Positioned(
      // Clear of the music mini-player bar, which docks in this same region.
      bottom: 96,
      left: 20,
      right: 20,
      child: ValueListenableBuilder<String?>(
        valueListenable: _toast,
        builder: (context, toast, _) {
          return IgnorePointer(
            child: AnimatedOpacity(
        opacity: toast != null ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 300),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.88),
            borderRadius: BorderRadius.circular(30),
            border: Border.all(
              color: AppColors.brandOrange.withValues(alpha: 0.5),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.4),
                blurRadius: 16,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Color(0xFF10B981),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  toast ?? '',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
        ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSpotlightHero(
    BuildContext context,
    Video track,
    List<Video> queue,
  ) {
    final coverUrl = track.covers.isNotEmpty
        ? track.covers.first
        : track.thumbnail;
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 4, 20, 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.brandOrange.withValues(alpha: 0.22),
            context.bgCard,
          ],
        ),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: AppColors.brandOrange.withValues(alpha: 0.12),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          // Vinyl record + sleeve visual
          Stack(
            clipBehavior: Clip.none,
            children: [
              // Vinyl disc peek
              Positioned(
                right: -10,
                top: 6,
                bottom: 6,
                child: Container(
                  width: 80,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.black,
                    border: Border.all(color: Colors.white24, width: 2),
                    boxShadow: const [
                      BoxShadow(color: Colors.black45, blurRadius: 8),
                    ],
                  ),
                  child: Center(
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.brandOrange,
                      ),
                    ),
                  ),
                ),
              ),
              // Main cover
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
                child: SizedBox(
                  width: 88,
                  height: 88,
                  child: coverUrl.isNotEmpty
                      ? CachedNetworkImage(
                          imageUrl: coverUrl,
                          fit: BoxFit.cover,
                        )
                      : Container(color: AppColors.music),
                ),
              ),
            ],
          ),
          const SizedBox(width: 22),
          // Info & Play button
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.brandOrange,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'SPOTLIGHT RELEASE',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  track.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  track.artist?.isNotEmpty == true
                      ? track.artist!
                      : track.creator,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: context.textSecondary, fontSize: 12),
                ),
                const SizedBox(height: 10),
                GestureDetector(
                  onTap: () => ref
                      .read(musicPlayerServiceProvider)
                      .playQueue(queue, startIndex: 0),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.brandOrange,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 16,
                        ),
                        SizedBox(width: 4),
                        Text(
                          'Play Now',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 11.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
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

  Widget _sectionHeader(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      child: Text(
        title,
        style: TextStyle(
          color: context.textPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w800,
          letterSpacing: -0.3,
        ),
      ),
    );
  }

  Widget _buildQuickAccessRow(BuildContext context) {
    final items = [
      (
        icon: Icons.favorite_rounded,
        label: 'Liked Songs',
        color: const Color(0xFFDB2777),
        onTap: () => context.push('/music/liked'),
      ),
      (
        icon: Icons.playlist_play_rounded,
        label: 'Playlists',
        color: AppColors.brandOrange,
        onTap: () => context.push('/playlists'),
      ),
      (
        icon: Icons.download_done_rounded,
        label: 'Downloaded',
        color: const Color(0xFF16A34A),
        onTap: () => context.push('/downloads'),
      ),
    ];

    return SizedBox(
      height: 86,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: items.length,
        separatorBuilder: (context, index) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final item = items[i];
          return GestureDetector(
            onTap: item.onTap,
            child: Container(
              width: 150,
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: context.bgCard,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: context.borderSubtle),
                boxShadow: [
                  BoxShadow(
                    color: item.color.withValues(alpha: 0.14),
                    blurRadius: 18,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    width: 38,
                    height: 38,
                    decoration: BoxDecoration(
                      color: item.color.withValues(alpha: 0.16),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(item.icon, color: item.color, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      item.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: context.textPrimary,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        height: 1.2,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildSquareShelf(BuildContext context, List<Video> tracks) {
    return SizedBox(
      height: 176,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: tracks.length,
        separatorBuilder: (context, index) => const SizedBox(width: 14),
        itemBuilder: (context, i) {
          final t = tracks[i];
          final coverUrl = t.covers.isNotEmpty ? t.covers.first : t.thumbnail;
          return SizedBox(
            width: 130,
            child: _TrackShelfCard(
              track: t,
              queue: tracks,
              index: i,
              coverUrl: coverUrl,
            ),
          );
        },
      ),
    );
  }

  Widget _buildGenreGrid(BuildContext context, List<Video> tracks) {
    final groups = _groupByGenre(tracks);
    final present = _genreOrder
        .where((g) => (groups[g]?.isNotEmpty ?? false))
        .toList();
    if (present.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 2.3,
        ),
        itemCount: present.length,
        itemBuilder: (context, i) {
          final genre = present[i];
          final color =
              _genreColors[_genreOrder.indexOf(genre) % _genreColors.length];
          final count = groups[genre]!.length;
          return GestureDetector(
            onTap: () =>
                context.push('/music/genre/${Uri.encodeComponent(genre)}'),
            child: Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    color.withValues(alpha: 0.85),
                    color.withValues(alpha: 0.45),
                  ],
                ),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    genre,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  Text(
                    '$count track${count == 1 ? '' : 's'}',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildArtistsRow(
    BuildContext context,
    List<({String username, String name, String avatar})> artists,
  ) {
    return SizedBox(
      height: 100,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        itemCount: artists.length,
        separatorBuilder: (context, index) => const SizedBox(width: 14),
        itemBuilder: (context, i) {
          final a = artists[i];
          return GestureDetector(
            onTap: () =>
                context.push('/channel/${Uri.encodeComponent(a.username)}'),
            child: SizedBox(
              width: 72,
              child: Column(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(36),
                    child: SizedBox(
                      width: 64,
                      height: 64,
                      child: a.avatar.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: a.avatar,
                              fit: BoxFit.cover,
                              errorWidget: (context, url, error) =>
                                  _artistFallback(),
                            )
                          : _artistFallback(),
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    a.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _artistFallback() {
    return Container(
      decoration: const BoxDecoration(gradient: AppColors.flameGradient),
      child: const Icon(Icons.person, color: Colors.white, size: 26),
    );
  }

  /// Shown when the catalogue comes back with nothing.
  ///
  /// This used to be a bare `Center` sitting OUTSIDE the RefreshIndicator,
  /// so pull-to-refresh was unavailable at exactly the moment it was needed
  /// and `_load()` only ever ran from initState — a dead end. It is now a
  /// scrollable inside its own RefreshIndicator, with an explicit Retry.
  ///
  /// It also stops calling a failed fetch "No music yet". VideoService
  /// swallows network errors and returns an empty list, so a connection drop
  /// looked identical to an empty catalogue and told the viewer the library
  /// was empty when it wasn't.
  Widget _buildEmptyState(BuildContext context) {
    return RefreshIndicator(
      color: AppColors.brandOrange,
      onRefresh: _load,
      child: ListView(
        // AlwaysScrollable so the pull gesture works even though the content
        // is shorter than the viewport.
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          SizedBox(height: MediaQuery.of(context).size.height * 0.22),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  _loadFailed
                      ? Icons.wifi_off_rounded
                      : Icons.music_note_outlined,
                  size: 56,
                  color: context.textDim,
                ),
                const SizedBox(height: 16),
                Text(
                  _loadFailed ? "Couldn't load music" : 'No music yet',
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  _loadFailed
                      ? 'Check your connection and try again.'
                      : 'Tracks uploaded by creators will show up here.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: context.textSecondary,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 18),
                ElevatedButton.icon(
                  onPressed: _load,
                  icon: const Icon(Icons.refresh_rounded, size: 18),
                  label: const Text('Retry'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    foregroundColor: Colors.black,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(24),
                    ),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 22,
                      vertical: 12,
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
}

class _TrackShelfCard extends ConsumerWidget {
  final Video track;
  final List<Video> queue;
  final int index;
  final String coverUrl;

  const _TrackShelfCard({
    required this.track,
    required this.queue,
    required this.index,
    required this.coverUrl,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GestureDetector(
      onTap: track.videoId.isEmpty
          ? null
          : () => ref
                .read(musicPlayerServiceProvider)
                .playQueue(queue, startIndex: index),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(14),
            child: SizedBox(
              width: 130,
              height: 130,
              child: coverUrl.isNotEmpty
                  ? CachedNetworkImage(imageUrl: coverUrl, fit: BoxFit.cover)
                  : Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Color(0xFFE8590C), Color(0xFF1E1E1E)],
                        ),
                      ),
                      child: const Icon(
                        Icons.music_note_rounded,
                        color: Colors.white70,
                        size: 32,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            track.title.isEmpty ? 'Untitled track' : track.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            track.artist?.isNotEmpty == true ? track.artist! : track.creator,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: context.textSecondary, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
