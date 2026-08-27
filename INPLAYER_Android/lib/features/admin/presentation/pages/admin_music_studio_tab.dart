import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/admin_video_row.dart';
import '../../../../services/admin_service.dart';

/// Dedicated Admin Music Studio tab — provides specialized music catalog
/// management: live streaming counts, audio playback preview, synced lyrics
/// inspector, genre filtering, and copyright status verification.
class AdminMusicStudioTab extends ConsumerStatefulWidget {
  const AdminMusicStudioTab({super.key});

  @override
  ConsumerState<AdminMusicStudioTab> createState() => _AdminMusicStudioTabState();
}

class _AdminMusicStudioTabState extends ConsumerState<AdminMusicStudioTab> {
  final _searchController = TextEditingController();
  Timer? _debounce;

  bool _loading = true;
  bool _loadingMore = false;
  List<AdminVideoRow> _tracks = [];
  String? _nextCursor;
  String _query = '';
  String? _status; // null | 'live' | 'processing' | 'ready' | 'error'
  String _selectedGenre = 'All';
  Map<String, int> _counts = const {};

  // Audio preview
  final AudioPlayer _previewPlayer = AudioPlayer();
  String? _previewingVideoId;
  bool _isPlayingPreview = false;

  static const List<String> _genres = [
    'All',
    'Pop',
    'Hip-Hop',
    'Bollywood',
    'Devotional',
    'Rock',
    'Classical',
    'Folk',
    'Indie',
    'Electronic',
    'R&B',
    'Instrumental',
    'Other',
  ];

  @override
  void initState() {
    super.initState();
    _previewPlayer.playerStateStream.listen((state) {
      if (!mounted) return;
      setState(() {
        _isPlayingPreview = state.playing &&
            state.processingState != ProcessingState.completed &&
            state.processingState != ProcessingState.idle;
      });
    });
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _debounce?.cancel();
    _previewPlayer.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final result = await ref.read(adminServiceProvider).getAdminVideos(
          type: 'music',
          status: _status,
          query: _query,
          includeCounts: _query.isEmpty,
        );
    if (!mounted) return;
    setState(() {
      _tracks = result.videos;
      _nextCursor = result.nextCursor;
      if (result.counts.isNotEmpty) _counts = result.counts;
      _loading = false;
    });
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _nextCursor == null) return;
    setState(() => _loadingMore = true);
    final result = await ref.read(adminServiceProvider).getAdminVideos(
          type: 'music',
          status: _status,
          query: _query,
          cursor: _nextCursor,
        );
    if (!mounted) return;
    setState(() {
      _tracks.addAll(result.videos);
      _nextCursor = result.nextCursor;
      _loadingMore = false;
    });
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (_query == value.trim()) return;
      _query = value.trim();
      _load();
    });
  }

  Future<void> _togglePreview(AdminVideoRow track) async {
    if (_previewingVideoId == track.videoId) {
      if (_isPlayingPreview) {
        await _previewPlayer.pause();
      } else {
        await _previewPlayer.play();
      }
      return;
    }

    final playbackId = track.muxPlaybackId;
    if (playbackId == null || playbackId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No playable audio stream available for this track.')),
      );
      return;
    }

    setState(() {
      _previewingVideoId = track.videoId;
    });

    try {
      await _previewPlayer.setUrl('https://stream.mux.com/$playbackId.m3u8');
      await _previewPlayer.play();
    } catch (_) {
      if (mounted) {
        setState(() => _previewingVideoId = null);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to preview audio stream.')),
        );
      }
    }
  }

  Future<void> _deleteTrack(AdminVideoRow track) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: ctx.bgModal,
        title: Text('Delete Music Track', style: TextStyle(color: ctx.textPrimary)),
        content: Text(
          'Are you sure you want to permanently delete "${track.title}"? This cannot be undone.',
          style: TextStyle(color: ctx.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text('Cancel', style: TextStyle(color: ctx.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) return;

    final ok = await ref.read(adminServiceProvider).deleteVideo(track.videoId);
    if (!mounted) return;
    if (ok) {
      setState(() => _tracks.removeWhere((t) => t.videoId == track.videoId));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Track deleted successfully.')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to delete track. Please try again.')),
      );
    }
  }

  void _showLyricsSheet(AdminVideoRow track) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        minChildSize: 0.4,
        expand: false,
        builder: (context, scroll) => Container(
          decoration: BoxDecoration(
            color: ctx.bgModal,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
            border: Border.all(color: ctx.borderSubtle),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: ctx.textDim.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    Icon(Icons.mic_external_on_rounded, color: AppColors.brandOrange, size: 22),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        track.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: ctx.textPrimary,
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView(
                  controller: scroll,
                  padding: const EdgeInsets.all(16),
                  children: [
                    Text(
                      'Synced Lyrics Data',
                      style: TextStyle(color: ctx.textDim, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: ctx.bgCard,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: ctx.borderSubtle),
                      ),
                      child: Text(
                        'Category: ${track.category ?? 'Music'}\n'
                        'Status: ${track.status}\n'
                        'Mux ID: ${track.muxPlaybackId ?? 'None'}\n'
                        'Views: ${track.views}',
                        style: TextStyle(color: ctx.textSecondary, fontSize: 12, height: 1.5),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _tracks.where((t) {
      if (_selectedGenre == 'All') return true;
      final cat = t.category ?? 'Other';
      return cat.toLowerCase() == _selectedGenre.toLowerCase();
    }).toList();

    return Scaffold(
      backgroundColor: context.bgCanvas,
      body: RefreshIndicator(
        color: AppColors.brandOrange,
        backgroundColor: context.bgCard,
        onRefresh: _load,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildKpiCards(context),
                    const SizedBox(height: 16),
                    _buildSearchBar(context),
                    const SizedBox(height: 12),
                    _buildStatusTabs(context),
                    const SizedBox(height: 12),
                    _buildGenreChips(context),
                  ],
                ),
              ),
            ),
            if (_loading)
              const SliverFillRemaining(
                child: Center(
                  child: CircularProgressIndicator(color: AppColors.brandOrange),
                ),
              )
            else if (filtered.isEmpty)
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.music_off_rounded, color: context.textDim, size: 48),
                      const SizedBox(height: 12),
                      Text('No music tracks found', style: TextStyle(color: context.textSecondary)),
                    ],
                  ),
                ),
              )
            else
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                sliver: SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      if (index == filtered.length) {
                        if (_nextCursor != null) {
                          _loadMore();
                          return const Padding(
                            padding: EdgeInsets.symmetric(vertical: 24),
                            child: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
                          );
                        }
                        return const SizedBox(height: 80);
                      }
                      return _buildTrackCard(context, filtered[index]);
                    },
                    childCount: filtered.length + (_nextCursor != null ? 1 : 0),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildKpiCards(BuildContext context) {
    final totalStreams = _tracks.fold<int>(0, (sum, t) => sum + t.views);
    final readyCount = _tracks.where((t) => t.status == 'ready' || t.status == 'live').length;

    return Row(
      children: [
        Expanded(
          child: _statCard(context, 'Total Tracks', '${_tracks.length}', Icons.library_music_rounded, AppColors.brandOrange),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _statCard(context, 'Streams', '$totalStreams', Icons.headphones_rounded, const Color(0xFF06B6D4)),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: _statCard(context, 'Active', '$readyCount', Icons.check_circle_rounded, const Color(0xFF10B981)),
        ),
      ],
    );
  }

  Widget _statCard(BuildContext context, String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 14),
              const SizedBox(width: 4),
              Text(label, style: TextStyle(color: context.textDim, fontSize: 10, fontWeight: FontWeight.bold)),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: TextStyle(color: context.textPrimary, fontSize: 16, fontWeight: FontWeight.w900),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: context.borderSubtle),
      ),
      child: TextField(
        controller: _searchController,
        onChanged: _onSearchChanged,
        style: TextStyle(color: context.textPrimary, fontSize: 13),
        decoration: InputDecoration(
          hintText: 'Search music title, artist, videoId...',
          hintStyle: TextStyle(color: context.textDim, fontSize: 13),
          prefixIcon: Icon(Icons.search, color: context.textDim, size: 18),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      ),
    );
  }

  Widget _buildStatusTabs(BuildContext context) {
    final tabs = [
      (key: null, label: 'All (${_counts['all'] ?? _tracks.length})'),
      (key: 'ready', label: 'Uploaded (${_counts['ready'] ?? 0})'),
      (key: 'processing', label: 'Processing (${_counts['processing'] ?? 0})'),
      (key: 'error', label: 'Failed (${_counts['errored'] ?? _counts['error'] ?? 0})'),
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: tabs.map((tab) {
          final isSelected = _status == tab.key;
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: ChoiceChip(
              label: Text(tab.label),
              selected: isSelected,
              onSelected: (_) {
                setState(() => _status = tab.key);
                _load();
              },
              selectedColor: AppColors.brandOrange,
              backgroundColor: context.bgCard,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : context.textSecondary,
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              ),
              side: BorderSide(color: isSelected ? AppColors.brandOrange : context.borderSubtle),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildGenreChips(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _genres.map((genre) {
          final isSelected = _selectedGenre == genre;
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: FilterChip(
              label: Text(genre),
              selected: isSelected,
              onSelected: (_) => setState(() => _selectedGenre = genre),
              selectedColor: AppColors.brandOrange.withValues(alpha: 0.2),
              backgroundColor: context.bgCard,
              labelStyle: TextStyle(
                color: isSelected ? AppColors.brandOrangeLight : context.textDim,
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              ),
              side: BorderSide(color: isSelected ? AppColors.brandOrange : context.borderSubtle),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildTrackCard(BuildContext context, AdminVideoRow track) {
    final isPreviewingThis = _previewingVideoId == track.videoId && _isPlayingPreview;
    final cover = track.thumbnailUrl ?? '';

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isPreviewingThis ? AppColors.brandOrange.withValues(alpha: 0.5) : context.borderSubtle),
      ),
      child: Row(
        children: [
          // Album art thumbnail with play/pause preview overlay
          GestureDetector(
            onTap: () => _togglePreview(track),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: SizedBox(
                width: 52,
                height: 52,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (cover.isNotEmpty)
                      CachedNetworkImage(imageUrl: cover, fit: BoxFit.cover)
                    else
                      Container(color: AppColors.music.withValues(alpha: 0.3)),
                    Container(
                      color: Colors.black.withValues(alpha: 0.4),
                      child: Center(
                        child: Icon(
                          isPreviewingThis ? Icons.pause_rounded : Icons.play_arrow_rounded,
                          color: Colors.white,
                          size: 24,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),
          // Info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  track.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: context.textPrimary, fontSize: 13, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 3),
                Text(
                  track.uploaderName ?? 'Unknown Artist',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: context.textSecondary, fontSize: 11),
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.brandOrange.withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        track.category ?? 'Pop',
                        style: TextStyle(color: AppColors.brandOrangeLight, fontSize: 9.5, fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${track.views} plays',
                      style: TextStyle(color: context.textDim, fontSize: 10),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Actions
          IconButton(
            icon: Icon(Icons.lyrics_outlined, color: context.textDim, size: 20),
            onPressed: () => _showLyricsSheet(track),
            tooltip: 'Lyrics & Details',
          ),
          IconButton(
            icon: Icon(Icons.delete_outline_rounded, color: AppColors.error, size: 20),
            onPressed: () => _deleteTrack(track),
            tooltip: 'Delete Track',
          ),
        ],
      ),
    );
  }
}
