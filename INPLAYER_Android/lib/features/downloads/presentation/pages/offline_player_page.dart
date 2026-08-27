import 'dart:io';

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../models/downloaded_item.dart';

/// Plays a file already saved on this device by DownloadManager — no
/// network involved at all. Deliberately much simpler than the online
/// watch page's PlayerChrome: there's no HLS quality ladder to switch
/// between (this file IS a fixed, single quality already), no captions
/// track, and no "remember playback position" beyond this session, since
/// none of that applies to a plain local MP4/M4A. video_player's own
/// VideoPlayerController.file() plays it directly.
class OfflinePlayerPage extends StatefulWidget {
  final DownloadedItem item;

  const OfflinePlayerPage({super.key, required this.item});

  @override
  State<OfflinePlayerPage> createState() => _OfflinePlayerPageState();
}

class _OfflinePlayerPageState extends State<OfflinePlayerPage> {
  VideoPlayerController? _controller;
  bool _ready = false;
  bool _failed = false;
  bool _controlsVisible = true;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final file = File(widget.item.filePath);
    if (!await file.exists()) {
      if (mounted) setState(() => _failed = true);
      return;
    }

    final controller = VideoPlayerController.file(file);
    _controller = controller;

    try {
      await controller.initialize();
      if (!mounted) return;
      setState(() => _ready = true);
      controller.play();
      controller.addListener(() {
        if (mounted) setState(() {});
      });
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  void _togglePlay() {
    final c = _controller;
    if (c == null) return;
    setState(() => c.value.isPlaying ? c.pause() : c.play());
  }

  String _fmt(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes.remainder(60);
    final s = d.inSeconds.remainder(60);
    final mm = m.toString().padLeft(h > 0 ? 2 : 1, '0');
    final ss = s.toString().padLeft(2, '0');
    return h > 0 ? '$h:$mm:$ss' : '$mm:$ss';
  }

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final provider = item.thumbnailUrl.isNotEmpty ? smartImageProvider(item.thumbnailUrl) : null;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.white),
        title: Text(
          item.title.isEmpty ? 'Offline' : item.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700),
        ),
      ),
      body: _failed
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.error_outline, color: Colors.white54, size: 40),
                    const SizedBox(height: 12),
                    const Text(
                      "Couldn't play this download",
                      style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'The file may have been removed from storage. Try deleting and downloading it again from Downloads.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12.5),
                    ),
                  ],
                ),
              ),
            )
          : !_ready
              ? const Center(child: CircularProgressIndicator(color: AppColors.brandOrange))
              : GestureDetector(
                  onTap: () => setState(() => _controlsVisible = !_controlsVisible),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      if (item.isMusic)
                        Container(
                          color: const Color(0xFF0A1424),
                          child: Center(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(16),
                              child: SizedBox(
                                width: 220,
                                height: 220,
                                child: provider != null
                                    ? Image(image: provider, fit: BoxFit.cover)
                                    : const Icon(Icons.music_note, color: Colors.white38, size: 64),
                              ),
                            ),
                          ),
                        )
                      else
                        Center(
                          child: AspectRatio(
                            aspectRatio: _controller!.value.aspectRatio,
                            child: VideoPlayer(_controller!),
                          ),
                        ),
                      GestureDetector(onTap: _togglePlay, child: Container(color: Colors.transparent)),
                      if (_controlsVisible)
                        Positioned(
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: Container(
                            padding: const EdgeInsets.fromLTRB(16, 24, 16, 20),
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [Colors.transparent, Colors.black.withValues(alpha: 0.85)],
                              ),
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                VideoProgressIndicator(
                                  _controller!,
                                  allowScrubbing: true,
                                  padding: EdgeInsets.zero,
                                  colors: const VideoProgressColors(
                                    playedColor: AppColors.brandOrange,
                                    bufferedColor: Colors.white24,
                                    backgroundColor: Colors.white12,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    IconButton(
                                      icon: Icon(
                                        _controller!.value.isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
                                        color: Colors.white,
                                        size: 40,
                                      ),
                                      onPressed: _togglePlay,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      '${_fmt(_controller!.value.position)} / ${_fmt(_controller!.value.duration)}',
                                      style: const TextStyle(color: Colors.white70, fontSize: 12.5),
                                    ),
                                    const Spacer(),
                                    Text(
                                      item.qualityLabel,
                                      style: const TextStyle(color: Colors.white54, fontSize: 11.5, fontWeight: FontWeight.w600),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }
}
