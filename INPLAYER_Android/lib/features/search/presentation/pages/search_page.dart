import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../models/video.dart';
import '../../../../services/video_service.dart';
import '../../../home/presentation/widgets/video_card.dart';

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  Timer? _debounce;

  List<Video> _searchResults = [];
  bool _isSearching = false;
  bool _hasSearched = false;
  String _lastQuery = '';

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();

    if (value.trim().isEmpty) {
      setState(() {
        _searchResults = [];
        _hasSearched = false;
        _isSearching = false;
      });
      return;
    }

    // Live search-as-you-type, debounced so we're not hitting the API on
    // every keystroke — matches the feel of the website's own navbar
    // search dropdown.
    _debounce = Timer(const Duration(milliseconds: 350), () {
      _performSearch(value);
    });
  }

  Future<void> _performSearch(String query) async {
    final trimmed = query.trim();
    if (trimmed.isEmpty) return;

    setState(() {
      _isSearching = true;
    });

    final results = await ref.read(videoServiceProvider).searchVideos(trimmed);

    if (!mounted) return;

    setState(() {
      _searchResults = results;
      _isSearching = false;
      _hasSearched = true;
      _lastQuery = trimmed;
    });
  }

  void _clearSearch() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() {
      _searchResults = [];
      _hasSearched = false;
      _isSearching = false;
    });
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        titleSpacing: 8,
        title: _buildSearchField(),
      ),
      body: _buildBody(),
    );
  }

  Widget _buildSearchField() {
    return Container(
      height: 44,
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.06),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withOpacity(0.1)),
      ),
      child: Row(
        children: [
          const SizedBox(width: 12),
          Icon(
            Icons.search,
            size: 20,
            color: AppColors.textSecondaryDark,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: TextField(
              controller: _searchController,
              focusNode: _focusNode,
              autofocus: true,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                isDense: true,
                hintText: 'Search InPlayer',
                border: InputBorder.none,
                hintStyle: TextStyle(
                  color: AppColors.textSecondaryDark.withOpacity(0.7),
                ),
              ),
              style: const TextStyle(
                color: AppColors.textPrimaryDark,
                fontWeight: FontWeight.w500,
              ),
              onSubmitted: _performSearch,
              onChanged: _onQueryChanged,
            ),
          ),
          if (_searchController.text.isNotEmpty)
            IconButton(
              icon: Icon(
                Icons.close,
                size: 18,
                color: AppColors.textSecondaryDark,
              ),
              onPressed: _clearSearch,
            )
          else
            const SizedBox(width: 12),
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

    if (_searchResults.isEmpty) {
      return _buildMessageState(
        icon: Icons.search_off,
        title: 'No results for "$_lastQuery"',
        subtitle: 'Try a different search term',
      );
    }

    // A single-column list (matching the home feed's own VideoCard layout)
    // — VideoCard is a thumbnail plus a two-line text block below it, so
    // forcing it into a fixed 16:9 grid cell (the previous implementation)
    // clipped/overflowed the title and channel info.
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: _searchResults.length,
      separatorBuilder: (context, index) => const SizedBox(height: 20),
      itemBuilder: (context, index) {
        return VideoCard(video: _searchResults[index]);
      },
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
              color: AppColors.textSecondaryDark.withOpacity(0.5),
            ),
            const SizedBox(height: 16),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: AppColors.textPrimaryDark,
                fontSize: 17,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: AppColors.textSecondaryDark.withOpacity(0.8),
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
