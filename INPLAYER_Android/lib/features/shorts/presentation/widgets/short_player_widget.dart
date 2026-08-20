import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:video_player/video_player.dart';
import '../../../../models/short.dart';
import '../../../../models/video.dart';
import '../../../../services/video_service.dart';
import '../../../../services/premium_service.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:just_audio/just_audio.dart';

class ShortPlayerWidget extends ConsumerStatefulWidget {
  final Short short;

  const ShortPlayerWidget({super.key, required this.short});

  @override
  ConsumerState<ShortPlayerWidget> createState() => _ShortPlayerWidgetState();
}

class _ShortPlayerWidgetState extends ConsumerState<ShortPlayerWidget> {
  VideoPlayerController? _videoController;
  AudioPlayer? _audioPlayer;
  bool _isInitialized = false;
  bool _isPlaying = true;

  @override
  void initState() {
    super.initState();
    _initPlayer();
  }

  Future<void> _initPlayer() async {
    try {
      String? videoUrl;
      final premiumService = ref.read(premiumServiceProvider);
      final maxRes = await premiumService.getMaxResolution();

      if (widget.short.muxPlaybackId != null && widget.short.muxPlaybackId!.isNotEmpty) {
        videoUrl = 'https://stream.mux.com/${widget.short.muxPlaybackId}.m3u8?max_resolution=$maxRes';
      } else {
        // Fallback to fetching full video if short doesn't have muxPlaybackId
        final videoService = ref.read(videoServiceProvider);
        if (widget.short.videoId.isNotEmpty) {
          final video = await videoService.getVideoById(widget.short.videoId);
          if (video != null && video.muxPlaybackId != null) {
            videoUrl = 'https://stream.mux.com/${video.muxPlaybackId}.m3u8?max_resolution=$maxRes';
          }
        }
      }

      if (videoUrl != null) {
        _videoController = VideoPlayerController.networkUrl(Uri.parse(videoUrl));
        await _videoController!.initialize();
        _videoController!.setLooping(true);
        
        if (widget.short.soundtrack != null) {
          _audioPlayer = AudioPlayer();
          await _audioPlayer!.setUrl(widget.short.soundtrack!.url);
          await _audioPlayer!.setLoopMode(LoopMode.one);
          _videoController!.setVolume(0); // Mute video if we have a soundtrack
          _audioPlayer!.play();
        }
        
        _videoController!.play();
        if (mounted) {
          setState(() {
            _isInitialized = true;
          });
        }
      }
    } catch (e) {
      print('Error initializing short player: $e');
    }
  }

  @override
  void dispose() {
    _videoController?.dispose();
    _audioPlayer?.dispose();
    super.dispose();
  }

  void _togglePlay() {
    if (_videoController == null) return;
    setState(() {
      if (_videoController!.value.isPlaying) {
        _videoController!.pause();
        _audioPlayer?.pause();
        _isPlaying = false;
      } else {
        _videoController!.play();
        _audioPlayer?.play();
        _isPlaying = true;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // Video or Poster
        GestureDetector(
          onTap: _togglePlay,
          child: _isInitialized && _videoController != null
              ? SizedBox.expand(
                  child: FittedBox(
                    fit: BoxFit.cover,
                    child: SizedBox(
                      width: _videoController!.value.size.width,
                      height: _videoController!.value.size.height,
                      child: VideoPlayer(_videoController!),
                    ),
                  ),
                )
              : CachedNetworkImage(
                  imageUrl: widget.short.poster,
                  fit: BoxFit.cover,
                ),
        ),

        // Play/Pause icon overlay
        if (!_isPlaying)
          Center(
            child: Icon(
              Icons.play_arrow,
              size: 80,
              color: Colors.white.withValues(alpha: 0.5),
            ),
          ),

        // Controls overlay
        Positioned(
          bottom: 20,
          right: 16,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              _buildControlButton(Icons.favorite_border, 'Like'),
              const SizedBox(height: 20),
              _buildControlButton(Icons.comment_outlined, 'Comment'),
              const SizedBox(height: 20),
              _buildControlButton(Icons.share, 'Share'),
              const SizedBox(height: 20),
              _buildControlButton(Icons.more_horiz, 'More'),
            ],
          ),
        ),

        // Info overlay
        Positioned(
          bottom: 20,
          left: 16,
          right: 80,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                widget.short.creator,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                widget.short.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildControlButton(IconData icon, String label) {
    return Column(
      children: [
        Icon(icon, color: Colors.white, size: 32),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(color: Colors.white, fontSize: 12),
        ),
      ],
    );
  }
}
