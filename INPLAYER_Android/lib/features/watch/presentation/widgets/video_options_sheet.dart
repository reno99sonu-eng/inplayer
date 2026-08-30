import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/playlist.dart';
import '../../../../models/video.dart';
import '../../../../services/playlist_service.dart';
import '../../../../services/video_interaction_service.dart';

enum _PanelView { main, playlists, report }

/// The watch page's "⋮" options menu — Save to playlist, Interested / Not
/// Interested recommendation feedback, and Report. Mirrors
/// app/components/watch/VideoOptionsMenu.tsx's `PanelView` state machine
/// (main / playlists / report) and its exact endpoints:
///   POST /api/playlists   { action: 'toggle'|'create', ... }
///   POST /api/video-feedback  { videoId, feedback }  (same-value clears)
///   POST /api/reports     { videoId, reason, details }
/// Watch Later and quick-save/bookmark already have their own real button
/// in the action bar above this sheet (_toggleWatchlist) — not duplicated
/// here, to avoid two near-identical "save" controls.
class VideoOptionsSheet extends ConsumerStatefulWidget {
  final Video video;
  const VideoOptionsSheet({super.key, required this.video});

  @override
  ConsumerState<VideoOptionsSheet> createState() => _VideoOptionsSheetState();
}

class _VideoOptionsSheetState extends ConsumerState<VideoOptionsSheet> {
  _PanelView _view = _PanelView.main;

  List<Playlist> _playlists = [];
  bool _playlistsLoaded = false;
  String? _playlistBusyId;
  final _newPlaylistController = TextEditingController();
  bool _creatingPlaylist = false;

  String? _feedback;
  bool _feedbackBusy = false;

  bool _reported = false;
  String? _reportReason;
  final _reportDetailsController = TextEditingController();
  bool _reportSubmitting = false;
  bool _reportSubmitted = false;

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  @override
  void dispose() {
    _newPlaylistController.dispose();
    _reportDetailsController.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    final playlistService = ref.read(playlistServiceProvider);
    final interactionService = ref.read(videoInteractionServiceProvider);

    final results = await Future.wait([
      playlistService.getPlaylists(),
      interactionService.getFeedbackMap(),
      interactionService.isReported(widget.video.videoId),
    ]);

    if (!mounted) return;
    setState(() {
      _playlists = (results[0] as List<Playlist>).where((p) => !p.reserved).toList();
      _playlistsLoaded = true;
      _feedback = (results[1] as Map<String, String>)[widget.video.videoId];
      _reported = results[2] as bool;
    });
  }

  Future<void> _toggleFeedback(String value) async {
    if (_feedbackBusy) return;
    final previous = _feedback;
    final optimistic = _feedback == value ? null : value;
    setState(() {
      _feedback = optimistic;
      _feedbackBusy = true;
    });

    final result = await ref.read(videoInteractionServiceProvider).submitFeedback(widget.video.videoId, value);
    if (!mounted) return;
    setState(() {
      _feedback = result.ok ? result.feedback : previous;
      _feedbackBusy = false;
    });
    if (!result.ok) _snack('Sign in to leave feedback.');
  }

  Future<void> _togglePlaylistMembership(Playlist playlist, bool member) async {
    setState(() => _playlistBusyId = playlist.playlistId);
    final ok = await ref.read(playlistServiceProvider).toggleVideo(
          playlistId: playlist.playlistId,
          videoId: widget.video.videoId,
          member: member,
          name: playlist.name,
        );
    if (!mounted) return;
    if (ok) {
      setState(() {
        _playlists = _playlists.map((p) {
          if (p.playlistId != playlist.playlistId) return p;
          final ids = List<String>.from(p.videoIds);
          if (member) {
            if (!ids.contains(widget.video.videoId)) ids.add(widget.video.videoId);
          } else {
            ids.remove(widget.video.videoId);
          }
          return Playlist(playlistId: p.playlistId, name: p.name, videoIds: ids, reserved: p.reserved, createdAt: p.createdAt);
        }).toList();
        _playlistBusyId = null;
      });
    } else {
      setState(() => _playlistBusyId = null);
      _snack("Couldn't update playlist — try signing in again.");
    }
  }

  Future<void> _createPlaylist() async {
    final name = _newPlaylistController.text.trim();
    if (name.isEmpty || _creatingPlaylist) return;
    setState(() => _creatingPlaylist = true);

    final playlistId = await ref.read(playlistServiceProvider).createPlaylist(name);
    if (!mounted) return;

    if (playlistId != null) {
      final newPlaylist = Playlist(playlistId: playlistId, name: name, videoIds: [widget.video.videoId]);
      await ref.read(playlistServiceProvider).toggleVideo(
            playlistId: playlistId,
            videoId: widget.video.videoId,
            member: true,
            name: name,
          );
      if (!mounted) return;
      setState(() {
        _playlists = [..._playlists, newPlaylist];
        _newPlaylistController.clear();
        _creatingPlaylist = false;
      });
    } else {
      setState(() => _creatingPlaylist = false);
      _snack("Couldn't create playlist — try signing in again.");
    }
  }

  Future<void> _submitReport() async {
    if (_reportReason == null || _reportSubmitting) return;
    setState(() => _reportSubmitting = true);

    final ok = await ref.read(videoInteractionServiceProvider).submitReport(
          videoId: widget.video.videoId,
          reason: _reportReason!,
          details: _reportDetailsController.text.trim(),
        );

    if (!mounted) return;
    if (ok) {
      setState(() {
        _reported = true;
        _reportSubmitted = true;
        _reportSubmitting = false;
      });
      Future.delayed(const Duration(milliseconds: 1400), () {
        if (mounted) Navigator.of(context).maybePop();
      });
    } else {
      setState(() => _reportSubmitting = false);
      _snack("Couldn't submit report — try signing in again.");
    }
  }

  void _snack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
      decoration: BoxDecoration(
        color: context.bgModal,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: context.borderSubtle),
      ),
      padding: EdgeInsets.fromLTRB(20, 16, 20, MediaQuery.of(context).padding.bottom + 20),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: context.textDim.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 18),
            if (_view == _PanelView.main) _buildMainPanel(),
            if (_view == _PanelView.playlists) _buildPlaylistsPanel(),
            if (_view == _PanelView.report) _buildReportPanel(),
          ],
        ),
      ),
    );
  }

  Widget _buildMainPanel() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Options', style: TextStyle(color: context.textPrimary, fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Text(
          widget.video.title,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(color: context.textSecondary, fontSize: 13),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _pillButton(
                icon: _feedback == 'interested' ? Icons.thumb_up_alt : Icons.thumb_up_alt_outlined,
                label: 'Interested',
                active: _feedback == 'interested',
                onTap: () => _toggleFeedback('interested'),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: _pillButton(
                icon: _feedback == 'not_interested' ? Icons.thumb_down_alt : Icons.thumb_down_alt_outlined,
                label: 'Not interested',
                active: _feedback == 'not_interested',
                onTap: () => _toggleFeedback('not_interested'),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        _menuRow(
          icon: Icons.playlist_add,
          label: 'Save to playlist',
          onTap: () => setState(() => _view = _PanelView.playlists),
        ),
        _menuRow(
          icon: _reported ? Icons.flag : Icons.flag_outlined,
          label: _reported ? 'Reported' : 'Report',
          danger: true,
          onTap: _reported ? null : () => setState(() => _view = _PanelView.report),
        ),
      ],
    );
  }

  Widget _pillButton({required IconData icon, required String label, required bool active, required VoidCallback onTap}) {
    return Material(
      color: active ? AppColors.brandOrange.withValues(alpha: 0.15) : Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: active ? AppColors.brandOrange : context.borderSubtle),
          ),
          child: Column(
            children: [
              Icon(icon, size: 18, color: active ? AppColors.brandOrange : context.textPrimary),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(fontSize: 12, color: active ? AppColors.brandOrange : context.textPrimary, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _menuRow({required IconData icon, required String label, VoidCallback? onTap, bool danger = false}) {
    final color = danger ? Colors.redAccent : context.textPrimary;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Row(
            children: [
              Icon(icon, size: 20, color: onTap == null ? color.withValues(alpha: 0.5) : color),
              const SizedBox(width: 14),
              Expanded(
                child: Text(label, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: onTap == null ? color.withValues(alpha: 0.5) : color)),
              ),
              if (onTap != null) Icon(Icons.chevron_right, size: 18, color: context.textDim),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPlaylistsPanel() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconButton(
              icon: Icon(Icons.arrow_back, color: context.textPrimary, size: 20),
              onPressed: () => setState(() => _view = _PanelView.main),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 8),
            Text('Save to playlist', style: TextStyle(color: context.textPrimary, fontSize: 17, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 12),
        if (!_playlistsLoaded)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandOrange)),
          )
        else ...[
          if (_playlists.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Text('No playlists yet — create one below.', style: TextStyle(color: context.textSecondary, fontSize: 13)),
            ),
          for (final playlist in _playlists)
            CheckboxListTile(
              contentPadding: EdgeInsets.zero,
              value: playlist.videoIds.contains(widget.video.videoId),
              activeColor: AppColors.brandOrange,
              controlAffinity: ListTileControlAffinity.leading,
              title: Text(playlist.name, style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
              onChanged: _playlistBusyId == playlist.playlistId
                  ? null
                  : (checked) => _togglePlaylistMembership(playlist, checked ?? false),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _newPlaylistController,
                  style: TextStyle(color: context.textPrimary, fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'New playlist name',
                    hintStyle: TextStyle(color: context.textDim, fontSize: 13),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: context.borderSubtle)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: context.borderSubtle)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _creatingPlaylist
                  ? const SizedBox(width: 40, height: 40, child: Padding(padding: EdgeInsets.all(10), child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.brandOrange)))
                  : IconButton(
                      icon: const Icon(Icons.add_circle, color: AppColors.brandOrange, size: 30),
                      onPressed: _createPlaylist,
                    ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildReportPanel() {
    if (_reportSubmitted) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32),
        child: Center(
          child: Column(
            children: [
              const Icon(Icons.check_circle, color: AppColors.brandOrange, size: 40),
              const SizedBox(height: 12),
              Text('Report submitted', style: TextStyle(color: context.textPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconButton(
              icon: Icon(Icons.arrow_back, color: context.textPrimary, size: 20),
              onPressed: () => setState(() => _view = _PanelView.main),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
            const SizedBox(width: 8),
            Text('Report video', style: TextStyle(color: context.textPrimary, fontSize: 17, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 8),
        RadioGroup<String>(
          groupValue: _reportReason,
          onChanged: (value) => setState(() => _reportReason = value),
          child: Column(
            children: [
              for (final reason in kReportReasons)
                InkWell(
                  onTap: () => setState(() => _reportReason = reason['value']!),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Row(
                      children: [
                        Radio<String>(
                          value: reason['value']!,
                          activeColor: AppColors.brandOrange,
                        ),
                        Expanded(
                          child: Text(
                            reason['label']!,
                            style: TextStyle(color: context.textPrimary, fontSize: 14),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: _reportDetailsController,
          maxLines: 3,
          style: TextStyle(color: context.textPrimary, fontSize: 14),
          decoration: InputDecoration(
            hintText: 'Additional details (optional)',
            hintStyle: TextStyle(color: context.textDim, fontSize: 13),
            contentPadding: const EdgeInsets.all(12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: context.borderSubtle)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: context.borderSubtle)),
          ),
        ),
        const SizedBox(height: 14),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: (_reportReason == null || _reportSubmitting) ? null : _submitReport,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _reportSubmitting
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : const Text('Submit report', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ),
      ],
    );
  }
}

Future<void> showVideoOptionsSheet(BuildContext context, Video video) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (ctx) => VideoOptionsSheet(video: video),
  );
}
