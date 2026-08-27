import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/video.dart';

/// Horizontal "Music" shelf — square album-art style cards for videos
/// flagged Video.isMusic (contentType == 'music' or category == 'music',
/// see Video.fromJson). Derived from the already-fetched home feed list,
/// same source KidsRow uses, so no extra network round trip.
class MusicRow extends StatelessWidget {
  final List<Video> videos;

  const MusicRow({super.key, required this.videos});

  @override
  Widget build(BuildContext context) {
    if (videos.isEmpty) return const SizedBox.shrink();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              const Text('🎵', style: TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Text(
                'Music',
                style: TextStyle(
                  color: context.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 190,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: videos.length,
            itemBuilder: (context, index) => _buildCard(context, videos[index]),
          ),
        ),
      ],
    );
  }

  Widget _buildCard(BuildContext context, Video video) {
    return GestureDetector(
      onTap: () => context.push('/watch/${video.videoId}'),
      child: Container(
        width: 140,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: AspectRatio(
                aspectRatio: 1,
                child: video.thumbnail.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: video.thumbnail,
                        fit: BoxFit.cover,
                        errorWidget: (context, url, error) => _fallback(),
                      )
                    : _fallback(),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              video.title.isEmpty ? 'Untitled' : video.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              video.artist ?? video.creator,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: context.textSecondary, fontSize: 10),
            ),
          ],
        ),
      ),
    );
  }

  Widget _fallback() {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
        ),
      ),
      child: const Center(
        child: Icon(Icons.music_note, color: AppColors.brandOrange, size: 28),
      ),
    );
  }
}
