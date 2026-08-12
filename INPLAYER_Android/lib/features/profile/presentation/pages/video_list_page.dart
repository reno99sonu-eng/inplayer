import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../models/video.dart';
import '../../../home/presentation/widgets/video_card.dart';

/// Generic "list of full Video objects" profile screen — backs My Videos
/// and Liked Videos, which both return real `Video` records (just from
/// different endpoints) and only differ in title/empty-state copy/loader.
class VideoListPage extends ConsumerStatefulWidget {
  final String title;
  final IconData emptyIcon;
  final String emptyMessage;
  final Future<List<Video>> Function(WidgetRef ref) loader;

  const VideoListPage({
    super.key,
    required this.title,
    required this.emptyIcon,
    required this.emptyMessage,
    required this.loader,
  });

  @override
  ConsumerState<VideoListPage> createState() => _VideoListPageState();
}

class _VideoListPageState extends ConsumerState<VideoListPage> {
  bool _loading = true;
  List<Video> _videos = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final videos = await widget.loader(ref);
    if (!mounted) return;
    setState(() {
      _videos = videos;
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
        title: Text(
          widget.title,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.brandOrange),
            )
          : RefreshIndicator(
              color: AppColors.brandOrange,
              backgroundColor: AppColors.surfaceDark,
              onRefresh: _load,
              child: _videos.isEmpty
                  ? ListView(
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.6,
                          child: Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(widget.emptyIcon,
                                    size: 48, color: AppColors.textSecondaryDark),
                                const SizedBox(height: 16),
                                Text(
                                  widget.emptyMessage,
                                  style: const TextStyle(
                                      color: AppColors.textSecondaryDark),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(16),
                      itemCount: _videos.length,
                      separatorBuilder: (context, index) => const SizedBox(height: 24),
                      itemBuilder: (context, index) => VideoCard(video: _videos[index]),
                    ),
            ),
    );
  }
}
