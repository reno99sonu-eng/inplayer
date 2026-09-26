import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/video.dart';
import '../../../../services/music_player_service.dart';
import '../../../../services/video_service.dart';
import '../widgets/music_track_tile.dart';

/// All tracks in one genre with Spotify-style header and layout.
class GenrePage extends ConsumerStatefulWidget {
  final String genre;
  const GenrePage({super.key, required this.genre});

  @override
  ConsumerState<GenrePage> createState() => _GenrePageState();
}

class _GenrePageState extends ConsumerState<GenrePage> {
  List<Video>? _tracks;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final all = await ref.read(videoServiceProvider).getMusicTracks();
    if (!mounted) return;
    setState(() {
      _tracks = all.where((v) {
        if (!v.isStrictMusic) return false;
        final g = (v.genre?.isNotEmpty == true) ? v.genre! : 'Other';
        return g.toLowerCase() == widget.genre.toLowerCase();
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    const spotifyGreen = Color(0xFFFF7A18);

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
          widget.genre,
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
                  child: Text(
                    'No tracks in ${widget.genre} yet',
                    style: TextStyle(color: context.textSecondary, fontSize: 14),
                  ),
                )
              : RefreshIndicator(
                  color: spotifyGreen,
                  onRefresh: _load,
                  child: ListView(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    children: [
                      // Spotify Header Bar with Play All Button
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16, top: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '${_tracks!.length} songs',
                              style: TextStyle(
                                color: context.textSecondary,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            FloatingActionButton.small(
                              heroTag: 'play_genre_${widget.genre}',
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
