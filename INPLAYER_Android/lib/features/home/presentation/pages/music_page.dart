import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/widgets/user_avatar.dart';
import '../../../../models/video.dart';
import '../../../../services/history_service.dart';
import '../../../../services/music_player_service.dart';
import '../../../../services/video_service.dart';
import '../../../music/presentation/widgets/music_track_tile.dart';
import '../../../music/presentation/widgets/mini_player_bar.dart';
import '../../../music/presentation/pages/now_playing_page.dart';
import '../widgets/home_ad_card.dart';

/// The Music hub — a purpose-built premium home for every music
/// track on InPlayer (contentType "music").
///
/// Uses a warm InPlayer palette, 2-column quick-access shelf, spotlight
/// release with vinyl detail, 1:1 square artwork sleeves with [BoxFit.cover],
/// and browse filters that stay within the explicit Music content type.
class MusicPage extends ConsumerStatefulWidget {
  final bool isActive;
  final String? initialVideoId;

  const MusicPage({super.key, this.isActive = true, this.initialVideoId});

  @override
  ConsumerState<MusicPage> createState() => _MusicPageState();
}

const Color _spotifyGreen = Color(0xFFFF7A18);

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

// Mirrors the Indian-language browse bar on the website. English and Other
// remain valid upload metadata but are intentionally not browse filters.
const List<String> _musicLanguageFilters = [
  'Hindi',
  'Tamil',
  'Telugu',
  'Bengali',
  'Marathi',
  'Gujarati',
  'Punjabi',
  'Kannada',
  'Malayalam',
  'Odia',
  'Assamese',
  'Bhojpuri',
  'Rajasthani',
];

const List<Color> _genreColors = [
  Color(0xFF8C1932), // Pop
  Color(0xFFBC5900), // Hip-Hop
  Color(0xFF8D67AB), // R&B
  Color(0xFFE91429), // Rock
  Color(0xFF006450), // Electronic
  Color(0xFF477D95), // Classical
  Color(0xFFCA8A04), // Folk
  Color(0xFF503750), // Indie
  Color(0xFFD84000), // Devotional
  Color(0xFFBA5D07), // Bollywood
  Color(0xFF1E3264), // Instrumental
  Color(0xFF475569), // Other
];

class _MusicPageState extends ConsumerState<MusicPage> {
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
  List<Video>? _tracks;
  List<Video> _recentlyPlayed = [];
  List<Video> _recommended = [];
  bool _loadFailed = false;
  String _selectedLanguage = 'All';
  String _selectedGenre = 'All';
  String _searchQuery = '';
  bool _searchOpen = false;
  bool _isListening = false;
  final TextEditingController _searchController = TextEditingController();
  final stt.SpeechToText _speech = stt.SpeechToText();

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant MusicPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialVideoId != widget.initialVideoId) {
      _load();
    }
  }

  Future<void> _load() async {
    List<Video> all;
    try {
      all = await ref.read(videoServiceProvider).getMusicTracks();
    } catch (_) {
      all = [];
      if (widget.initialVideoId == null || widget.initialVideoId!.isEmpty) {
        if (mounted) {
          setState(() {
            _tracks = [];
            _loadFailed = true;
          });
        }
        return;
      }
    }

    // Music covers are uploaded as inline `data:image/...` URIs, not http
    // URLs, so an http-only check here hid every track. Accept anything
    // SafeAppImage can actually render.
    final tracks = all.where((v) {
      if (!v.isStrictMusic) return false;
      final cover = v.covers.isNotEmpty ? v.covers.first : v.thumbnail;
      return smartImageProvider(cover) != null;
    }).toList();

    final initialVideoId = widget.initialVideoId?.trim();
    if (initialVideoId != null &&
        initialVideoId.isNotEmpty &&
        !tracks.any((track) => track.videoId == initialVideoId)) {
      final linkedTrack = await ref
          .read(videoServiceProvider)
          .getVideoById(initialVideoId);
      if (linkedTrack?.isStrictMusic == true) {
        tracks.insert(0, linkedTrack!);
      }
    }

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
    } catch (_) {}

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

    if (initialVideoId != null && initialVideoId.isNotEmpty) {
      final trackIndex = tracks.indexWhere(
        (track) => track.videoId == initialVideoId,
      );
      if (trackIndex >= 0) {
        unawaited(
          ref.read(musicPlayerServiceProvider).playQueue(
                tracks,
                startIndex: trackIndex,
              ),
        );
      }
    }
  }

  @override
  void dispose() {
    if (_isListening) unawaited(_speech.stop());
    _searchController.dispose();
    super.dispose();
  }

  List<Video> _filterTracks(Iterable<Video> source) {
    final language = _selectedLanguage.toLowerCase();
    final genre = _selectedGenre.toLowerCase();
    final query = _searchQuery.trim().toLowerCase();
    return source
        .where((track) {
          if (!track.isStrictMusic) return false;
          final trackGenre = (track.genre?.trim().isNotEmpty == true)
              ? track.genre!.trim().toLowerCase()
              : 'other';
          if (genre != 'all' && trackGenre != genre) return false;
          if (language != 'all' &&
              (track.language ?? '').toLowerCase() != language) {
            return false;
          }
          if (query.isEmpty) return true;
          return [
            track.title,
            track.artist ?? '',
            track.creator,
            track.genre ?? '',
            track.language ?? '',
          ].any((value) => value.toLowerCase().contains(query));
        })
        .toList(growable: false);
  }

  Future<void> _toggleVoiceSearch() async {
    if (_isListening) {
      await _speech.stop();
      if (mounted) setState(() => _isListening = false);
      return;
    }

    try {
      final available = await _speech.initialize(
        onStatus: (status) {
          if ((status == 'done' || status == 'notListening') && mounted) {
            setState(() => _isListening = false);
          }
        },
        onError: (_) {
          if (mounted) setState(() => _isListening = false);
        },
      );
      if (!available) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                "Couldn't access the microphone. Check the app's microphone permission in system settings.",
              ),
            ),
          );
        }
        return;
      }
      if (!mounted) return;
      setState(() {
        _searchOpen = true;
        _isListening = true;
      });
      await _speech.listen(
        onResult: (result) {
          if (!mounted) return;
          final text = result.recognizedWords;
          _searchController.value = TextEditingValue(
            text: text,
            selection: TextSelection.collapsed(offset: text.length),
          );
          setState(() {
            _searchQuery = text;
            if (result.finalResult) _isListening = false;
          });
        },
      );
    } catch (_) {
      if (mounted) {
        setState(() => _isListening = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Voice search is unavailable right now.'),
          ),
        );
      }
    }
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
    final list = <({String username, String name, String avatar})>[];
    for (final t in tracks) {
      final name = t.artist?.isNotEmpty == true ? t.artist! : t.creator;
      if (name.isEmpty) continue;
      if (seen.add(name.toLowerCase())) {
        list.add((
          username: t.uploaderId ?? '',
          name: name,
          avatar: t.thumbnail,
        ));
      }
      if (list.length >= 16) break;
    }
    return list;
  }

  @override
  Widget build(BuildContext context) {
    final allTracks = _tracks;
    final tracks = allTracks == null ? null : _filterTracks(allTracks);
    final canPop = context.canPop();
    final isDark = context.isDark;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (context.canPop()) {
          context.pop();
        } else {
          context.go('/');
        }
      },
      child: Scaffold(
        bottomNavigationBar: const MiniPlayerBar(),
        backgroundColor: isDark
            ? const Color(0xFF121212)
            : AppColors.surfaceLight,
        appBar: AppBar(
          backgroundColor: isDark
              ? const Color(0xFF121212)
              : AppColors.surfaceLight,
          elevation: 0,
          automaticallyImplyLeading: false,
          leading: canPop
              ? IconButton(
                  icon: Icon(
                    Icons.arrow_back_rounded,
                    color: context.textPrimary,
                  ),
                  onPressed: () {
                    if (context.canPop()) {
                      context.pop();
                    } else {
                      context.go('/');
                    }
                  },
                )
              : null,
          titleSpacing: canPop ? 0 : 16,
          title: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: _spotifyGreen,
                ),
                child: const Center(
                  child: Icon(
                    Icons.music_note_rounded,
                    color: Colors.black,
                    size: 18,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'Music',
                style: TextStyle(
                  fontWeight: FontWeight.w900,
                  fontSize: 22,
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
          actions: [
            Container(
              height: 38,
              margin: const EdgeInsets.symmetric(vertical: 5),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: context.isDark
                      ? [const Color(0xFF29242A), const Color(0xFF1D1B20)]
                      : [const Color(0xFFFFF4E8), const Color(0xFFF1E8DF)],
                ),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: context.borderSubtle),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.brandOrange.withValues(alpha: 0.10),
                    blurRadius: 12,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    constraints: const BoxConstraints.tightFor(
                      width: 38,
                      height: 38,
                    ),
                    icon: Icon(
                      _searchOpen ? Icons.close_rounded : Icons.search_rounded,
                      color: context.textPrimary,
                      size: 20,
                    ),
                    tooltip: _searchOpen
                        ? 'Close music search'
                        : 'Search music',
                    onPressed: () {
                      setState(() {
                        _searchOpen = !_searchOpen;
                        if (!_searchOpen) {
                          _searchQuery = '';
                          _searchController.clear();
                          _isListening = false;
                        }
                      });
                      if (!_searchOpen) unawaited(_speech.stop());
                    },
                  ),
                  Container(width: 1, height: 19, color: context.borderSubtle),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    constraints: const BoxConstraints.tightFor(
                      width: 38,
                      height: 38,
                    ),
                    icon: Icon(
                      _isListening ? Icons.mic_rounded : Icons.mic_none_rounded,
                      color: _isListening
                          ? AppColors.brandOrange
                          : context.textSecondary,
                      size: 19,
                    ),
                    tooltip: _isListening
                        ? 'Stop voice search'
                        : 'Search by voice',
                    onPressed: _toggleVoiceSearch,
                  ),
                ],
              ),
            ),
            IconButton(
              icon: const Icon(
                Icons.add_circle_outline_rounded,
                color: _spotifyGreen,
              ),
              tooltip: 'Upload music',
              onPressed: () => context.push('/upload?type=music'),
            ),
            PopupMenuButton<String>(
              tooltip: 'More music options',
              icon: Icon(Icons.more_vert_rounded, color: context.textPrimary),
              onSelected: (value) {
                if (value == 'settings') context.push('/settings/music');
                if (value == 'downloads') context.push('/downloads');
              },
              itemBuilder: (context) => [
                PopupMenuItem(
                  value: 'settings',
                  child: Row(
                    children: const [
                      Icon(Icons.tune_rounded, size: 18),
                      SizedBox(width: 10),
                      Text('Music settings'),
                    ],
                  ),
                ),
                PopupMenuItem(
                  value: 'downloads',
                  child: Row(
                    children: const [
                      Icon(Icons.download_for_offline_outlined, size: 18),
                      SizedBox(width: 10),
                      Text('Downloads'),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(width: 8),
          ],
        ),
        body: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: isDark
                  ? const [
                      Color(0xFF19161B),
                      Color(0xFF111014),
                      Color(0xFF0A0A0D),
                    ]
                  : const [
                      Color(0xFFFFF8EF),
                      Color(0xFFF4ECE3),
                      Color(0xFFEDE5DE),
                    ],
            ),
          ),
          child: tracks == null
            ? const Center(
                child: CircularProgressIndicator(color: _spotifyGreen),
              )
            : tracks.isEmpty
            ? (allTracks!.isEmpty
                  ? _buildEmptyState(context)
                  : _buildNoMusicResults(context))
            : Center(
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 900),
                  child: RefreshIndicator(
                    color: _spotifyGreen,
                    onRefresh: _load,
                    child: ListView(
                      padding: const EdgeInsets.only(bottom: 120),
                      children: [
                        const SizedBox(height: 6),
                        _buildCategoryPills(context, allTracks!),
                        if (_searchOpen) _buildMusicSearchField(context),
                        _buildLanguageFilters(context),
                        const SizedBox(height: 14),

                        // Spotify 2-Column Quick-Access Top Shelf (6 Cards)
                        if (tracks.isNotEmpty)
                          _buildSpotifyQuickAccess(
                            context,
                            tracks.take(6).toList(),
                          ),
                        const SizedBox(height: 16),
                        const HomeAdCard(),

                        const SizedBox(height: 18),

                        // Spotlight Hero Release with Vinyl peek
                        if (tracks.isNotEmpty)
                          _buildSpotlightHero(context, tracks.first, tracks),

                        // Quick Access Shortcuts (Liked Songs, Playlists, Downloads)
                        const SizedBox(height: 14),
                        _buildQuickAccessRow(context),

                        // Recently Played Horizontal Carousel
                        if (_filterTracks(_recentlyPlayed).isNotEmpty) ...[
                          const SizedBox(height: 20),
                          _sectionHeader(context, 'Recently played'),
                          _buildSquareShelf(
                            context,
                            _filterTracks(_recentlyPlayed),
                          ),
                        ],

                        // Recommended Shelf
                        if (_filterTracks(_recommended).isNotEmpty) ...[
                          const SizedBox(height: 20),
                          _sectionHeader(context, 'Made for you'),
                          _buildSquareShelf(
                            context,
                            _filterTracks(_recommended),
                          ),
                        ],

                        // Browse All Genres (Spotify signature cards)
                        const SizedBox(height: 22),
                        _sectionHeader(context, 'Browse all categories'),
                        _buildGenreGrid(context, tracks),

                        // Artists Row
                        if (_uniqueArtists(tracks).isNotEmpty) ...[
                          const SizedBox(height: 22),
                          _sectionHeader(context, 'Popular artists'),
                          _buildArtistsRow(context, _uniqueArtists(tracks)),
                        ],

                        // All Tracks (with JioSaavn-style inline ad card after track 6)
                        const SizedBox(height: 22),
                        _sectionHeader(context, 'Popular tracks'),
                        ...List.generate(
                          tracks.length,
                          (i) => Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                child: MusicTrackTile(
                                  track: tracks[i],
                                  queue: tracks,
                                  index: i,
                                ),
                              ),
                              if (i == 5 && tracks.length > 6) ...[
                                const SizedBox(height: 14),
                                const HomeAdCard(),
                                const SizedBox(height: 14),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ),
      ),
    );
  }

  Widget _buildCategoryPills(BuildContext context, List<Video> tracks) {
    final present = <String>{};
    for (final track in tracks) {
      final genre = (track.genre?.trim().isNotEmpty == true)
          ? track.genre!.trim()
          : 'Other';
      present.add(genre);
    }
    final genres = present.toList()
      ..sort((a, b) {
        final aIndex = _genreOrder.indexWhere(
          (known) => known.toLowerCase() == a.toLowerCase(),
        );
        final bIndex = _genreOrder.indexWhere(
          (known) => known.toLowerCase() == b.toLowerCase(),
        );
        if (aIndex < 0 && bIndex < 0) return a.compareTo(b);
        if (aIndex < 0) return 1;
        if (bIndex < 0) return -1;
        return aIndex.compareTo(bIndex);
      });
    final filters = ['All', ...genres];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(
            children: [
              Text(
                'GENRES',
                style: TextStyle(
                  color: context.textDim,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 1.4,
                ),
              ),
              const Spacer(),
              if (_selectedGenre != 'All')
                Text(
                  _selectedGenre,
                  style: const TextStyle(
                    color: _spotifyGreen,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                  ),
                ),
            ],
          ),
        ),
        SizedBox(
          height: 38,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: filters.length,
            separatorBuilder: (context, index) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final genre = filters[index];
              final selected =
                  _selectedGenre.toLowerCase() == genre.toLowerCase();
              return Material(
                color: selected
                    ? _spotifyGreen
                    : (context.isDark
                          ? const Color(0xFF24242A)
                          : const Color(0xFFECE7E2)),
                borderRadius: BorderRadius.circular(18),
                child: InkWell(
                  borderRadius: BorderRadius.circular(18),
                  onTap: () => setState(() => _selectedGenre = genre),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 15),
                    child: Center(
                      child: Text(
                        genre == 'All' ? 'All genres' : genre,
                        style: TextStyle(
                          color: selected ? Colors.black : context.textPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildMusicSearchField(BuildContext context) {
    final fill = context.isDark
        ? const Color(0xFF242424)
        : const Color(0xFFE8E8E8);
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 2),
      child: TextField(
        controller: _searchController,
        onChanged: (value) => setState(() => _searchQuery = value),
        textInputAction: TextInputAction.search,
        style: TextStyle(color: context.textPrimary),
        decoration: InputDecoration(
          hintText: 'Search tracks or artists',
          hintStyle: TextStyle(color: context.textDim),
          prefixIcon: Icon(Icons.search_rounded, color: context.textSecondary),
          suffixIcon: _searchQuery.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Clear search',
                  onPressed: () {
                    _searchController.clear();
                    setState(() => _searchQuery = '');
                  },
                  icon: Icon(Icons.close_rounded, color: context.textSecondary),
                ),
          filled: true,
          fillColor: fill,
          isDense: true,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: BorderSide.none,
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(14),
            borderSide: const BorderSide(color: _spotifyGreen),
          ),
        ),
      ),
    );
  }

  Widget _buildLanguageFilters(BuildContext context) {
    final languages = ['All', ..._musicLanguageFilters];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 13, 16, 7),
          child: Text(
            'LANGUAGES',
            style: TextStyle(
              color: context.textDim,
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.4,
            ),
          ),
        ),
        SizedBox(
          height: 36,
          child: ListView.separated(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: languages.length,
            separatorBuilder: (context, index) => const SizedBox(width: 8),
            itemBuilder: (context, index) {
              final language = languages[index];
              final selected =
                  _selectedLanguage.toLowerCase() == language.toLowerCase();
              return Material(
                color: selected
                    ? _spotifyGreen
                    : (context.isDark
                          ? const Color(0xFF282828)
                          : const Color(0xFFE5E5E5)),
                borderRadius: BorderRadius.circular(20),
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: () => setState(() => _selectedLanguage = language),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: Center(
                      child: Text(
                        language,
                        style: TextStyle(
                          color: selected ? Colors.black : context.textPrimary,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildNoMusicResults(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.music_off_rounded, size: 48, color: context.textDim),
            const SizedBox(height: 12),
            Text(
              'No tracks match these filters.',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () {
                setState(() {
                  _selectedLanguage = 'All';
                  _selectedGenre = 'All';
                  _searchQuery = '';
                  _searchController.clear();
                });
              },
              child: const Text('Show all tracks'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSpotifyQuickAccess(
    BuildContext context,
    List<Video> quickTracks,
  ) {
    final player = ref.watch(musicPlayerServiceProvider);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Good listening',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 10),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
              childAspectRatio: 3.1,
            ),
            itemCount: quickTracks.length,
            itemBuilder: (context, i) {
              final track = quickTracks[i];
              final isCurrent = player.currentTrack?.videoId == track.videoId;
              final coverUrl = track.covers.isNotEmpty
                  ? track.covers.first
                  : track.thumbnail;

              return GestureDetector(
                onTap: () {
                  if (isCurrent) {
                    ref.read(musicPlayerServiceProvider).togglePlayPause();
                  } else {
                    ref
                        .read(musicPlayerServiceProvider)
                        .playQueue(quickTracks, startIndex: i);
                    _openNowPlaying(context);
                  }
                },
                child: Container(
                  decoration: BoxDecoration(
                    color: context.isDark
                        ? const Color(0xFF242424)
                        : const Color(0xFFE8E8E8),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isCurrent
                          ? _spotifyGreen
                          : Colors.white.withValues(alpha: 0.04),
                    ),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Row(
                    children: [
                      AspectRatio(
                        aspectRatio: 1,
                        child: coverUrl.isNotEmpty
                            ? SafeAppImage(
                                imageUrl: coverUrl,
                                fit: BoxFit.cover,
                              )
                            : Container(color: Colors.grey.shade900),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              track.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: isCurrent
                                    ? _spotifyGreen
                                    : context.textPrimary,
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              track.artist?.isNotEmpty == true
                                  ? track.artist!
                                  : track.creator,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: context.textSecondary,
                                fontSize: 9.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isCurrent)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: Icon(
                            player.isPlaying
                                ? Icons.equalizer_rounded
                                : Icons.play_arrow_rounded,
                            color: _spotifyGreen,
                            size: 16,
                          ),
                        ),
                    ],
                  ),
                ),
              );
            },
          ),
        ],
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
    final isDark = context.isDark;

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 2, 16, 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isDark
              ? [const Color(0xFF3A2118), const Color(0xFF18171B)]
              : [const Color(0xFFFFE6CF), Colors.white],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _spotifyGreen.withValues(alpha: 0.3)),
        boxShadow: [
          BoxShadow(
            color: _spotifyGreen.withValues(alpha: 0.15),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          // Vinyl record + sleeve visual with clean 1:1 square
          Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned(
                right: -8,
                top: 4,
                bottom: 4,
                child: Container(
                  width: 64,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.black,
                    border: Border.all(color: Colors.white24, width: 1.5),
                    boxShadow: const [
                      BoxShadow(color: Colors.black45, blurRadius: 6),
                    ],
                  ),
                  child: Center(
                    child: Container(
                      width: 20,
                      height: 20,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: _spotifyGreen,
                      ),
                    ),
                  ),
                ),
              ),
              ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: SizedBox(
                  width: 76,
                  height: 76,
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: coverUrl.isNotEmpty
                        ? SafeAppImage(imageUrl: coverUrl, fit: BoxFit.cover)
                        : Container(color: Colors.grey.shade900),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(width: 16),
          // Info & Spotify Play Button
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2.5,
                  ),
                  decoration: BoxDecoration(
                    color: _spotifyGreen.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: _spotifyGreen.withValues(alpha: 0.4),
                    ),
                  ),
                  child: const Text(
                    'FEATURED RELEASE',
                    style: TextStyle(
                      color: _spotifyGreen,
                      fontSize: 8.5,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 0.8,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
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
                const SizedBox(height: 8),
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
                      color: _spotifyGreen,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: _spotifyGreen.withValues(alpha: 0.4),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.play_arrow_rounded,
                          color: Colors.black,
                          size: 16,
                        ),
                        SizedBox(width: 4),
                        Text(
                          'Play Now',
                          style: TextStyle(
                            color: Colors.black,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w800,
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
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          color: context.textPrimary,
          fontSize: 17,
          fontWeight: FontWeight.w900,
          letterSpacing: -0.4,
        ),
      ),
    );
  }

  Widget _buildQuickAccessRow(BuildContext context) {
    final items = [
      (
        icon: Icons.favorite_rounded,
        label: 'Liked Songs',
        color: const Color(0xFFFF7A18),
        onTap: () => context.push('/music/liked'),
      ),
      (
        icon: Icons.playlist_play_rounded,
        label: 'Playlists',
        color: const Color(0xFF8B5CF6),
        onTap: () => context.push('/playlists'),
      ),
      (
        icon: Icons.download_done_rounded,
        label: 'Downloaded',
        color: const Color(0xFF06B6D4),
        onTap: () => context.push('/downloads'),
      ),
    ];

    return SizedBox(
      height: 52,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: items.length,
        separatorBuilder: (context, index) => const SizedBox(width: 10),
        itemBuilder: (context, i) {
          final item = items[i];
          return GestureDetector(
            onTap: item.onTap,
            child: Container(
              width: 124,
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: context.bgCard,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: context.borderSubtle),
              ),
              child: Row(
                children: [
                  Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: item.color.withValues(alpha: 0.16),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(item.icon, color: item.color, size: 16),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      item.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: context.textPrimary,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
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
      height: 160,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: tracks.length,
        separatorBuilder: (context, index) => const SizedBox(width: 12),
        itemBuilder: (context, i) {
          final t = tracks[i];
          final coverUrl = t.covers.isNotEmpty ? t.covers.first : t.thumbnail;
          return SizedBox(
            width: 115,
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
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
          maxCrossAxisExtent: 180,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          childAspectRatio: 1.8,
        ),
        itemCount: present.length,
        itemBuilder: (context, i) {
          final genre = present[i];
          final color =
              _genreColors[_genreOrder.indexOf(genre) % _genreColors.length];
          final count = groups[genre]!.length;
          final firstTrack = groups[genre]!.firstOrNull;
          final coverUrl =
              firstTrack?.covers.firstOrNull ?? firstTrack?.thumbnail ?? '';

          return GestureDetector(
            onTap: () =>
                context.push('/music/genre/${Uri.encodeComponent(genre)}'),
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(
                    color: color.withValues(alpha: 0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          genre,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        Text(
                          '$count track${count == 1 ? '' : 's'}',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 10.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Spotify Tilted Album Cover in bottom-right corner
                  if (coverUrl.isNotEmpty)
                    Positioned(
                      bottom: -8,
                      right: -10,
                      child: Transform.rotate(
                        angle: 0.38,
                        child: Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(6),
                            boxShadow: const [
                              BoxShadow(color: Colors.black45, blurRadius: 8),
                            ],
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: SafeAppImage(
                            imageUrl: coverUrl,
                            fit: BoxFit.cover,
                          ),
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

  Widget _buildArtistsRow(
    BuildContext context,
    List<({String username, String name, String avatar})> artists,
  ) {
    return SizedBox(
      height: 94,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: artists.length,
        separatorBuilder: (context, index) => const SizedBox(width: 14),
        itemBuilder: (context, i) {
          final a = artists[i];
          final profilePath = a.username.isNotEmpty
              ? '/channel/${Uri.encodeComponent(a.username)}'
              : null;
          return GestureDetector(
            onTap: profilePath != null ? () => context.push(profilePath) : null,
            child: SizedBox(
              width: 66,
              child: Column(
                children: [
                  UserAvatar(
                    avatarUrl: a.avatar,
                    name: a.name,
                    size: 56,
                    onTap: profilePath != null
                        ? () => context.push(profilePath)
                        : null,
                  ),
                  const SizedBox(height: 5),
                  Text(
                    a.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
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

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _spotifyGreen.withValues(alpha: 0.15),
              ),
              child: const Center(
                child: Icon(
                  Icons.music_note_rounded,
                  color: _spotifyGreen,
                  size: 36,
                ),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              _loadFailed ? 'Failed to load music' : 'No music tracks yet',
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w900,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              _loadFailed
                  ? 'Please check your internet connection and try again.'
                  : 'Uploaded music tracks will show up here with artwork and lyrics.',
              textAlign: TextAlign.center,
              style: TextStyle(color: context.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 18),
            ElevatedButton.icon(
              onPressed: _load,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Refresh'),
              style: ElevatedButton.styleFrom(
                backgroundColor: _spotifyGreen,
                foregroundColor: Colors.black,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(24),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 12,
                ),
              ),
            ),
          ],
        ),
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
          : () {
              ref.read(musicPlayerServiceProvider).playQueue(queue, startIndex: index);
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
            },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: SizedBox(
              width: 115,
              height: 115,
              child: AspectRatio(
                aspectRatio: 1,
                child: coverUrl.isNotEmpty
                    ? SafeAppImage(imageUrl: coverUrl, fit: BoxFit.cover)
                    : Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFFFF7A18), Color(0xFF121212)],
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
          ),
          const SizedBox(height: 6),
          Text(
            track.title.isEmpty ? 'Untitled track' : track.title,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 12,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            track.artist?.isNotEmpty == true ? track.artist! : track.creator,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: context.textSecondary, fontSize: 10.5),
          ),
        ],
      ),
    );
  }
}
