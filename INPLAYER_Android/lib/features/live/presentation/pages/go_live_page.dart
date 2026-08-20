import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:logger/logger.dart';
import 'package:video_player/video_player.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/live_service.dart';
import '../../../../models/live_stream.dart';

const _visibilityOptions = [
  (value: 'public', label: 'Public — anyone can watch'),
  (value: 'unlisted', label: 'Unlisted — only people with the link'),
  (value: 'private', label: 'Private — only you'),
];

enum _Stage { setup, starting, live, ended }

/// "Go Live" — the real broadcaster flow against POST /api/live/ivs-create
/// and POST /api/live/end. The website captures your camera directly in
/// the browser via the AWS IVS Web Broadcast SDK (WebRTC); there's no
/// equivalent native camera-broadcast SDK wired into this Flutter app yet,
/// so instead of faking an in-app "Start Camera" button that doesn't
/// actually push video, this screen creates the real IVS channel and hands
/// you the real RTMPS ingest URL + stream key to paste into any RTMP
/// broadcaster app (OBS Studio, Streamlabs, Larix, etc.) — a genuine,
/// working way to go live from a phone today, just via an external app for
/// the camera capture step rather than in-app.
class GoLivePage extends ConsumerStatefulWidget {
  const GoLivePage({super.key});

  @override
  ConsumerState<GoLivePage> createState() => _GoLivePageState();
}

class _GoLivePageState extends ConsumerState<GoLivePage> {
  final _logger = Logger();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();

  _Stage _stage = _Stage.setup;
  String _visibility = 'public';
  bool _commentsEnabled = true;
  bool _showStreamKey = false;
  String? _error;

  LiveCreateResult? _creds;
  VideoPlayerController? _previewController;
  bool _previewLoading = false;
  bool _previewFailed = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _previewController?.dispose();
    super.dispose();
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
    );
  }

  Future<void> _goLive() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      setState(() => _error = 'Please give your live stream a title.');
      return;
    }

    setState(() {
      _stage = _Stage.starting;
      _error = null;
    });

    final result = await ref.read(liveServiceProvider).goLive(
          title: title,
          description: _descriptionController.text.trim(),
          visibility: _visibility,
          commentsEnabled: _commentsEnabled,
        );

    if (!mounted) return;

    if (!result.success) {
      setState(() {
        _stage = _Stage.setup;
        _error = result.error ?? "Couldn't start a live stream.";
      });
      return;
    }

    setState(() {
      _creds = result;
      _stage = _Stage.live;
    });
  }

  Future<void> _togglePreview() async {
    if (_previewController != null) {
      _previewController!.dispose();
      setState(() {
        _previewController = null;
        _previewFailed = false;
      });
      return;
    }

    final url = _creds?.playbackUrl;
    if (url == null) return;

    setState(() {
      _previewLoading = true;
      _previewFailed = false;
    });

    try {
      final controller = VideoPlayerController.networkUrl(Uri.parse(url));
      await controller.initialize();
      if (!mounted) {
        controller.dispose();
        return;
      }
      controller.play();
      setState(() {
        _previewController = controller;
        _previewLoading = false;
      });
    } catch (e) {
      _logger.w('Live preview not ready yet: $e');
      if (!mounted) return;
      setState(() {
        _previewLoading = false;
        _previewFailed = true;
      });
    }
  }

  Future<void> _copy(String label, String? value) async {
    if (value == null) return;
    await Clipboard.setData(ClipboardData(text: value));
    _showSnack('$label copied.');
  }

  Future<void> _endStream() async {
    final videoId = _creds?.videoId;
    if (videoId == null) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.cardDark,
        title: const Text('End live stream?', style: TextStyle(color: AppColors.textPrimaryDark)),
        content: const Text(
          "This stops your stream from showing as live. Also stop broadcasting from your streaming app.",
          style: TextStyle(color: AppColors.textSecondaryDark),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: TextButton.styleFrom(foregroundColor: AppColors.error),
            child: const Text('End Stream'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    _previewController?.dispose();
    setState(() => _previewController = null);

    final ok = await ref.read(liveServiceProvider).endLive(videoId);
    if (!mounted) return;

    if (ok) {
      setState(() => _stage = _Stage.ended);
    } else {
      _showSnack("Couldn't end the stream. Try again.");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        elevation: 0,
        title: const Text('Go Live', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: SafeArea(child: _buildStage()),
    );
  }

  Widget _buildStage() {
    switch (_stage) {
      case _Stage.setup:
        return _buildSetup();
      case _Stage.starting:
        return const Center(child: CircularProgressIndicator(color: AppColors.brandOrange));
      case _Stage.live:
        return _buildLive();
      case _Stage.ended:
        return _buildEnded();
    }
  }

  Widget _buildSetup() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: AppColors.brandOrange.withValues(alpha: 0.08),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.25)),
          ),
          child: Row(
            children: [
              const Icon(Icons.info_outline, color: AppColors.brandOrange, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  "You'll broadcast from a streaming app (like OBS or Streamlabs) using a server URL and key we generate for you — not directly from this screen.",
                  style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 12.5, height: 1.4),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        _label('Title'),
        TextField(
          controller: _titleController,
          maxLength: 100,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: _inputDecoration('Give your stream a title'),
        ),
        _label('Description'),
        TextField(
          controller: _descriptionController,
          maxLength: 500,
          maxLines: 3,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: _inputDecoration('Tell viewers what this stream is about'),
        ),
        _label('Visibility'),
        DropdownButtonFormField<String>(
          value: _visibility,
          dropdownColor: AppColors.cardDark,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: _inputDecoration(null),
          items: _visibilityOptions
              .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: (v) => setState(() => _visibility = v ?? _visibility),
        ),
        const SizedBox(height: 8),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeColor: AppColors.brandOrange,
          title: const Text('Comments enabled', style: TextStyle(color: AppColors.textPrimaryDark)),
          value: _commentsEnabled,
          onChanged: (v) => setState(() => _commentsEnabled = v),
        ),
        if (_error != null) ...[
          const SizedBox(height: 8),
          Text(_error!, style: const TextStyle(color: AppColors.error, fontSize: 13)),
        ],
        const SizedBox(height: 20),
        ElevatedButton.icon(
          onPressed: _goLive,
          icon: const Icon(Icons.podcasts),
          label: const Text('Create Live Stream'),
          style: ElevatedButton.styleFrom(
            minimumSize: const Size(double.infinity, 52),
            backgroundColor: AppColors.brandOrange,
            foregroundColor: Colors.white,
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildLive() {
    final creds = _creds!;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(color: Colors.red, borderRadius: BorderRadius.circular(10)),
          child: const Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.circle, color: Colors.white, size: 8),
              SizedBox(width: 8),
              Text('LIVE SESSION CREATED', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(_titleController.text.trim(), style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 20),
        _sectionTitle('1. Open your streaming app'),
        const Text(
          'Use OBS Studio, Streamlabs, Larix Broadcaster, or any app that streams to a custom RTMP server. Enter these two values there:',
          style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 12),
        _credRow('Server URL', creds.rtmpsServerUrl ?? '—', onCopy: () => _copy('Server URL', creds.rtmpsServerUrl)),
        const SizedBox(height: 8),
        _credRow(
          'Stream Key',
          _showStreamKey ? (creds.streamKey ?? '—') : List.filled(24, '•').join(),
          onCopy: () => _copy('Stream key', creds.streamKey),
          trailing: IconButton(
            icon: Icon(_showStreamKey ? Icons.visibility_off : Icons.visibility, color: Colors.white.withValues(alpha: 0.6), size: 18),
            onPressed: () => setState(() => _showStreamKey = !_showStreamKey),
          ),
        ),
        const SizedBox(height: 8),
        Text(
          "Don't share your stream key — anyone with it can broadcast to your channel.",
          style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 11),
        ),
        const SizedBox(height: 24),
        _sectionTitle('2. Press "Start Streaming" there'),
        const Text(
          'Your stream goes live on InPlayer as soon as your app connects and starts sending video.',
          style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 13, height: 1.4),
        ),
        const SizedBox(height: 20),
        _sectionTitle('Preview'),
        const SizedBox(height: 8),
        AspectRatio(
          aspectRatio: 16 / 9,
          child: Container(
            decoration: BoxDecoration(color: Colors.black, borderRadius: BorderRadius.circular(16)),
            clipBehavior: Clip.antiAlias,
            child: _previewController != null && _previewController!.value.isInitialized
                ? VideoPlayer(_previewController!)
                : Center(
                    child: _previewLoading
                        ? const CircularProgressIndicator(color: AppColors.brandOrange)
                        : Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.videocam_off_outlined, color: Colors.white.withValues(alpha: 0.3), size: 32),
                              const SizedBox(height: 8),
                              Text(
                                _previewFailed ? 'Not receiving video yet — start broadcasting first.' : 'Preview not started',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12),
                              ),
                            ],
                          ),
                  ),
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: _togglePreview,
          icon: Icon(_previewController != null ? Icons.stop : Icons.play_arrow),
          label: Text(_previewController != null ? 'Stop Preview' : 'Load Preview'),
        ),
        const SizedBox(height: 28),
        ElevatedButton.icon(
          onPressed: _endStream,
          icon: const Icon(Icons.stop_circle_outlined),
          label: const Text('End Stream'),
          style: ElevatedButton.styleFrom(
            minimumSize: const Size(double.infinity, 52),
            backgroundColor: AppColors.error,
            foregroundColor: Colors.white,
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildEnded() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.check_circle, color: AppColors.brandOrange, size: 56),
            const SizedBox(height: 16),
            const Text(
              'Stream ended',
              style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => context.pop(),
              child: const Text('Done'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _sectionTitle(String text) => Text(
        text,
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
      );

  Widget _credRow(String label, String value, {required VoidCallback onCopy, Widget? trailing}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(12)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
                const SizedBox(height: 2),
                Text(
                  value,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'monospace'),
                ),
              ],
            ),
          ),
          if (trailing != null) trailing,
          IconButton(
            icon: const Icon(Icons.copy, color: AppColors.brandOrange, size: 18),
            onPressed: onCopy,
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 6),
        child: Text(
          text,
          style: const TextStyle(color: AppColors.textSecondaryDark, fontWeight: FontWeight.w600, fontSize: 13),
        ),
      );

  InputDecoration _inputDecoration(String? hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: AppColors.textSecondaryDark.withValues(alpha: 0.6)),
      filled: true,
      fillColor: AppColors.cardDark,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }
}
