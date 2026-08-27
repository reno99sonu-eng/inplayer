import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../services/playlist_service.dart';
import '../../../../services/video_service.dart';
import '../../../../models/video.dart';
import '../../../../models/playlist.dart';
import '../../../home/presentation/widgets/video_card.dart';

class PlaylistDetailPage extends ConsumerStatefulWidget {
  final String playlistId;
  final String? name;

  const PlaylistDetailPage({
    super.key,
    required this.playlistId,
    this.name,
  });

  @override
  ConsumerState<PlaylistDetailPage> createState() =>
      _PlaylistDetailPageState();
}

class _PlaylistDetailPageState
    extends ConsumerState<PlaylistDetailPage> {
  bool _loading = true;
  String? _name;
  List<Video> _videos = [];

  @override
  void initState() {
    super.initState();
    _name = widget.name;
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);

    final playlists =
        await ref.read(playlistServiceProvider).getPlaylists();

    Playlist? match;

    for (final p in playlists) {
      if (p.playlistId == widget.playlistId) {
        match = p;
        break;
      }
    }

    if (match == null) {
      if (mounted) {
        setState(() => _loading = false);
      }
      return;
    }

    final playlist = match;

    final videoService = ref.read(videoServiceProvider);

    final videos = await Future.wait(
      playlist.videoIds.map(
        (id) => videoService.getVideoById(id),
      ),
    );

    if (!mounted) return;

    setState(() {
      _name = playlist.reserved ? 'Saved' : playlist.name;
      _videos = videos.whereType<Video>().toList();
      _loading = false;
    });
  }

  Future<void> _removeVideo(Video video) async {
    setState(() {
      _videos = _videos
          .where((v) => v.videoId != video.videoId)
          .toList();
    });

    final ok = await ref.read(playlistServiceProvider).toggleVideo(
          playlistId: widget.playlistId,
          videoId: video.videoId,
          member: false,
        );

    if (!ok && mounted) {
      _load();

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text("Couldn't remove that video."),
          backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        ),
      );
    }
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
          title: Text(
            _name ?? 'Playlist',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
        ),
        body: _loading
            ? const Center(
                child: CircularProgressIndicator(
                  color: AppColors.brandOrange,
                ),
              )
            : _videos.isEmpty
                ? Center(
                    child: Text(
                      'No videos in this playlist yet',
                      style: TextStyle(
                        color: context.textSecondary,
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _videos.length,
                    separatorBuilder: (context, index) =>
                        const SizedBox(height: 24),
                    itemBuilder: (context, index) {
                      final video = _videos[index];

                      return Stack(
                        children: [
                          VideoCard(video: video),
                          Positioned(
                            top: 0,
                            right: 0,
                            child: Material(
                              color: Colors.black.withValues(alpha: 0.6),
                              shape: const CircleBorder(),
                              child: IconButton(
                                icon: const Icon(
                                  Icons.close,
                                  size: 16,
                                  color: Colors.white,
                                ),
                                onPressed: () => _removeVideo(video),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
      ),
    );
  }
}
