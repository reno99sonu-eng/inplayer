import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/video.dart';
import '../../../../services/video_service.dart';
import '../widgets/music_track_tile.dart';

/// All tracks in one genre — reached by tapping a tile in the Music hub's
/// Genres grid. Tracks with no real `genre` (uploaded before this field
/// existed) are bucketed into "Other", matching the website's own
/// sanitizeGenre() fallback, so nothing silently disappears from every
/// genre view.
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
    final all = await ref.read(videoServiceProvider).getVideos();
    if (!mounted) return;
    setState(() {
      _tracks = all.where((v) {
        if (!v.isMusic) return false;
        final g = (v.genre?.isNotEmpty == true) ? v.genre! : 'Other';
        return g == widget.genre;
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        title: Text(widget.genre, style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.w800, fontSize: 19)),
      ),
      body: _tracks == null
          ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
          : _tracks!.isEmpty
              ? Center(
                  child: Text('No tracks in ${widget.genre} yet', style: TextStyle(color: context.textSecondary)),
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
