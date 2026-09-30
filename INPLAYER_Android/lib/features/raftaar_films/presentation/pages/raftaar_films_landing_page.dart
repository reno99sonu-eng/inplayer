import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../models/film_series.dart';
import '../../../../services/raftaar_films_service.dart';
import '../widgets/genre_chip_bar.dart';
import '../widgets/film_search_bar.dart';
import '../widgets/creator_stories_strip.dart';
import '../widgets/series_card_widget.dart';

class RaftaarFilmsLandingPage extends ConsumerStatefulWidget {
  const RaftaarFilmsLandingPage({super.key});

  @override
  ConsumerState<RaftaarFilmsLandingPage> createState() =>
      _RaftaarFilmsLandingPageState();
}

class _RaftaarFilmsLandingPageState
    extends ConsumerState<RaftaarFilmsLandingPage> {
  final TextEditingController _searchController = TextEditingController();

  List<FilmSeries> _allSeries = [];
  List<FilmSeries> _filteredSeries = [];
  List<String> _genres = ['All'];
  String _selectedGenre = 'All';
  String? _selectedCreatorId;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final service = ref.read(raftaarFilmsServiceProvider);

    try {
      final results = await Future.wait([
        service.getSeries(),
        service.getGenres(),
      ]);

      final seriesList = results[0] as List<FilmSeries>;
      final rawGenres = results[1] as List<Map<String, dynamic>>;

      final genresList = ['All'];
      for (final g in rawGenres) {
        final name = g['genre']?.toString();
        if (name != null && name.isNotEmpty && !genresList.contains(name)) {
          genresList.add(name);
        }
      }

      if (genresList.length == 1) {
        genresList.addAll([
          'Drama',
          'Thriller',
          'Comedy',
          'Romance',
          'Horror',
          'Action',
          'Sci-Fi',
          'Mystery',
        ]);
      }

      if (mounted) {
        setState(() {
          _allSeries = seriesList;
          _genres = genresList;
          _filterSeries();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _filterSeries() {
    final query = _searchController.text.trim().toLowerCase();
    setState(() {
      _filteredSeries = _allSeries.where((s) {
        final matchesGenre = _selectedGenre == 'All' ||
            s.genre.toLowerCase() == _selectedGenre.toLowerCase();
        final matchesCreator = _selectedCreatorId == null ||
            s.creatorId == _selectedCreatorId;
        final matchesQuery = query.isEmpty ||
            s.title.toLowerCase().contains(query) ||
            s.description.toLowerCase().contains(query) ||
            s.creatorName.toLowerCase().contains(query);
        return matchesGenre && matchesCreator && matchesQuery;
      }).toList();
    });
  }

  List<CreatorStoryItem> _extractCreators() {
    final Map<String, CreatorStoryItem> unique = {};
    for (final s in _allSeries) {
      if (s.creatorId.isNotEmpty && !unique.containsKey(s.creatorId)) {
        unique[s.creatorId] = CreatorStoryItem(
          creatorId: s.creatorId,
          creatorName: s.creatorName,
          creatorAvatarUrl: s.creatorAvatarUrl,
          creatorHandle: s.creatorHandle,
        );
      }
    }
    return unique.values.toList();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    final creators = _extractCreators();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F0F13) : Colors.white,
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF0F0F13) : Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new_rounded,
            color: isDark ? Colors.white : Colors.black87,
            size: 20,
          ),
          onPressed: () => context.pop(),
        ),
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(10),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFF7A18).withValues(alpha: 0.5),
                    blurRadius: 16,
                    spreadRadius: 2,
                  ),
                ],
              ),
              child: Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFFF7A18), Color(0xFFFF9A00)],
                  ),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(
                  Icons.movie_filter_rounded,
                  color: Colors.white,
                  size: 18,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Text(
              'Raftaar Films',
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w800,
                fontSize: 19,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        centerTitle: false,
        actions: [
          TextButton.icon(
            onPressed: () => context.push('/raftaar-films/apply'),
            icon: const Icon(
              Icons.stars_rounded,
              color: Color(0xFFFF9A00),
              size: 18,
            ),
            label: const Text(
              'Apply',
              style: TextStyle(
                color: Color(0xFFFF9A00),
                fontWeight: FontWeight.w700,
                fontSize: 13,
              ),
            ),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: PatternBackground(
        child: RefreshIndicator(
          color: AppColors.brandOrange,
          onRefresh: _loadData,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(
              parent: BouncingScrollPhysics(),
            ),
            slivers: [
              // Search Bar
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                  child: FilmSearchBar(
                    controller: _searchController,
                    onChanged: (val) => _filterSeries(),
                    onClear: () => _filterSeries(),
                  ),
                ),
              ),

              // Genres Bar
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: GenreChipBar(
                    genres: _genres,
                    selectedGenre: _selectedGenre,
                    onSelectGenre: (g) {
                      setState(() {
                        _selectedGenre = g;
                        _filterSeries();
                      });
                    },
                  ),
                ),
              ),

              // Creator Stories Strip
              if (creators.isNotEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: CreatorStoriesStrip(
                      creators: creators,
                      selectedCreatorId: _selectedCreatorId,
                      onSelectCreator: (id) {
                        setState(() {
                          _selectedCreatorId = id;
                          _filterSeries();
                        });
                      },
                    ),
                  ),
                ),

              // Creator Application Prompt Banner
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: () => context.push('/raftaar-films/apply'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 12,
                      ),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: isDark
                              ? [
                                  const Color(0xFF1F1B2E),
                                  const Color(0xFF13101E),
                                ]
                              : [
                                  const Color(0xFFFFF7ED),
                                  const Color(0xFFFFEDD5),
                                ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: const Color(0xFFFF7A18).withValues(alpha: 0.35),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: const Color(0xFFFF7A18).withValues(alpha: 0.15),
                            ),
                            child: const Icon(
                              Icons.video_library_rounded,
                              color: Color(0xFFFF7A18),
                              size: 22,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      'Create Raftaar Films',
                                      style: TextStyle(
                                        color: isDark ? Colors.white : Colors.black87,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 13.5,
                                      ),
                                    ),
                                    const SizedBox(width: 6),
                                    Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 2,
                                      ),
                                      decoration: BoxDecoration(
                                        color: Colors.green.withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: const Text(
                                        '48-72h SLA',
                                        style: TextStyle(
                                          color: Colors.greenAccent,
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Apply as a creator to publish micro-drama series.',
                                  style: TextStyle(
                                    color: isDark ? Colors.white60 : Colors.black54,
                                    fontSize: 11.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Icon(
                            Icons.arrow_forward_ios_rounded,
                            size: 14,
                            color: Color(0xFFFF9A00),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),

              // Series 2-column Grid
              if (_isLoading)
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 14,
                      childAspectRatio: 9 / 14,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) => Container(
                        decoration: BoxDecoration(
                          color: isDark
                              ? Colors.white.withValues(alpha: 0.05)
                              : Colors.black.withValues(alpha: 0.04),
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      childCount: 6,
                    ),
                  ),
                )
              else if (_filteredSeries.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 60,
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.movie_creation_outlined,
                          size: 64,
                          color: isDark ? Colors.white24 : Colors.black26,
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No micro-series found',
                          style: TextStyle(
                            color: isDark ? Colors.white70 : Colors.black87,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Try searching for another keyword or select a different genre.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            color: isDark ? Colors.white38 : Colors.black45,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  sliver: SliverGrid(
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 14,
                      childAspectRatio: 9 / 14,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final series = _filteredSeries[index];
                        return SeriesCardWidget(series: series);
                      },
                      childCount: _filteredSeries.length,
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
