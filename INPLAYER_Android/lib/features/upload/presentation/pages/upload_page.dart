import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../core/utils/music_track_utils.dart';
import '../../../../core/utils/music_copyright.dart';
import '../../../../core/utils/mux_thumbnail.dart';
import '../../../../services/ai_assist_service.dart';
import '../../../../services/upload_service.dart';
import '../../../../models/lyric_line.dart';
import '../widgets/ai_title_assist_sheet.dart';
import '../../../../models/soundtrack.dart';
import '../widgets/lyrics_sync_editor.dart';
import '../widgets/short_creation_tools.dart';

const _categories = [
  'Entertainment',
  'Movies',
  'Web Series',
  'Raftaar (Vertical Videos)',
  'Music',
  'Podcasts',
  'Gaming',
  'Education',
  'Business & Finance',
  'Technology',
  'News & Politics',
  'Sports',
  'Food & Cooking',
  'Travel & Vlogs',
  'Fashion & Beauty',
  'Health & Fitness',
  'Comedy',
  'Drama',
  'Romance',
  'Horror',
  'Crime & Mystery',
  'Kids',
  'Pets & Animals',
  'Science',
  'Art & Design',
  'DIY & Crafts',
  'Automobiles',
  'Home & Lifestyle',
  'Agriculture',
  'Devotional',
  'Live Streams',
];

const _visibilityOptions = [
  (value: 'public', label: 'Public — anyone can watch'),
  (value: 'unlisted', label: 'Unlisted — only people with the link'),
  (value: 'private', label: 'Private — only you'),
];

// Matches AUDIENCE_OPTIONS in the website's app/lib/contentAccess.ts exactly.
const _audienceOptions = [
  (value: 'everyone', label: 'Everyone', hint: 'Shown to all viewers'),
  (value: 'kids', label: 'Kids', hint: 'Also appears in the Kids row'),
  (value: 'adult', label: '18+', hint: 'Hidden unless 18+ is unlocked'),
];

const _languageOptions = [
  (value: 'auto', label: 'Auto-detect'),
  (value: 'en', label: 'English'),
  (value: 'hi', label: 'Hindi'),
  (value: 'bn', label: 'Bengali'),
];

// Matches MUSIC_GENRES in the website's app/lib/musicTrack.ts exactly — a
// closed list so genre browsing stays consistent. "Other" is both the last
// option and the sanitizeGenre() fallback if this ever drifts from the
// server's list.
const _musicGenres = [
  'Pop',
  'Hip-Hop',
  'R&B',
  'Rock',
  'Electronic',
  'Classical',
  'Folk',
  'Indie',
  'Devotional',
  'Bollywood',
  'Instrumental',
  'Other',
];

enum _Stage { picking, details, uploading, processing, done, timedOut, error }

class UploadPage extends ConsumerStatefulWidget {
  const UploadPage({super.key});

  @override
  ConsumerState<UploadPage> createState() => _UploadPageState();
}

class _UploadPageState extends ConsumerState<UploadPage> {
  _Stage _stage = _Stage.picking;

  XFile? _file;
  XFile? _thumbnailFile;
  final List<XFile> _musicCovers = [];
  int _coverIntervalSeconds = 12;
  int? _fileSizeBytes;
  String _contentType = 'video';

  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _tagController = TextEditingController();
  final _lyricsController = TextEditingController();

  String _category = _categories.first;
  String _visibility = 'public';
  String _spokenLanguage = 'auto';
  String _genre = 'Other';
  final List<String> _tags = [];
  // One 3-way choice (Everyone / Kids / 18+) — matches the website's
  // `VideoAudience` (app/lib/contentAccess.ts), replacing what used to be
  // two separate switches here that could contradict each other (e.g. both
  // "made for kids" and "18+" on at once). The two legacy booleans below are
  // still what actually gets sent to the API, derived from this choice via
  // the same `audienceFlags()` logic the website uses, so the backend
  // contract is unchanged.
  String _audience = 'everyone';
  bool get _madeForKids => _audience == 'kids';
  bool get _ageRestricted => _audience == 'adult';
  bool _commentsEnabled = true;
  bool _membersOnly = false;
  // Matches MusicUploadTools.tsx's ownership checkbox — real user consent
  // instead of the value being silently hardcoded true (Round 24 parity fix).
  bool _declaredOwnership = false;

  double _progress = 0;
  String? _uploadedVideoId;
  String? _errorMessage;
  bool _publishing = false;
  Timer? _pollTimer;
  int _pollAttempts = 0;

  /// Mux playback id, captured the moment processing reports ready.
  ///
  /// This is what makes the post-upload thumbnail step possible at all —
  /// the candidate frames are just Mux image URLs built from this id, and it
  /// does not exist until the asset has finished processing. Same reason the
  /// website only reaches UploadThumbnailStep from its own ready state.
  String? _readyPlaybackId;

  /// The frame the creator picked, if any. Null means "keep whatever Mux
  /// chose automatically" — a perfectly good answer that costs no request.
  String? _chosenThumbnailUrl;
  bool _savingThumbnail = false;

  /// True while an AI assist request is in flight for the description or
  /// tags field (titles run inside their own sheet and track it there).
  bool _aiBusy = false;

  /// Lines produced by the tap-to-stamp editor.
  ///
  /// When non-empty this WINS over parsing the plain-text field at publish
  /// time — it carries real per-line timings the textarea cannot express
  /// unless the creator hand-writes LRC tags. Typing in the textarea clears
  /// it again, so the two can never silently disagree about which is the
  /// real lyric sheet.
  List<LyricLine> _syncedLyrics = const [];

  /// Background soundtrack, clip length and Look filter. Same defaults as the
  /// website's own initial state (no track, 30s, "original").
  ShortSettings _shortSettings = const ShortSettings();

  bool get _isMusicUpload => _contentType == 'music' || _category.toLowerCase() == 'music';

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _tagController.dispose();
    _lyricsController.dispose();
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _pickVideo(String contentType) async {
    try {
      final picked = await ImagePicker().pickVideo(source: ImageSource.gallery);
      if (picked == null || !mounted) return;

      final size = await File(picked.path).length();
      final nameWithoutExt = picked.name.contains('.')
          ? picked.name.substring(0, picked.name.lastIndexOf('.'))
          : picked.name;

      setState(() {
        _file = picked;
        _fileSizeBytes = size;
        _contentType = contentType;
        if (contentType == 'short') {
          _category = 'Raftaar (Vertical Videos)';
        }
        _titleController.text = nameWithoutExt;
        _stage = _Stage.details;
      });
    } catch (e) {
      if (!mounted) return;
      _showSnack("Couldn't open your gallery. Please try again.");
    }
  }

  Future<void> _pickThumbnail() async {
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1920,
        maxHeight: 1080,
        imageQuality: 85,
      );
      if (picked == null || !mounted) return;
      setState(() {
        _thumbnailFile = picked;
      });
    } catch (e) {
      if (!mounted) return;
      _showSnack("Couldn't pick thumbnail image.");
    }
  }

  Future<void> _pickMusicCover() async {
    if (_musicCovers.length >= 5) {
      _showSnack("You can add up to 5 cover images.");
      return;
    }
    try {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (picked == null || !mounted) return;
      setState(() {
        _musicCovers.add(picked);
        _thumbnailFile ??= picked;
      });
    } catch (e) {
      if (!mounted) return;
      _showSnack("Couldn't pick cover image.");
    }
  }

  /// Swap a cover one place left or right.
  ///
  /// Mirrors `moveCover` in the website's MusicUploadTools.tsx exactly,
  /// including that it is a plain swap rather than a remove-and-insert —
  /// with at most 5 covers the difference is invisible, and a swap can't
  /// silently drop an entry if an index is off by one.
  ///
  /// `_thumbnailFile` deliberately follows position 0 rather than staying
  /// pinned to whichever file it was: covers.first is the track's poster
  /// everywhere else in the app, so moving a cover to the front is exactly
  /// how a creator says "this is the artwork".
  void _moveMusicCover(int index, int delta) {
    final target = index + delta;
    if (index < 0 || index >= _musicCovers.length) return;
    if (target < 0 || target >= _musicCovers.length) return;
    setState(() {
      final tmp = _musicCovers[index];
      _musicCovers[index] = _musicCovers[target];
      _musicCovers[target] = tmp;
      _thumbnailFile = _musicCovers.first;
    });
  }

  Widget _coverMoveButton({
    required IconData icon,
    required bool enabled,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Container(
        padding: const EdgeInsets.all(1),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: enabled ? 0.7 : 0.25),
          shape: BoxShape.circle,
        ),
        child: Icon(
          icon,
          color: Colors.white.withValues(alpha: enabled ? 1.0 : 0.35),
          size: 16,
        ),
      ),
    );
  }

  void _removeMusicCover(int index) {
    if (index >= 0 && index < _musicCovers.length) {
      setState(() {
        final removed = _musicCovers.removeAt(index);
        if (_thumbnailFile?.path == removed.path) {
          _thumbnailFile = _musicCovers.isNotEmpty ? _musicCovers.first : null;
        }
      });
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
      ),
    );
  }

  void _addTag(String raw) {
    // Matches the website's dedup: case-insensitive, and a leading '#'
    // typed by the user is stripped rather than kept as part of the tag
    // (Round 24 parity fix — this used to be a case-sensitive, '#'-keeping
    // check, so "Music" and "music" could both get added).
    var tag = raw.trim();
    if (tag.startsWith('#')) tag = tag.substring(1).trim();
    if (tag.isEmpty || _tags.length >= 15) return;
    final alreadyHave = _tags.any((t) => t.toLowerCase() == tag.toLowerCase());
    if (alreadyHave) return;
    setState(() => _tags.add(tag));
    _tagController.clear();
  }

  Future<void> _publish() async {
    if (_file == null || _publishing) return;

    final title = _titleController.text.trim();
    if (title.isEmpty) {
      _showSnack('Please give your upload a title.');
      return;
    }

    // Matches the website's own block (app/upload/page.tsx handlePublish) —
    // music has no video frame for a thumbnail, so cover art is the only
    // image the track will ever have. The server enforces this too; this is
    // just the friendlier place to find out (Round 24 parity fix — Android
    // previously had no client-side check here at all).
    if (_isMusicUpload && _musicCovers.isEmpty) {
      _showSnack('Please add cover art — a music upload needs at least one image.');
      return;
    }

    setState(() {
      _publishing = true;
      _errorMessage = null;
      _stage = _Stage.uploading;
      _progress = 0;
    });

    // 1. Prepare thumbnail data URL if present
    String? thumbnailDataUrl;
    if (_thumbnailFile != null) {
      try {
        final bytes = await File(_thumbnailFile!.path).readAsBytes();
        final base64 = base64Encode(bytes);
        thumbnailDataUrl = 'data:image/jpeg;base64,$base64';
      } catch (e) {
        // non-fatal
      }
    }

    // 2. Upload music covers to S3 if music upload
    List<String> coverUrls = [];
    if (_isMusicUpload && _musicCovers.isNotEmpty) {
      for (final cover in _musicCovers) {
        final url = await ref.read(uploadServiceProvider).uploadCoverArt(cover.path);
        if (url != null && url.isNotEmpty) {
          coverUrls.add(url);
        }
      }
    }

    // 3. Parse lyrics if provided
    List<Map<String, dynamic>> parsedLyricsJson = [];
    if (_isMusicUpload && _syncedLyrics.isNotEmpty) {
      // The editor's output takes precedence — it carries real per-line
      // timings, which the plain textarea can only express if the creator
      // hand-wrote LRC tags.
      parsedLyricsJson = _syncedLyrics.map((l) => l.toJson()).toList();
    } else if (_isMusicUpload && _lyricsController.text.trim().isNotEmpty) {
      final parsed = parseLyrics(_lyricsController.text);
      parsedLyricsJson = parsed.map((l) => l.toJson()).toList();
    }

    // 4. Fingerprint the audio bytes for server-side duplicate-track
    // detection — matches the website's client-side hash in
    // MusicUploadTools.tsx (Round 24 parity fix). Non-fatal if it fails;
    // the upload still proceeds without a fingerprint rather than blocking.
    String? audioSha256;
    if (_isMusicUpload) {
      try {
        final bytes = await File(_file!.path).readAsBytes();
        audioSha256 = sha256.convert(bytes).toString();
      } catch (e) {
        // non-fatal
      }
    }

    final createResult = await ref.read(uploadServiceProvider).createUpload(
          title: title,
          description: _descriptionController.text.trim(),
          category: _category,
          contentType: _isMusicUpload ? 'music' : _contentType,
          spokenLanguage: _spokenLanguage,
          visibility: _visibility,
          audience: _audience,
          madeForKids: _madeForKids,
          ageRestricted: _ageRestricted,
          commentsEnabled: _commentsEnabled,
          membersOnly: _membersOnly,
          tags: _tags,
          thumbnailDataUrl: thumbnailDataUrl,
          covers: coverUrls,
          coverIntervalSeconds: _coverIntervalSeconds,
          lyrics: parsedLyricsJson,
          genre: _isMusicUpload ? _genre : null,
          audioSha256: _isMusicUpload ? audioSha256 : null,
          declaredOwnership: _isMusicUpload ? _declaredOwnership : false,
          // Soundtrack + Look. Sent for video and short, not music — a music
          // upload IS the audio, so a background track over it is
          // meaningless, and the website's picker is likewise hidden there.
          // Null when nothing was changed, so an ordinary upload sends no
          // shortSettings key at all rather than a default-shaped one.
          shortSettings: (!_isMusicUpload && !_shortSettings.isDefault)
              ? _shortSettings.toJson()
              : null,
        );

    if (!mounted) return;

    if (!createResult.success ||
        createResult.uploadUrl == null ||
        createResult.videoId == null) {
      setState(() {
        _errorMessage = createResult.error ?? "Couldn't start the upload.";
        _stage = _Stage.error;
        _publishing = false;
      });
      return;
    }

    _uploadedVideoId = createResult.videoId;

    final uploadOk = await ref.read(uploadServiceProvider).uploadFile(
          createResult.uploadUrl!,
          _file!.path,
          onProgress: (p) {
            if (mounted) setState(() => _progress = p);
          },
        );

    if (!mounted) return;

    if (!uploadOk) {
      setState(() {
        _errorMessage = 'Something went wrong uploading your file. Please try again.';
        _stage = _Stage.error;
        _publishing = false;
      });
      return;
    }

    setState(() {
      _stage = _Stage.processing;
      _publishing = false;
    });
    _startPolling();
  }

  void _startPolling() {
    _pollAttempts = 0;
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (timer) async {
      _pollAttempts++;
      final videoId = _uploadedVideoId;
      if (videoId == null) {
        timer.cancel();
        return;
      }

      final status = await ref.read(uploadServiceProvider).checkStatus(videoId);
      if (!mounted) return;

      if (status.isReady) {
        timer.cancel();
        setState(() {
          // Only available now that processing has finished — see the field
          // doc. Drives the thumbnail picker on the done screen.
          _readyPlaybackId = status.playbackId;
          _stage = _Stage.done;
        });
      } else if (status.isErrored) {
        timer.cancel();
        setState(() {
          _errorMessage =
              status.error ?? 'Your file finished uploading, but processing failed. Please try a different file.';
          _stage = _Stage.error;
        });
      } else if (_pollAttempts >= 100) {
        // 100 attempts * 3s = 5 minutes of polling with no "ready" or
        // "errored" status back yet. This does NOT mean the upload failed —
        // Mux is very likely still genuinely processing a large file — but
        // it also isn't safe to claim success here: silently jumping to
        // "Published!" would be an honest-looking screen lying about the
        // real state, exactly the bug this timedOut stage exists to avoid.
        timer.cancel();
        setState(() => _stage = _Stage.timedOut);
      }
    });
  }

  void _reset() {
    _pollTimer?.cancel();
    setState(() {
      _stage = _Stage.picking;
      _file = null;
      _thumbnailFile = null;
      _musicCovers.clear();
      _fileSizeBytes = null;
      _contentType = 'video';
      _titleController.clear();
      _descriptionController.clear();
      _tagController.clear();
      _lyricsController.clear();
      _tags.clear();
      _category = _categories.first;
      _visibility = 'public';
      _spokenLanguage = 'auto';
      _audience = 'everyone';
      _commentsEnabled = true;
      _membersOnly = false;
      _declaredOwnership = false;
      _progress = 0;
      _uploadedVideoId = null;
      _errorMessage = null;
      _publishing = false;
      _readyPlaybackId = null;
      _chosenThumbnailUrl = null;
      _savingThumbnail = false;
      _aiBusy = false;
      _syncedLyrics = const [];
      _shortSettings = const ShortSettings();
    });
  }

  /// Everything the AI prompt builder needs about this upload. Kept in one
  /// place so the title, description and tag helpers all describe the same
  /// upload the same way — the whole reason the website keeps its own
  /// equivalent in a shared aiPrompts.ts rather than per-field.
  AIPromptContext _aiContext({String? userDescription}) => AIPromptContext(
        title: _titleController.text,
        description: _descriptionController.text,
        category: _category,
        contentType: _isMusicUpload ? 'music' : _contentType,
        userDescription: userDescription,
      );

  /// Opens the tap-to-stamp lyrics editor against the picked audio file.
  ///
  /// Needs the real file, not just text — the whole point is timing lines by
  /// ear against the actual track, so there is nothing useful to show before
  /// one has been chosen.
  Future<void> _openLyricsEditor() async {
    final file = _file;
    if (file == null) {
      _showSnack('Pick your audio file first.');
      return;
    }

    final result = await showLyricsSyncEditor(
      context,
      audioFilePath: file.path,
      initialLines: _syncedLyrics,
      initialRawText: _lyricsController.text,
    );
    if (result == null || !mounted) return;

    setState(() {
      _syncedLyrics = result;
      // Mirror the result back into the textarea as LRC so what is on screen
      // always matches what will actually be published — leaving the old
      // text sitting there under a "12 lines timed" badge would be two
      // different answers to the same question.
      _lyricsController.text = result.isEmpty ? '' : toLrc(result);
    });
  }

  Future<void> _openTitleAssist() async {
    final picked = await showAITitleAssistSheet(
      context,
      initialDescription: _descriptionController.text.trim(),
      buildContext: (userDescription) =>
          _aiContext(userDescription: userDescription),
    );
    if (picked == null || !mounted) return;
    setState(() => _titleController.text = picked);
  }

  Future<void> _generateDescription() async {
    if (_aiBusy) return;
    setState(() => _aiBusy = true);
    try {
      final text =
          await ref.read(aiAssistServiceProvider).suggestDescription(_aiContext());
      if (!mounted) return;
      setState(() {
        _descriptionController.text = text;
        _aiBusy = false;
      });
    } on AIAssistException catch (e) {
      if (!mounted) return;
      setState(() => _aiBusy = false);
      _showSnack(e.message);
    }
  }

  Future<void> _generateTags() async {
    if (_aiBusy) return;
    setState(() => _aiBusy = true);
    try {
      final tags = await ref.read(aiAssistServiceProvider).suggestTags(_aiContext());
      if (!mounted) return;
      // Routed through _addTag rather than assigned straight into _tags so
      // the AI's output goes through exactly the same dedup, '#'-stripping
      // and 15-tag limit as anything typed by hand. Deliberately NOT wrapped
      // in an outer setState — _addTag calls setState itself, and nesting
      // the two is a mistake even where Flutter tolerates it.
      for (final t in tags) {
        _addTag(t);
      }
      setState(() => _aiBusy = false);
    } on AIAssistException catch (e) {
      if (!mounted) return;
      setState(() => _aiBusy = false);
      _showSnack(e.message);
    }
  }

  /// Persists the frame picked on the done screen.
  ///
  /// Non-fatal by design, exactly like the website's own version: the video
  /// is already fully published and Mux's auto-generated thumbnail is
  /// already live, so a failure here costs a nicer still, not the upload.
  Future<void> _saveChosenThumbnail() async {
    final videoId = _uploadedVideoId;
    final url = _chosenThumbnailUrl;
    if (videoId == null || url == null || _savingThumbnail) return;

    setState(() => _savingThumbnail = true);
    final ok = await ref.read(uploadServiceProvider).setThumbnail(videoId, url);
    if (!mounted) return;
    setState(() => _savingThumbnail = false);
    _showSnack(ok
        ? 'Thumbnail updated.'
        : "Couldn't save that thumbnail — the automatic one is still live.");
  }

  @override
  Widget build(BuildContext context) {
    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          title: Text(
            'Upload Studio',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
          leading: _stage == _Stage.details
              ? IconButton(
                  icon: Icon(Icons.close, color: context.textPrimary),
                  onPressed: _reset,
                )
              : null,
        ),
        body: SafeArea(child: _buildStage()),
      ),
    );
  }

  Widget _buildStage() {
    switch (_stage) {
      case _Stage.picking:
        return _buildPicking();
      case _Stage.details:
        return _buildDetails();
      case _Stage.uploading:
        return _buildUploading();
      case _Stage.processing:
        return _buildProcessing();
      case _Stage.done:
        return _buildDone();
      case _Stage.timedOut:
        return _buildTimedOut();
      case _Stage.error:
        return _buildError();
    }
  }

  Widget _buildPicking() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.brandOrange.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.cloud_upload_outlined,
                size: 56,
                color: AppColors.brandOrange,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Upload to InPlayer',
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: context.textPrimary,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Share your high-definition videos, music, and Raftaar shorts with the world.',
              style: TextStyle(color: context.textSecondary, fontSize: 13, height: 1.4),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: AppColors.flameGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.brandOrange.withValues(alpha: 0.3),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: ElevatedButton.icon(
                onPressed: () => _pickVideo('video'),
                icon: const Icon(Icons.video_library_rounded, color: Colors.black),
                label: const Text(
                  'Upload Longform Video',
                  style: TextStyle(color: Colors.black, fontWeight: FontWeight.w800, fontSize: 14),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.transparent,
                  shadowColor: Colors.transparent,
                  minimumSize: const Size(double.infinity, 52),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: context.bgCard,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: context.borderSubtle),
              ),
              child: OutlinedButton.icon(
                onPressed: () => _pickVideo('short'),
                icon: const Icon(Icons.play_circle_fill_rounded, color: AppColors.brandOrange),
                label: Text(
                  'Upload Raftaar Short (⚡)',
                  style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.w700, fontSize: 14),
                ),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 52),
                  side: BorderSide.none,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
            const SizedBox(height: 14),
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: context.bgCard,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: context.borderSubtle),
              ),
              child: OutlinedButton.icon(
                onPressed: () {
                  setState(() => _category = 'Music');
                  _pickVideo('music');
                },
                icon: const Icon(Icons.music_note_rounded, color: AppColors.brandOrange),
                label: Text(
                  'Upload Music & Audio Track (🎵)',
                  style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.w700, fontSize: 14),
                ),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 52),
                  side: BorderSide.none,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetails() {
    final sizeLabel = _fileSizeBytes != null
        ? '${(_fileSizeBytes! / (1024 * 1024)).toStringAsFixed(1)} MB'
        : '';

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: context.bgCard,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: context.borderSubtle),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: AppColors.brandOrange.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(
                  _contentType == 'short'
                      ? Icons.play_circle
                      : (_isMusicUpload ? Icons.music_note : Icons.movie_outlined),
                  color: AppColors.brandOrange,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _file?.name ?? '',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: context.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$sizeLabel • ${_contentType == 'short' ? 'Raftaar Short' : (_isMusicUpload ? 'Music Track' : 'Longform Video')}',
                      style: TextStyle(
                        color: context.textDim,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(Icons.close, color: context.textDim),
                onPressed: _reset,
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'video', label: Text('Video'), icon: Icon(Icons.movie_outlined)),
            ButtonSegment(value: 'short', label: Text('Short'), icon: Icon(Icons.play_circle_outline)),
            ButtonSegment(value: 'music', label: Text('Music'), icon: Icon(Icons.music_note_outlined)),
          ],
          selected: {_contentType},
          onSelectionChanged: (s) => setState(() {
            _contentType = s.first;
            if (_contentType == 'music') {
              _category = 'Music';
            }
          }),
        ),
        const SizedBox(height: 16),

        // Custom Cover / Thumbnail selector
        if (!_isMusicUpload) ...[
          _label('Thumbnail / Cover Image'),
          GestureDetector(
            onTap: _pickThumbnail,
            child: Container(
              height: 120,
              decoration: BoxDecoration(
                color: context.bgCard,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: context.borderSubtle),
                image: _thumbnailFile != null
                    ? DecorationImage(
                        image: FileImage(File(_thumbnailFile!.path)),
                        fit: BoxFit.cover,
                      )
                    : null,
              ),
              child: _thumbnailFile == null
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.add_photo_alternate_outlined, color: AppColors.brandOrange, size: 32),
                          const SizedBox(height: 6),
                          Text(
                            'Upload custom thumbnail',
                            style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    )
                  : Align(
                      alignment: Alignment.topRight,
                      child: Container(
                        margin: const EdgeInsets.all(8),
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(color: Colors.black54, shape: BoxShape.circle),
                        child: const Icon(Icons.edit, color: Colors.white, size: 16),
                      ),
                    ),
            ),
          ),
        ] else ...[
          // Music Cover Carousel Editor (up to 5 covers)
          _label('Music Artwork & Covers (up to 5 rotating covers)'),
          SizedBox(
            height: 110,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                ..._musicCovers.asMap().entries.map((entry) {
                  final i = entry.key;
                  final cover = entry.value;
                  return Stack(
                    children: [
                      Container(
                        width: 100,
                        height: 100,
                        margin: const EdgeInsets.only(right: 12),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: context.borderSubtle),
                          image: DecorationImage(
                            image: FileImage(File(cover.path)),
                            fit: BoxFit.cover,
                          ),
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 16,
                        child: GestureDetector(
                          onTap: () => _removeMusicCover(i),
                          child: Container(
                            padding: const EdgeInsets.all(3),
                            decoration: const BoxDecoration(color: Colors.black87, shape: BoxShape.circle),
                            child: const Icon(Icons.close, color: Colors.white, size: 14),
                          ),
                        ),
                      ),
                      // Reorder. Order is not decoration here — covers
                      // rotate during playback in the order they appear
                      // (see coverIndexAt), and covers.first is what
                      // becomes the track's poster everywhere else in the
                      // app, so "which one is first" is a real choice the
                      // creator needs to be able to make. Arrows rather
                      // than drag-and-drop deliberately: this sits inside a
                      // horizontally scrolling list, and a long-press drag
                      // there fights the scroll gesture.
                      Positioned(
                        bottom: 4,
                        left: 4,
                        right: 16,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _coverMoveButton(
                              icon: Icons.chevron_left_rounded,
                              enabled: i > 0,
                              onTap: () => _moveMusicCover(i, -1),
                            ),
                            if (i == 0)
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 5, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.brandOrange
                                      .withValues(alpha: 0.9),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Text(
                                  'COVER',
                                  style: TextStyle(
                                    color: Colors.black,
                                    fontSize: 7,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ),
                            _coverMoveButton(
                              icon: Icons.chevron_right_rounded,
                              enabled: i < _musicCovers.length - 1,
                              onTap: () => _moveMusicCover(i, 1),
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                }),
                if (_musicCovers.length < 5)
                  GestureDetector(
                    onTap: _pickMusicCover,
                    child: Container(
                      width: 100,
                      height: 100,
                      decoration: BoxDecoration(
                        color: context.bgCard,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: context.borderSubtle, style: BorderStyle.solid),
                      ),
                      child: Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.add_photo_alternate_outlined, color: AppColors.brandOrange, size: 28),
                            const SizedBox(height: 4),
                            Text('Add Cover', style: TextStyle(color: context.textDim, fontSize: 11)),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _label('Cover Hold Duration: ${_coverIntervalSeconds}s per cover'),
          Slider(
            value: _coverIntervalSeconds.toDouble(),
            min: 3,
            max: 60,
            divisions: 57,
            activeColor: AppColors.brandOrange,
            label: '${_coverIntervalSeconds}s',
            onChanged: (v) => setState(() => _coverIntervalSeconds = v.round()),
          ),
          const SizedBox(height: 12),
          // Ownership declaration — matches MusicUploadTools.tsx exactly
          // (copy included). Round 24 parity fix: this used to not exist at
          // all, and the API call always claimed `declaredOwnership: true`
          // regardless of what the uploader actually confirmed.
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: _declaredOwnership
                    ? const Color(0xFF10B981).withValues(alpha: 0.3)
                    : const Color(0xFFF59E0B).withValues(alpha: 0.3),
              ),
              color: _declaredOwnership
                  ? const Color(0xFF10B981).withValues(alpha: 0.06)
                  : const Color(0xFFF59E0B).withValues(alpha: 0.06),
            ),
            child: InkWell(
              onTap: () => setState(() => _declaredOwnership = !_declaredOwnership),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Checkbox(
                    value: _declaredOwnership,
                    activeColor: const Color(0xFF10B981),
                    onChanged: (v) => setState(() => _declaredOwnership = v ?? false),
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.verified_user,
                                size: 14,
                                color: _declaredOwnership
                                    ? const Color(0xFF10B981)
                                    : const Color(0xFFF59E0B),
                              ),
                              const SizedBox(width: 6),
                              Text(
                                'This recording is mine to publish',
                                style: TextStyle(
                                  color: context.textPrimary,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            "I wrote, performed or licensed this track, and I hold the rights to put it on "
                            "InPlayer. Uploading someone else's recording — including a song from a film, a "
                            "label release, or a cover of a composition I don't have a licence for — gets the "
                            "track removed and can cost you your channel.",
                            style: TextStyle(color: context.textDim, fontSize: 11, height: 1.4),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          _buildCopyrightScreen(),
          const SizedBox(height: 12),
          _label('Genre'),
          DropdownButtonFormField<String>(
            initialValue: _genre,
            dropdownColor: context.bgCard,
            style: TextStyle(color: context.textPrimary),
            decoration: _inputDecoration(null),
            items: _musicGenres
                .map((g) => DropdownMenuItem(value: g, child: Text(g, overflow: TextOverflow.ellipsis)))
                .toList(),
            onChanged: (v) => setState(() => _genre = v ?? _genre),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _label('Synchronized Lyrics (.lrc or plain text)'),
              const Spacer(),
              // Opens the tap-to-stamp editor. Kept alongside the plain
              // textarea rather than replacing it: pasting an existing .lrc
              // is still the fastest path when the creator already has one,
              // and the editor is the answer when they don't.
              Padding(
                padding: const EdgeInsets.only(top: 14, bottom: 6),
                child: InkWell(
                  borderRadius: BorderRadius.circular(20),
                  onTap: _openLyricsEditor,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: AppColors.brandOrange.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(
                        color: AppColors.brandOrange.withValues(alpha: 0.35),
                      ),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.graphic_eq_rounded,
                            size: 13, color: AppColors.brandOrangeLight),
                        SizedBox(width: 5),
                        Text(
                          'Sync to audio',
                          style: TextStyle(
                            color: AppColors.brandOrangeLight,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
          TextField(
            controller: _lyricsController,
            maxLines: 4,
            style: TextStyle(color: context.textPrimary, fontSize: 13),
            decoration: _inputDecoration('Paste your lyrics or [.lrc] timestamps here...'),
            // Typing here supersedes whatever the editor produced — the two
            // must not silently disagree about which is the real lyric
            // sheet. See _syncedLyrics.
            onChanged: (_) => setState(() => _syncedLyrics = const []),
          ),
          if (_syncedLyrics.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Row(
                children: [
                  const Icon(Icons.check_circle_rounded,
                      size: 14, color: AppColors.success),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${_syncedLyrics.length} lines timed'
                      '${_syncedLyrics.any((l) => l.time > 0) ? '' : ' (no timings yet)'}'
                      ' — tap "Sync to audio" to adjust.',
                      style: TextStyle(color: context.textDim, fontSize: 11),
                    ),
                  ),
                ],
              ),
            ),
        ],

        const SizedBox(height: 8),
        Row(
          children: [
            _label('Title'),
            const Spacer(),
            _aiChip('AI title', _openTitleAssist),
          ],
        ),
        TextField(
          controller: _titleController,
          maxLength: 100,
          style: TextStyle(color: context.textPrimary),
          decoration: _inputDecoration('Give it a title'),
          // Music only: the copyright pre-screen above reads this field, so
          // it has to rebuild as the creator types for the warning to be
          // live. Deliberately null otherwise — a rebuild per keystroke is
          // cheap on a form but pointless when nothing is watching.
          onChanged: _isMusicUpload ? (_) => setState(() {}) : null,
        ),
        Row(
          children: [
            _label('Description'),
            const Spacer(),
            _aiChip('AI write', _generateDescription),
          ],
        ),
        TextField(
          controller: _descriptionController,
          maxLength: 500,
          maxLines: 3,
          style: TextStyle(color: context.textPrimary),
          decoration: _inputDecoration('Tell viewers about it'),
          // Same reason as Title above — the copyright screen reads this.
          onChanged: _isMusicUpload ? (_) => setState(() {}) : null,
        ),
        _label('Category'),
        DropdownButtonFormField<String>(
          initialValue: _category,
          dropdownColor: context.bgCard,
          style: TextStyle(color: context.textPrimary),
          decoration: _inputDecoration(null),
          items: _categories
              .map((c) => DropdownMenuItem(value: c, child: Text(c, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: (v) => setState(() {
            _category = v ?? _category;
            if (_category.toLowerCase() == 'music') {
              _contentType = 'music';
            }
          }),
        ),
        _label('Visibility'),
        DropdownButtonFormField<String>(
          initialValue: _visibility,
          dropdownColor: context.bgCard,
          style: TextStyle(color: context.textPrimary),
          decoration: _inputDecoration(null),
          items: _visibilityOptions
              .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: (v) => setState(() => _visibility = v ?? _visibility),
        ),
        _label('Spoken Language'),
        DropdownButtonFormField<String>(
          initialValue: _spokenLanguage,
          dropdownColor: context.bgCard,
          style: TextStyle(color: context.textPrimary),
          decoration: _inputDecoration(null),
          items: _languageOptions
              .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label)))
              .toList(),
          onChanged: (v) => setState(() => _spokenLanguage = v ?? _spokenLanguage),
        ),
        // Soundtrack + Look. Hidden for music uploads, matching the website:
        // a music upload IS the audio, so laying a background track over it
        // is meaningless.
        if (!_isMusicUpload)
          ShortCreationTools(
            value: _shortSettings,
            onChanged: (v) => setState(() => _shortSettings = v),
            contentType: _contentType,
          ),
        Row(
          children: [
            _label('Tags'),
            const Spacer(),
            _aiChip('AI tags', _generateTags),
          ],
        ),
        TextField(
          controller: _tagController,
          style: TextStyle(color: context.textPrimary),
          decoration: _inputDecoration('Add a tag and press enter').copyWith(
            suffixIcon: IconButton(
              icon: const Icon(Icons.add, color: AppColors.brandOrange),
              onPressed: () => _addTag(_tagController.text),
            ),
          ),
          onSubmitted: _addTag,
        ),
        if (_tags.isNotEmpty) ...[
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: _tags.map((t) {
              return Chip(
                label: Text('#$t', style: const TextStyle(fontSize: 12)),
                deleteIcon: const Icon(Icons.close, size: 14),
                onDeleted: () => setState(() => _tags.remove(t)),
                backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              );
            }).toList(),
          ),
        ],
        const SizedBox(height: 12),
        _label('Audience'),
        DropdownButtonFormField<String>(
          initialValue: _audience,
          dropdownColor: context.bgCard,
          style: TextStyle(color: context.textPrimary),
          decoration: _inputDecoration(null),
          items: _audienceOptions
              .map((o) => DropdownMenuItem(value: o.value, child: Text('${o.label} — ${o.hint}', overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: (v) => setState(() => _audience = v ?? _audience),
        ),
        const SizedBox(height: 12),
        SwitchListTile(
          title: Text('Allow comments', style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
          value: _commentsEnabled,
          activeThumbColor: AppColors.brandOrange,
          onChanged: (v) => setState(() => _commentsEnabled = v),
          contentPadding: EdgeInsets.zero,
        ),
        // Website gates this for everything except Shorts (contentType !==
        // "short") — a members-only music track is an ordinary thing to
        // publish. Round 24 parity fix: this used to be video-only.
        if (_contentType == 'video' || _isMusicUpload)
          SwitchListTile(
            title: Text('Members only (👑)', style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
            subtitle: Text('Only paid subscribers can watch', style: TextStyle(color: context.textDim, fontSize: 12)),
            value: _membersOnly,
            activeThumbColor: AppColors.brandOrange,
            onChanged: (v) => setState(() => _membersOnly = v),
            contentPadding: EdgeInsets.zero,
          ),
        const SizedBox(height: 24),
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            gradient: AppColors.flameGradient,
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: AppColors.brandOrange.withValues(alpha: 0.3),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: ElevatedButton(
            onPressed: _publish,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.transparent,
              shadowColor: Colors.transparent,
              minimumSize: const Size(double.infinity, 52),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: const Text(
              'Publish Upload',
              style: TextStyle(color: Colors.black, fontWeight: FontWeight.w800, fontSize: 15),
            ),
          ),
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildUploading() {
    final pct = (_progress * 100).toInt();
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Stack(
              alignment: Alignment.center,
              children: [
                SizedBox(
                  width: 100,
                  height: 100,
                  child: CircularProgressIndicator(
                    value: _progress > 0 ? _progress : null,
                    strokeWidth: 6,
                    color: AppColors.brandOrange,
                    backgroundColor: context.borderSubtle,
                  ),
                ),
                Text(
                  '$pct%',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: context.textPrimary),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Text(
              'Uploading your file...',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: context.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              'Please keep the app open until the transfer finishes.',
              style: TextStyle(color: context.textDim, fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProcessing() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const SizedBox(
              width: 64,
              height: 64,
              child: CircularProgressIndicator(
                strokeWidth: 4,
                color: AppColors.brandOrange,
              ),
            ),
            const SizedBox(height: 24),
            Text(
              'Processing video...',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: context.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              'Generating resolutions and preparing streaming renditions. This usually takes under a minute.',
              style: TextStyle(color: context.textDim, fontSize: 12, height: 1.4),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  /// The post-upload thumbnail refinement step — the app's counterpart to
  /// the website's UploadThumbnailStep.tsx.
  ///
  /// Mux always picks a frame automatically, and that frame is already live
  /// by the time this shows. This step exists because the automatic pick is
  /// frequently a black frame, an intro card, or motion blur from a cut —
  /// the candidates below are spread across the middle 80% of the asset for
  /// exactly that reason (see getMuxThumbnailCandidates).
  ///
  /// Skipped entirely for music, matching the website: a music upload's
  /// "frames" are meaningless, its art comes from the covers the creator
  /// already chose.
  Widget _buildThumbnailStep() {
    final playbackId = _readyPlaybackId;
    if (playbackId == null || playbackId.isEmpty || _isMusicUpload) {
      return const SizedBox.shrink();
    }

    // Duration isn't known on this screen, so this takes the same fixed
    // early-timestamp fallback the website uses when duration is missing.
    final candidates = getMuxThumbnailCandidates(playbackId);
    if (candidates.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Pick a thumbnail',
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Or keep the one we picked automatically.',
            style: TextStyle(color: context.textDim, fontSize: 12),
          ),
          const SizedBox(height: 12),
          SizedBox(
            height: 62,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: candidates.length,
              separatorBuilder: (context, index) => const SizedBox(width: 8),
              itemBuilder: (context, i) {
                final url = candidates[i];
                final selected = _chosenThumbnailUrl == url;
                return GestureDetector(
                  onTap: () => setState(() => _chosenThumbnailUrl = url),
                  child: Container(
                    width: 104,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: selected
                            ? AppColors.brandOrange
                            : context.borderSubtle,
                        width: selected ? 2 : 1,
                      ),
                    ),
                    clipBehavior: Clip.antiAlias,
                    child: CachedNetworkImage(
                      imageUrl: url,
                      fit: BoxFit.cover,
                      placeholder: (context, imageUrl) =>
                          Container(color: Colors.black26),
                      errorWidget: (context, imageUrl, error) =>
                          Container(color: Colors.black26),
                    ),
                  ),
                );
              },
            ),
          ),
          if (_chosenThumbnailUrl != null) ...[
            const SizedBox(height: 10),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _savingThumbnail ? null : _saveChosenThumbnail,
                icon: _savingThumbnail
                    ? const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: AppColors.brandOrange),
                      )
                    : const Icon(Icons.check_rounded,
                        size: 16, color: AppColors.brandOrange),
                label: Text(
                  _savingThumbnail ? 'Saving...' : 'Use this thumbnail',
                  style: const TextStyle(
                    color: AppColors.brandOrange,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(double.infinity, 44),
                  side: BorderSide(
                    color: AppColors.brandOrange.withValues(alpha: 0.5),
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDone() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 64),
            ),
            const SizedBox(height: 20),
            Text(
              'Published!',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: context.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              'Your upload is live on InPlayer.',
              style: TextStyle(color: context.textDim, fontSize: 13),
            ),
            _buildThumbnailStep(),
            const SizedBox(height: 28),
            if (_uploadedVideoId != null) ...[
              ElevatedButton(
                onPressed: () {
                  final id = _uploadedVideoId!;
                  _reset();
                  context.push('/watch/$id');
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.brandOrange,
                  minimumSize: const Size(double.infinity, 48),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('Watch Video', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: 10),
            ],
            OutlinedButton(
              onPressed: _reset,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text('Upload Another', style: TextStyle(color: context.textPrimary)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTimedOut() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: AppColors.warning.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.hourglass_top_rounded, color: AppColors.warning, size: 64),
            ),
            const SizedBox(height: 20),
            Text(
              'Still processing…',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: context.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              "This is taking longer than usual — large files can take a while. It isn't published yet, but it's still working in the background. You can leave this screen; it'll show up in My Videos once it's ready.",
              style: TextStyle(color: context.textDim, fontSize: 13, height: 1.4),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 28),
            ElevatedButton(
              onPressed: () {
                _reset();
                context.push('/my-videos');
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brandOrange,
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: const Text('Go to My Videos', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
            const SizedBox(height: 10),
            OutlinedButton(
              onPressed: _reset,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text('Done', style: TextStyle(color: context.textPrimary)),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.error_outline_rounded, color: AppColors.error, size: 64),
            const SizedBox(height: 16),
            Text(
              'Upload failed',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: context.textPrimary),
            ),
            const SizedBox(height: 8),
            Text(
              _errorMessage ?? 'Something went wrong. Please try again.',
              style: TextStyle(color: context.textDim, fontSize: 12),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => setState(() => _stage = _Stage.details),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.brandOrange,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Try Again', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  /// Live copyright pre-screen for music uploads.
  ///
  /// Shows the creator, before they publish, exactly what an admin reviewer
  /// is going to see — while there is still time to reword a title or tick
  /// the ownership box. The same rules run server-side on publish
  /// (app/lib/musicCopyright.ts), so this is not a second opinion, it's a
  /// preview of the real one.
  ///
  /// **Deliberately never blocks publishing.** A metadata screen reads what
  /// was typed, not what was uploaded — it will occasionally suspect a
  /// genuine musician whose own song happens to be called "Cover". A false
  /// positive must not stop a real creator publishing their own work, so
  /// this is a warning card and nothing more.
  Widget _buildCopyrightScreen() {
    if (!_isMusicUpload) return const SizedBox.shrink();

    final screening = screenMusicMetadata(
      title: _titleController.text,
      description: _descriptionController.text,
      tags: _tags,
      declaredOwnership: _declaredOwnership,
    );

    if (!screening.needsReview) {
      return Padding(
        padding: const EdgeInsets.only(top: 12),
        child: Row(
          children: [
            const Icon(Icons.verified_user_rounded,
                size: 14, color: AppColors.success),
            const SizedBox(width: 6),
            Text(
              'No copyright signals — this looks clear to publish.',
              style: TextStyle(color: context.textDim, fontSize: 11),
            ),
          ],
        ),
      );
    }

    const amber = Color(0xFFF59E0B);
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: amber.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: amber.withValues(alpha: 0.35)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.gavel_rounded, size: 15, color: amber),
              const SizedBox(width: 7),
              Expanded(
                child: Text(
                  screening.signals.length == 1
                      ? 'This track will be flagged for review'
                      : '${screening.signals.length} things will flag this for review',
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ...screening.signals.map(
            (s) => Padding(
              padding: const EdgeInsets.only(bottom: 5),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('•  ',
                      style: TextStyle(color: context.textDim, fontSize: 11)),
                  Expanded(
                    child: Text(
                      s.detail,
                      style: TextStyle(
                        color: context.textDim,
                        fontSize: 11,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'You can still publish. This only means a moderator will look at '
            'it — if the track really is yours, nothing else happens.',
            style: TextStyle(
              color: context.textDim.withValues(alpha: 0.85),
              fontSize: 10.5,
              height: 1.4,
              fontStyle: FontStyle.italic,
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) {
    return Padding(
      padding: const EdgeInsets.only(top: 14, bottom: 6),
      child: Text(
        text,
        style: TextStyle(
          color: context.textSecondary,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }

  /// The small "ask the AI" affordance that sits on the right of a field
  /// label. Deliberately a quiet outlined chip rather than a filled button:
  /// these are optional helpers, and on the website they sit beside the
  /// field rather than competing with the primary Publish action.
  Widget _aiChip(String text, VoidCallback onTap) {
    return Padding(
      padding: const EdgeInsets.only(top: 14, bottom: 6),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: _aiBusy ? null : onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: AppColors.brandOrange.withValues(alpha: _aiBusy ? 0.05 : 0.12),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: AppColors.brandOrange.withValues(alpha: _aiBusy ? 0.15 : 0.35),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _aiBusy
                  ? const SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(
                        strokeWidth: 1.6,
                        color: AppColors.brandOrangeLight,
                      ),
                    )
                  : const Icon(Icons.auto_awesome_rounded,
                      size: 13, color: AppColors.brandOrangeLight),
              const SizedBox(width: 5),
              Text(
                text,
                style: TextStyle(
                  color: AppColors.brandOrangeLight
                      .withValues(alpha: _aiBusy ? 0.5 : 1.0),
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String? hint) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: context.textDim, fontSize: 13),
      filled: true,
      fillColor: context.bgCard,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: context.borderSubtle),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: context.borderSubtle),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.brandOrange, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }
}
