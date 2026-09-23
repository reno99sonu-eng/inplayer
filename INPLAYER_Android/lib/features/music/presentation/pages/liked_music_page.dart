import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/video.dart';
import '../../../../services/music_player_service.dart';
import '../../../../services/video_service.dart';
import '../widgets/music_track_tile.dart';

/// Liked Songs — with Spotify's signature Liked Songs header banner
/// (purple gradient heart icon), track count, and green play action.
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
    final isDark = context.isDark;
    const spotifyGreen = Color(0xFF1DB954);

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF121212) : AppColors.surfaceLight,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: context.textPrimary),
          onPressed: () => Navigator.of(context).maybePop(),
        ),
        title: Text(
          'Liked Songs',
          style: TextStyle(
            color: context.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 20,
            letterSpacing: -0.4,
          ),
        ),
      ),
      body: _tracks == null
          ? const Center(child: CircularProgressIndicator(color: spotifyGreen))
          : _tracks!.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Container(
                          width: 80,
                          height: 80,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF450af5), Color(0xFFc4efd9)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: const Icon(Icons.favorite_rounded, size: 40, color: Colors.white),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          'No liked songs yet',
                          style: TextStyle(
                            color: context.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Tap the heart icon on any song to save it to your library.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: context.textSecondary, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  color: spotifyGreen,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    children: [
                      // Spotify Liked Songs Header Card
                      Container(
                        padding: const EdgeInsets.all(16),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFF4A148C), Color(0xFF121212)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 58,
                              height: 58,
                              decoration: BoxDecoration(
                                gradient: const LinearGradient(
                                  colors: [Color(0xFF6200EA), Color(0xFF00B0FF)],
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                ),
                                borderRadius: BorderRadius.circular(14),
                                boxShadow: const [
                                  BoxShadow(color: Colors.black45, blurRadius: 10),
                                ],
                              ),
                              child: const Icon(Icons.favorite_rounded, color: Colors.white, size: 28),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Liked Songs',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 17,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  Text(
                                    '${_tracks!.length} songs',
                                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                                  ),
                                ],
                              ),
                            ),
                            FloatingActionButton.small(
                              heroTag: 'play_liked_songs',
                              backgroundColor: spotifyGreen,
                              foregroundColor: Colors.black,
                              elevation: 4,
                              onPressed: () {
                                if (_tracks!.isNotEmpty) {
                                  ref
                                      .read(musicPlayerServiceProvider)
                                      .playQueue(_tracks!, startIndex: 0);
                                }
                              },
                              child: const Icon(Icons.play_arrow_rounded, size: 24),
                            ),
                          ],
                        ),
                      ),
                      ...List.generate(
                        _tracks!.length,
                        (i) => MusicTrackTile(
                          track: _tracks![i],
                          queue: _tracks!,
                          index: i,
                        ),
                      ),
                    ],
                  ),
                ),
    );
  }
}
