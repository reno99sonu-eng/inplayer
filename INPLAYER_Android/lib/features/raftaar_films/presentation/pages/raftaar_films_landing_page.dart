import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../models/film_series.dart';
import '../../../../services/raftaar_films_service.dart';
import '../widgets/genre_chip_bar.dart';
import '../widgets/film_search_bar.dart';
import '../widgets/creator_stories_strip.dart';
import '../widgets/series_card_widget.dart';
import '../widgets/raftaar_films_intro_animation.dart';

class RaftaarFilmsLandingPage extends ConsumerStatefulWidget {
  final bool showIntro;
  final double bottomInset;
  const RaftaarFilmsLandingPage({
    super.key,
    this.showIntro = false,
    this.bottomInset = 0,
  });

  @override
  ConsumerState<RaftaarFilmsLandingPage> createState() =>
      _RaftaarFilmsLandingPageState();
}

class _RaftaarFilmsLandingPageState
    extends ConsumerState<RaftaarFilmsLandingPage> {
  final TextEditingController _searchController = TextEditingController();

  late bool _introActive;
  List<FilmSeries> _allSeries = [];
  List<FilmSeries> _filteredSeries = [];
  List<String> _genres = ['All'];
  String _selectedGenre = 'All';
  String? _selectedCreatorId;
  bool _isLoading = true;
  bool _isApproved = false;
  bool _isSearchOpen = false;

  @override
  void initState() {
    super.initState();
    _introActive = widget.showIntro;
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
        service.isApprovedCreator(),
      ]);

      final seriesList = results[0] as List<FilmSeries>;
      final rawGenres = results[1] as List<Map<String, dynamic>>;
      final isApproved = results[2] as bool;

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
          _isApproved = isApproved;
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
        final gLower = _selectedGenre.toLowerCase();
        final matchesGenre =
            _selectedGenre == 'All' ||
            s.genre.toLowerCase() == gLower ||
            s.categories.any((c) => c.toLowerCase() == gLower);
        final matchesCreator =
            _selectedCreatorId == null || s.creatorId == _selectedCreatorId;
        final matchesQuery =
            query.isEmpty ||
            s.title.toLowerCase().contains(query) ||
            s.description.toLowerCase().contains(query) ||
            s.creatorName.toLowerCase().contains(query) ||
            s.genre.toLowerCase().contains(query) ||
            s.categories.any((c) => c.toLowerCase().contains(query));
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
    return unique.values.take(10).toList();
  }

  Widget _buildCreatorCallToAction(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 28),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.fromLTRB(18, 20, 18, 18),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF171717), Color(0xFF090909)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: Colors.white.withValues(alpha: 0.10)),
          boxShadow: const [
            BoxShadow(
              color: Colors.black54,
              blurRadius: 18,
              offset: Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          children: [
            Text(
              _isApproved
                  ? 'Ready to Publish Your Next Episode?'
                  : 'Got a Micro-Drama Story to Tell?',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 17,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 7),
            Text(
              _isApproved
                  ? 'Create a series, upload vertical episodes, and share your story.'
                  : 'Join Raftaar Films and share your vertical micro-drama with viewers.',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white60,
                fontSize: 12,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 15),
            Wrap(
              alignment: WrapAlignment.center,
              spacing: 9,
              runSpacing: 9,
              children: _isApproved
                  ? [
                      _creatorActionButton(
                        label: 'Upload Episode',
                        icon: Icons.video_call_rounded,
                        primary: true,
                        onTap: () => context.push('/upload?type=film'),
                      ),
                      _creatorActionButton(
                        label: 'Series Studio',
                        icon: Icons.video_library_outlined,
                        primary: false,
                        onTap: () =>
                            context.push('/my-videos?tab=raftaar-films'),
                      ),
                    ]
                  : [
                      _creatorActionButton(
                        label: 'Apply as Creator',
                        icon: Icons.stars_rounded,
                        primary: true,
                        onTap: () => context.push('/raftaar-films/apply'),
                      ),
                    ],
            ),
            if (!_isApproved) ...[
              const SizedBox(height: 10),
              const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.circle, color: Color(0xFF22C55E), size: 7),
                  SizedBox(width: 6),
                  Text(
                    'Fast-track review within 48–72 hours',
                    style: TextStyle(color: Colors.white54, fontSize: 10.5),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _creatorActionButton({
    required String label,
    required IconData icon,
    required bool primary,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(24),
        child: Ink(
          padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
          decoration: BoxDecoration(
            gradient: primary
                ? const LinearGradient(
                    colors: [Color(0xFFFF7A18), Color(0xFFFFB000)],
                  )
                : null,
            color: primary ? null : Colors.white.withValues(alpha: 0.08),
            border: primary
                ? null
                : Border.all(color: Colors.white.withValues(alpha: 0.16)),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                color: primary ? Colors.black : Colors.white,
                size: 15,
              ),
              const SizedBox(width: 6),
              Text(
                label,
                style: TextStyle(
                  color: primary ? Colors.black : Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final creators = _extractCreators();

    final scaffold = Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new_rounded,
            color: Colors.white,
            size: 20,
          ),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/');
            }
          },
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
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 15,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        centerTitle: false,
        actions: [
          IconButton(
            icon: Icon(
              _isSearchOpen ? Icons.close_rounded : Icons.search_rounded,
              color: _isSearchOpen ? const Color(0xFFFF7A18) : Colors.white,
              size: 22,
            ),
            onPressed: () {
              setState(() {
                _isSearchOpen = !_isSearchOpen;
                if (!_isSearchOpen) {
                  _searchController.clear();
                  _filterSeries();
                }
              });
            },
          ),
          if (_isApproved)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: InkWell(
                onTap: () => context.push('/upload?type=film'),
                borderRadius: BorderRadius.circular(12),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFF7A18), Color(0xFFFF9A00)],
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFFF7A18).withValues(alpha: 0.35),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.video_call_rounded,
                        color: Colors.white,
                        size: 16,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Upload',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
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
      body: RefreshIndicator(
        color: AppColors.brandOrange,
        onRefresh: _loadData,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(
            parent: BouncingScrollPhysics(),
          ),
          slivers: [
            // Expandable Search Bar (Opened via Magnifying Glass)
            if (_isSearchOpen)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 6, 16, 10),
                  child: FilmSearchBar(
                    controller: _searchController,
                    onChanged: (val) => _filterSeries(),
                    onClear: () => _filterSeries(),
                  ),
                ),
              ),

            // Creator Stories Strip (At the Top)
            if (creators.isNotEmpty)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(top: 4, bottom: 8),
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

            // Genres Bar (Just below Creator Stories)
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 12),
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

            // Compact section header, matching the website's mobile layout.
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 2, 16, 10),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      _selectedGenre == 'All'
                          ? 'Explore Micro-Series'
                          : '$_selectedGenre Micro-Series',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                    ),
                    Text(
                      '${_filteredSeries.length} series',
                      style: TextStyle(
                        color: Colors.white54,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Series 2-column Grid
            if (_isLoading)
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 14,
                    childAspectRatio: 0.55,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => Container(
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.05),
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
                        color: Colors.white24,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'No micro-series found',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Try searching for another keyword or select a different genre.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Colors.white38, fontSize: 13),
                      ),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 14,
                    childAspectRatio: 0.55,
                  ),
                  delegate: SliverChildBuilderDelegate((context, index) {
                    final series = _filteredSeries[index];
                    return SeriesCardWidget(series: series);
                  }, childCount: _filteredSeries.length),
                ),
              ),

            SliverToBoxAdapter(child: _buildCreatorCallToAction(context)),
            if (widget.bottomInset > 0)
              SliverToBoxAdapter(child: SizedBox(height: widget.bottomInset)),
          ],
        ),
      ),
    );

    if (!_introActive) {
      return scaffold;
    }

    return Stack(
      children: [
        scaffold,
        RaftaarFilmsIntroAnimation(
          onComplete: () {
            if (mounted) {
              setState(() => _introActive = false);
            }
          },
        ),
      ],
    );
  }
}
