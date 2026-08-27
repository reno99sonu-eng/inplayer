import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/video.dart';
import '../../../../services/video_service.dart';
import '../widgets/video_card.dart';

/// A single content category, filtered from the same visible-videos list
/// every other listing surface reads (GET /api/videos) — the real
/// equivalent of the website's /videos?category=X (app/videos/page.tsx),
/// which does the exact same thing: fetch everything visible, then filter
/// client-side by `video.category === category`. There's no server-side
/// `?category=` param on the API — the website's own listing page doesn't
/// use one either.
class CategoryVideosPage extends ConsumerStatefulWidget {
  final String category;
  const CategoryVideosPage({super.key, required this.category});

  @override
  ConsumerState<CategoryVideosPage> createState() => _CategoryVideosPageState();
}

class _CategoryVideosPageState extends ConsumerState<CategoryVideosPage> {
  List<Video>? _videos;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final all = await ref.read(videoServiceProvider).getVideos();
    if (!mounted) return;
    setState(() {
      _videos = all.where((v) => v.category == widget.category).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        title: Text(
          widget.category,
          style: TextStyle(fontWeight: FontWeight.w800, color: context.textPrimary, fontSize: 18),
        ),
      ),
      body: _videos == null
          ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
          : _videos!.isEmpty
              ? _buildEmptyState()
              : RefreshIndicator(
                  color: AppColors.brandOrange,
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _videos!.length,
                    separatorBuilder: (context, index) => const SizedBox(height: 20),
                    itemBuilder: (context, index) => VideoCard(video: _videos![index]),
                  ),
                ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.video_library_outlined, size: 56, color: context.textDim),
            const SizedBox(height: 16),
            Text(
              'No videos in ${widget.category} yet',
              textAlign: TextAlign.center,
              style: TextStyle(color: context.textPrimary, fontSize: 16, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 6),
            Text(
              'Try a different category, or check back later.',
              textAlign: TextAlign.center,
              style: TextStyle(color: context.textSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
