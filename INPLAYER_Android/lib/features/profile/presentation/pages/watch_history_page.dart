import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/history_service.dart';
import '../widgets/simple_media_tile.dart';

class WatchHistoryPage extends ConsumerStatefulWidget {
  const WatchHistoryPage({super.key});

  @override
  ConsumerState<WatchHistoryPage> createState() => _WatchHistoryPageState();
}

class _WatchHistoryPageState extends ConsumerState<WatchHistoryPage> {
  bool _loading = true;
  List<Map<String, dynamic>> _history = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final history = await ref.read(historyServiceProvider).getHistory();
    if (!mounted) return;
    setState(() {
      _history = history;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text(
          'Watch History',
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
              child: _history.isEmpty
                  ? ListView(
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.6,
                          child: const Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.history,
                                    size: 48, color: AppColors.textSecondaryDark),
                                SizedBox(height: 16),
                                Text('No watch history yet',
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
                      itemCount: _history.length,
                      separatorBuilder: (context, index) =>
                          const Divider(height: 1, color: AppColors.cardDark),
                      itemBuilder: (context, index) {
                        final item = _history[index];
                        return SimpleMediaTile(
                          videoId: item['videoId']?.toString() ?? '',
                          title: item['title']?.toString() ?? '',
                          thumbnailUrl: item['thumbnailUrl'] as String?,
                          timeLabel: 'Watched ${formatTimeAgo(item['watchedAt'] as String?)}',
                        );
                      },
                    ),
            ),
    );
  }
}
