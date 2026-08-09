import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/video_service.dart';
import '../../../../models/video.dart';

class WatchPage extends ConsumerStatefulWidget {
  final String videoId;

  const WatchPage({super.key, required this.videoId});

  @override
  ConsumerState<WatchPage> createState() => _WatchPageState();
}

class _WatchPageState extends ConsumerState<WatchPage> {
  VideoPlayerController? _videoController;
  bool _isInitialized = false;
  bool _isLoading = true;
  Video? _video;
  bool _descExpanded = false;
  List<Video> _recommendedVideos = [];

  @override
  void initState() {
    super.initState();
    _loadVideo();
  }

  Future<void> _loadVideo() async {
    try {
      final videoService = ref.read(videoServiceProvider);
      final video = await videoService.getVideoById(widget.videoId);
      final recommended = await videoService.getVideos();

      if (video != null && video.muxPlaybackId != null) {
        // Using Mux streaming URL
        final videoUrl = 'https://stream.mux.com/${video.muxPlaybackId}.m3u8';

        _videoController = VideoPlayerController.networkUrl(
          Uri.parse(videoUrl),
        );

        await _videoController!.initialize();

        setState(() {
          _video = video;
          _recommendedVideos = recommended.where((v) => v.videoId != widget.videoId).toList();
          _isInitialized = true;
          _isLoading = false;
        });

        _videoController!.play();
      } else {
        setState(() {
          _isLoading = false;
        });
      }
    } catch (e) {
      print('Error loading video: $e');
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  void dispose() {
    _videoController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: Column(
        children: [
          // Video Player
          AspectRatio(
            aspectRatio: 16 / 9,
            child: _isLoading
                ? Container(
                    color: Colors.black,
                    child: const Center(
                      child: CircularProgressIndicator(
                        color: AppColors.brandOrange,
                      ),
                    ),
                  )
                : _isInitialized && _videoController != null
                ? Stack(
                    alignment: Alignment.center,
                    children: [
                      VideoPlayer(_videoController!),
                      _buildVideoControls(),
                    ],
                  )
                : Container(
                    color: Colors.black,
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.error_outline,
                            size: 64,
                            color: Colors.white,
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'Video not available',
                            style: const TextStyle(color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  ),
          ),
          // Video Info
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: _video != null
                  ? _buildVideoInfo(_video!)
                  : _buildPlaceholderInfo(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildVideoControls() {
    return GestureDetector(
      onTap: () {
        setState(() {
          if (_videoController!.value.isPlaying) {
            _videoController!.pause();
          } else {
            _videoController!.play();
          }
        });
      },
      child: Container(
        color: Colors.transparent,
        child: Center(
          child: Icon(
            _videoController!.value.isPlaying ? Icons.pause : Icons.play_arrow,
            size: 64,
            color: Colors.white.withValues(alpha: 0.8),
          ),
        ),
      ),
    );
  }

  Widget _buildVideoInfo(Video video) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          video.title,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          '${video.views} • ${video.uploaded}',
          style: const TextStyle(
            color: AppColors.textSecondaryDark,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 16),
        _buildActionBar(),
        const SizedBox(height: 16),
        Row(
          children: [
            CircleAvatar(
              radius: 20,
              backgroundImage: video.avatar.isNotEmpty
                  ? NetworkImage(video.avatar)
                  : null,
              child: video.avatar.isEmpty
                  ? const Icon(Icons.person, size: 20)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    video.creator,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimaryDark,
                    ),
                  ),
                  if (video.uploaderUsername != null)
                    Text(
                      '@${video.uploaderUsername}',
                      style: const TextStyle(
                        color: AppColors.textSecondaryDark,
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: () {
                // TODO: Handle subscribe
              },
              style: ElevatedButton.styleFrom(minimumSize: const Size(80, 36)),
              child: const Text('Subscribe'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (video.description != null && video.description!.isNotEmpty)
          _buildDescriptionBox(video),
        const SizedBox(height: 16),
        _buildCommentsSection(),
        const SizedBox(height: 24),
        _buildRecommendedVideos(),
      ],
    );
  }

  Widget _buildActionBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _buildActionItem(Icons.thumb_up_alt_outlined, 'Like'),
          _buildActionItem(Icons.reply_outlined, 'Share'),
          _buildActionItem(Icons.download_outlined, 'Download'),
          _buildActionItem(Icons.bookmark_outline, 'Save'),
        ],
      ),
    );
  }

  Widget _buildActionItem(IconData icon, String label) {
    return Column(
      children: [
        Icon(icon, color: Colors.white, size: 24),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(color: Colors.white, fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildDescriptionBox(Video video) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _descExpanded = !_descExpanded;
        });
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withOpacity(0.08)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              video.description!,
              maxLines: _descExpanded ? null : 2,
              overflow: _descExpanded ? null : TextOverflow.ellipsis,
              style: const TextStyle(
                color: AppColors.textSecondaryDark,
                fontSize: 14,
                height: 1.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _descExpanded ? 'Show less' : 'Show more',
              style: const TextStyle(
                color: AppColors.brandOrange,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCommentsSection() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.cardDark,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.08)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Text(
                'Comments',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                '1.2K',
                style: TextStyle(
                  color: AppColors.textSecondaryDark,
                  fontSize: 14,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const CircleAvatar(
                radius: 12,
                backgroundColor: AppColors.surfaceDark,
                child: Icon(Icons.person, size: 16, color: AppColors.textSecondaryDark),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.05),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    'Add a comment...',
                    style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 13),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRecommendedVideos() {
    if (_recommendedVideos.isEmpty) return const SizedBox.shrink();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(
              width: 4,
              height: 20,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.brandOrange, AppColors.brandGold],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'Up Next',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
                fontSize: 18,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: _recommendedVideos.length > 5 ? 5 : _recommendedVideos.length,
          separatorBuilder: (context, index) => const SizedBox(height: 16),
          itemBuilder: (context, index) {
            final rec = _recommendedVideos[index];
            return GestureDetector(
              onTap: () {
                // Navigate to new video
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute(
                    builder: (context) => WatchPage(videoId: rec.videoId),
                  ),
                );
              },
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 140,
                    height: 80,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(12),
                      image: DecorationImage(
                        image: NetworkImage(rec.thumbnail),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          rec.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          rec.creator,
                          style: const TextStyle(
                            color: AppColors.textSecondaryDark,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${rec.views} • ${rec.uploaded}',
                          style: const TextStyle(
                            color: AppColors.textSecondaryDark,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildPlaceholderInfo() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Video Title',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            const CircleAvatar(radius: 20),
            const SizedBox(width: 12),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Channel Name',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.textPrimaryDark,
                    ),
                  ),
                  Text(
                    '1M subscribers',
                    style: TextStyle(
                      color: AppColors.textSecondaryDark,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(minimumSize: const Size(80, 36)),
              child: const Text('Subscribe'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        const Text(
          'Video description goes here...',
          style: TextStyle(color: AppColors.textSecondaryDark),
        ),
      ],
    );
  }
}
