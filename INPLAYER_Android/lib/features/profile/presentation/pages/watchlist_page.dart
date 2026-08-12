import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/watchlist_service.dart';
import '../widgets/simple_media_tile.dart';

class WatchlistPage extends ConsumerStatefulWidget {
  const WatchlistPage({super.key});

  @override
  ConsumerState<WatchlistPage> createState() => _WatchlistPageState();
}

class _WatchlistPageState extends ConsumerState<WatchlistPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final items = await ref.read(watchlistServiceProvider).getWatchlist();
    if (!mounted) return;
    setState(() {
      _items = items;
      _loading = false;
    });
  }

  Future<void> _remove(int index) async {
    final item = _items[index];
    final videoId = item['videoId']?.toString() ?? '';
    if (videoId.isEmpty) return;

    setState(() => _items = List.of(_items)..removeAt(index));

    final ok = await ref.read(watchlistServiceProvider).remove(videoId);
    if (!ok && mounted) {
      // Put it back if the removal didn't actually succeed server-side.
      setState(() => _items = List.of(_items)..insert(index, item));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text("Couldn't remove that video."),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text(
          'Watchlist',
          style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimaryDark),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange))
          : RefreshIndicator(
              color: AppColors.brandOrange,
              backgroundColor: AppColors.surfaceDark,
              onRefresh: _load,
              child: _items.isEmpty
                  ? ListView(
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.6,
                          child: const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.bookmark_outline,
                                    size: 48, color: AppColors.textSecondaryDark),
                                SizedBox(height: 16),
                                Text('Nothing saved for later yet',
                                    style:
                                        TextStyle(color: AppColors.textSecondaryDark)),
                              ],
                            ),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      itemCount: _items.length,
                      separatorBuilder: (context, index) =>
                          const Divider(height: 1, color: AppColors.cardDark),
                      itemBuilder: (context, index) {
                        final item = _items[index];
                        return SimpleMediaTile(
                          videoId: item['videoId']?.toString() ?? '',
                          title: item['title']?.toString() ?? '',
                          thumbnailUrl: item['thumbnailUrl'] as String?,
                          timeLabel: 'Saved ${formatTimeAgo(item['addedAt'] as String?)}',
                          onRemove: () => _remove(index),
                        );
                      },
                    ),
            ),
    );
  }
}
