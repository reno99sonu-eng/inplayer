import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../models/channel.dart';
import '../../../../models/video.dart';
import '../../../../models/video_suggestion.dart';
import '../../../../services/channel_service.dart';
import '../../../../services/video_service.dart';
import '../../../home/presentation/widgets/video_card.dart';

/// Matches MobileSearchOverlay.tsx's exact `placeholders` array and 2200ms
/// rotation interval on the website's search input.
const _kSearchPlaceholders = [
  'Search Movies...',
  'Search TV Shows...',
  'Search Music...',
  'Search Podcasts...',
  'Search Live...',
  'Search Shorts...',
  'Search Creators...',
];

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _debounce;
  Timer? _suggestDebounce;
  int _suggestRequestId = 0;

  List<Video> _searchResults = [];
  List<Channel> _creatorResults = [];
  bool _isSearching = false;
  bool _hasSearched = false;
  String _lastQuery = '';

  List<VideoSuggestion> _suggestions = [];

  // Rotating hint text, matching the website's animated search placeholder.
  Timer? _placeholderTimer;
  int _placeholderIndex = 0;

  // Voice search — mic icon in the search field. speech_to_text handles the
  // RECORD_AUDIO runtime permission prompt itself inside initialize(), so
  // no separate permission_handler dependency was needed; a false/denied
  // result just surfaces as the honest snackbar below rather than a silent
  // no-op.
  final stt.SpeechToText _speech = stt.SpeechToText();
  bool _isListening = false;

  @override
  void initState() {
    super.initState();
    // Rebuild on focus change so the suggestions dropdown hides the moment
    // the field loses focus (e.g. tapping a result), not just on text change.
    _focusNode.addListener(() {
      if (mounted) setState(() {});
    });
    _placeholderTimer = Timer.periodic(const Duration(milliseconds: 2200), (_) {
      if (!mounted) return;
      setState(() {
        _placeholderIndex = (_placeholderIndex + 1) % _kSearchPlaceholders.length;
      });
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _suggestDebounce?.cancel();
    _placeholderTimer?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    if (_isListening) _speech.stop();
    super.dispose();
  }

  Future<void> _toggleVoiceSearch() async {
    if (_isListening) {
      await _speech.stop();
      if (mounted) setState(() => _isListening = false);
      return;
    }

    final available = await _speech.initialize(
      onStatus: (status) {
        if (status == 'done' || status == 'notListening') {
          if (mounted) setState(() => _isListening = false);
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
            content: Text("Couldn't access the microphone. Check the app's microphone permission in system settings."),
          ),
        );
      }
      return;
    }

    if (!mounted) return;
    setState(() => _isListening = true);
    _speech.listen(
      onResult: (result) {
        _searchController.text = result.recognizedWords;
        _searchController.selection = TextSelection.collapsed(offset: _searchController.text.length);
        _onQueryChanged(result.recognizedWords);
        if (result.finalResult && mounted) {
          setState(() => _isListening = false);
        }
      },
    );
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _suggestDebounce?.cancel();

    // Keep the trailing clear action and focused visual state in sync with
    // every keystroke, rather than waiting for a network response.
    if (mounted) setState(() {});

    if (value.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _creatorResults = [];
        _hasSearched = false;
        _isSearching = false;
        _suggestions = [];
      });
      return;
    }

    // Suggestions are a fast, separate typeahead — much shorter debounce
    // than the full-results search below, since it's just an in-memory
    // filter server-side (see video_service.dart's getSuggestions()).
    _suggestDebounce = Timer(const Duration(milliseconds: 150), () {
      _fetchSuggestions(value);
    });

    _debounce = Timer(const Duration(milliseconds: 350), () {
      _performSearch(value);
    });
  }

  Future<void> _fetchSuggestions(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;

    final requestId = ++_suggestRequestId;
    final results = await ref.read(videoServiceProvider).getSuggestions(trimmed);

    // Drop stale responses — a slower earlier request can otherwise land
    // after a faster later one and show suggestions for an old keystroke.
    if (!mounted || requestId != _suggestRequestId) return;

    setState(() {
      _suggestions = results;
    });
  }

  Future<void> _performSearch(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;

    setState(() {
      _isSearching = true;
    });

    // Matches app/videos/page.tsx: a search also looks for matching
    // creators/usernames, shown as its own row above the video grid.
    final results = await Future.wait([
      ref.read(videoServiceProvider).searchVideos(trimmed),
      ref.read(channelServiceProvider).searchChannels(trimmed),
    ]);

    if (!mounted) return;

    setState(() {
      _searchResults = results[0] as List<Video>;
      _creatorResults = results[1] as List<Channel>;
      _isSearching = false;
      _hasSearched = true;
      _lastQuery = trimmed;
      _suggestions = [];
    });
  }

  void _onSuggestionTap(VideoSuggestion suggestion) {
    _debounce?.cancel();
    _suggestDebounce?.cancel();
    _searchController.text = suggestion.title;
    setState(() {
      _suggestions = [];
    });
    _focusNode.unfocus();
    context.push('/watch/${suggestion.videoId}');
  }

  void _clearSearch() {
    _debounce?.cancel();
    _suggestDebounce?.cancel();
    _searchController.clear();
    setState(() {
      _searchResults = [];
      _creatorResults = [];
      _hasSearched = false;
      _isSearching = false;
      _suggestions = [];
    });
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          titleSpacing: 8,
          title: _buildSearchField(),
        ),
        body: Stack(
          children: [
            _buildBody(),
            if (_focusNode.hasFocus && !_hasSearched && _suggestions.isNotEmpty)
              _buildSuggestionsDropdown(),
          ],
        ),
      ),
    );
  }

  Widget _buildSuggestionsDropdown() {
    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: Material(
        color: Colors.transparent,
        child: Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          constraints: const BoxConstraints(maxHeight: 320),
          decoration: BoxDecoration(
            color: context.bgCard,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: context.borderSubtle),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.15),
                blurRadius: 12,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: ListView.separated(
            shrinkWrap: true,
            padding: const EdgeInsets.symmetric(vertical: 6),
            itemCount: _suggestions.length,
            separatorBuilder: (context, index) => Divider(
              height: 1,
              color: context.borderSubtle,
            ),
            itemBuilder: (context, index) {
              final suggestion = _suggestions[index];
              return ListTile(
                dense: true,
                leading: _buildSuggestionThumbnail(suggestion),
                title: Text(
                  suggestion.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                onTap: () => _onSuggestionTap(suggestion),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildSuggestionThumbnail(VideoSuggestion suggestion) {
    final url = (suggestion.thumbnailUrl ?? '').trim();
    final isHttp = url.startsWith('http://') || url.startsWith('https://');

    return ClipRRect(
      borderRadius: BorderRadius.circular(6),
      child: SizedBox(
        width: 44,
        height: 44,
        child: isHttp
            ? CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                errorWidget: (context, url, error) => _suggestionThumbnailFallback(),
              )
            : _suggestionThumbnailFallback(),
      ),
    );
  }

  Widget _suggestionThumbnailFallback() {
    return Container(
      color: AppColors.surfaceDark,
      child: const Icon(Icons.play_circle_outline, size: 18, color: AppColors.brandOrange),
    );
  }

  Widget _buildSearchField() {
    final isDark = context.isDark;
    final isFocused = _focusNode.hasFocus;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      height: 50,
      decoration: BoxDecoration(
        color: (isDark ? const Color(0xFF0F172A) : Colors.white).withValues(alpha: 0.90),
         borderRadius: BorderRadius.circular(25),
          // Borderless glass treatment; focus is communicated by the glow.
          border: Border.all(color: Colors.transparent, width: 0),
        boxShadow: isFocused
            ? [
                BoxShadow(
                  color: AppColors.brandOrange.withValues(alpha: isDark ? 0.25 : 0.15),
                  blurRadius: 16,
                  spreadRadius: 1,
                ),
              ]
            : [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.05),
                  blurRadius: 10,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Row(
        children: [
          const SizedBox(width: 14),
          Icon(
            Icons.search_rounded,
            size: 20,
            color: isFocused ? AppColors.brandOrange : context.textDim,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: TextField(
              controller: _searchController,
              focusNode: _focusNode,
              autofocus: true,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                isDense: true,
                hintText: _kSearchPlaceholders[_placeholderIndex],
                border: InputBorder.none,
                hintStyle: TextStyle(
                  color: context.textDim,
                  fontSize: 13.5,
                ),
              ),
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
              onSubmitted: _performSearch,
              onChanged: _onQueryChanged,
            ),
          ),
          if (_searchController.text.isNotEmpty)
            IconButton(
              icon: Icon(
                Icons.close_rounded,
                size: 18,
                color: context.textSecondary,
              ),
              onPressed: _clearSearch,
            ),
          Container(
            margin: const EdgeInsets.only(right: 6),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isListening
                  ? AppColors.brandOrange.withValues(alpha: 0.2)
                  : Colors.transparent,
            ),
            child: IconButton(
              icon: Icon(
                _isListening ? Icons.mic_rounded : Icons.mic_none_rounded,
                size: 20,
                color: _isListening ? AppColors.brandOrange : context.textSecondary,
              ),
              onPressed: _toggleVoiceSearch,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isSearching) {
      return const Center(
        child: CircularProgressIndicator(color: AppColors.brandOrange),
      );
    }

    if (!_hasSearched) {
      return _buildMessageState(
        icon: Icons.search,
        title: 'Search InPlayer',
        subtitle: 'Find videos, creators, and more',
      );
    }

    if (_searchResults.isEmpty && _creatorResults.isEmpty) {
      return _buildMessageState(
        icon: Icons.search_off,
        title: 'No results for "$_lastQuery"',
        subtitle: 'Try a different search term',
      );
    }

    // Matches app/videos/page.tsx: a Creators row above a 2-column video
    // grid (the website goes 2/3/4 columns by breakpoint; the app has one
    // phone-sized layout, so it stays at 2).
    return CustomScrollView(
      slivers: [
        if (_creatorResults.isNotEmpty)
          SliverToBoxAdapter(child: _buildCreatorsRow()),
        if (_searchResults.isEmpty)
          SliverFillRemaining(
            hasScrollBody: false,
            child: _buildMessageState(
              icon: Icons.search_off,
              title: 'No results for "$_lastQuery"',
              subtitle: 'Try a different search term',
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            sliver: SliverGrid(
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                mainAxisSpacing: 20,
                crossAxisSpacing: 12,
                // VideoCard carries more content (thumbnail + 2-line title +
                // subtitle + feedback row) than other grid cards in this app
                // (e.g. discover_creators_page's 0.68), so a shorter ratio
                // is used here to give it enough vertical room and avoid
                // overflow on narrow/small-text-scaled screens.
                childAspectRatio: 0.62,
              ),
              delegate: SliverChildBuilderDelegate(
                (context, index) => VideoCard(video: _searchResults[index]),
                childCount: _searchResults.length,
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildCreatorsRow() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Creators',
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 13,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _creatorResults.map((creator) {
              return GestureDetector(
                onTap: () {
                  _focusNode.unfocus();
                  context.push('/channel/${Uri.encodeComponent(creator.username)}');
                },
                child: Container(
                  padding: const EdgeInsets.fromLTRB(4, 4, 14, 4),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: context.borderSubtle),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: SizedBox(
                          width: 32,
                          height: 32,
                          child: (creator.avatarUrl ?? '').startsWith('http')
                              ? CachedNetworkImage(
                                  imageUrl: creator.avatarUrl!,
                                  fit: BoxFit.cover,
                                  errorWidget: (context, url, error) => Container(
                                    color: AppColors.surfaceDark,
                                    child: const Icon(Icons.person, size: 16, color: AppColors.brandOrange),
                                  ),
                                )
                              : Container(
                                  color: AppColors.surfaceDark,
                                  child: const Icon(Icons.person, size: 16, color: AppColors.brandOrange),
                                ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        '@${creator.username}',
                        style: TextStyle(
                          color: context.textPrimary,
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageState({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 56,
              color: context.textDim,
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: context.textSecondary,
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
