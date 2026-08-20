import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
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

    // /api/playlists only returns metadata + a videoIds set, not full
    // video objects, so fetch the playlist's own row first, then hydrate
    // each id via the same per-video lookup the watch page uses.
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

    // Keep a non-null reference so Dart's null-safety analysis
    // remains valid across the asynchronous operation below.
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
        title: Text(
          _name ?? 'Playlist',
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
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
              ? const Center(
                  child: Text(
                    'No videos in this playlist yet',
                    style: TextStyle(
                      color: AppColors.textSecondaryDark,
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
    );
  }
}