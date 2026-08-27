import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/video.dart';
import '../../../../services/video_service.dart';
import '../widgets/music_track_tile.dart';

/// Liked Songs — there's no separate "liked music" concept on the
/// backend (a like is a like regardless of content type), so this reuses
/// the same GET /api/likes/my-likes the general Liked Videos screen
/// already calls and filters to [Video.isMusic] client-side. No backend
/// change needed for this one.
class LikedMusicPage extends ConsumerStatefulWidget {
  const LikedMusicPage({super.key});

  @override
  ConsumerState<LikedMusicPage> createState() => _LikedMusicPageState();
}

class _LikedMusicPageState extends ConsumerState<LikedMusicPage> {
  List<Video>? _tracks;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final liked = await ref.read(videoServiceProvider).getLikedVideos();
    if (!mounted) return;
    setState(() {
      _tracks = liked.where((v) => v.isMusic).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        title: Text('Liked Songs', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.w800, fontSize: 19)),
      ),
      body: _tracks == null
          ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
          : _tracks!.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.favorite_border_rounded, size: 52, color: context.textDim),
                        const SizedBox(height: 14),
                        Text('No liked songs yet', style: TextStyle(color: context.textPrimary, fontSize: 16, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Text(
                          'Tap the like button on any track and it will show up here.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: context.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  color: AppColors.brandOrange,
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    itemCount: _tracks!.length,
                    itemBuilder: (context, i) => MusicTrackTile(track: _tracks![i], queue: _tracks!, index: i),
                  ),
                ),
    );
  }
}
