import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/video_service.dart';
import '../../../home/presentation/widgets/video_card.dart';

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key});

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends ConsumerState<SearchPage> {
  final _searchController = TextEditingController();
  List<dynamic> _searchResults = [];
  bool _isSearching = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _performSearch(String query) async {
    if (query.isEmpty) {
      setState(() {
        _searchResults = [];
      });
      return;
    }

    setState(() {
      _isSearching = true;
    });

    final results = await ref.read(videoServiceProvider).searchVideos(query);

    setState(() {
      _searchResults = results;
      _isSearching = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        title: TextField(
          controller: _searchController,
          autofocus: true,
          decoration: const InputDecoration(
            hintText: 'Search videos...',
            border: InputBorder.none,
            hintStyle: TextStyle(color: AppColors.textSecondaryDark),
          ),
          style: const TextStyle(color: AppColors.textPrimaryDark),
          onSubmitted: _performSearch,
          onChanged: (value) {
            if (value.isEmpty) {
              setState(() {
                _searchResults = [];
              });
            }
          },
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => _performSearch(_searchController.text),
          ),
        ],
      ),
      body: _isSearching
          ? const Center(child: CircularProgressIndicator())
          : _searchResults.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.search,
                        size: 64,
                        color: AppColors.textSecondaryDark.withValues(alpha: 0.5),
                      ),
                      const SizedBox(height: 16),
                      Text(
                        'Search for videos',
                        style: TextStyle(
                          color: AppColors.textSecondaryDark,
                          fontSize: 16,
                        ),
                      ),
                    ],
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(8),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 16 / 9,
                    crossAxisSpacing: 8,
                    mainAxisSpacing: 8,
                  ),
                  itemCount: _searchResults.length,
                  itemBuilder: (context, index) {
                    return VideoCard(video: _searchResults[index]);
                  },
                ),
    );
  }
}