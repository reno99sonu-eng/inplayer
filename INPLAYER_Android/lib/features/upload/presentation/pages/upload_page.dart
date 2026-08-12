import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../services/upload_service.dart';

// Same topical categories the website's upload form and category bar share
// (see app/data/categories.ts's CONTENT_CATEGORIES) — kept in sync by hand
// since Dart can't import a TypeScript file.
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

const _languageOptions = [
  (value: 'auto', label: 'Auto-detect'),
  (value: 'en', label: 'English'),
  (value: 'hi', label: 'Hindi'),
  (value: 'bn', label: 'Bengali'),
];

enum _Stage { picking, details, uploading, processing, done, error }

class UploadPage extends ConsumerStatefulWidget {
  const UploadPage({super.key});

  @override
  ConsumerState<UploadPage> createState() => _UploadPageState();
}

class _UploadPageState extends ConsumerState<UploadPage> {
  _Stage _stage = _Stage.picking;

  XFile? _file;
  int? _fileSizeBytes;
  String _contentType = 'video';

  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _tagController = TextEditingController();

  String _category = _categories.first;
  String _visibility = 'public';
  String _spokenLanguage = 'auto';
  final List<String> _tags = [];
  bool _madeForKids = false;
  bool _ageRestricted = false;
  bool _commentsEnabled = true;
  bool _membersOnly = false;

  double _progress = 0;
  String? _uploadedVideoId;
  String? _errorMessage;
  bool _publishing = false;
  Timer? _pollTimer;
  int _pollAttempts = 0;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _tagController.dispose();
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
        _titleController.text = nameWithoutExt;
        _stage = _Stage.details;
      });
    } catch (e) {
      if (!mounted) return;
      _showSnack("Couldn't open your gallery. Please try again.");
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
    );
  }

  void _addTag(String raw) {
    final tag = raw.trim();
    if (tag.isEmpty || _tags.contains(tag) || _tags.length >= 15) return;
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

    setState(() {
      _publishing = true;
      _errorMessage = null;
      _stage = _Stage.uploading;
      _progress = 0;
    });

    final createResult = await ref.read(uploadServiceProvider).createUpload(
          title: title,
          description: _descriptionController.text.trim(),
          category: _category,
          contentType: _contentType,
          spokenLanguage: _spokenLanguage,
          visibility: _visibility,
          madeForKids: _madeForKids,
          ageRestricted: _ageRestricted,
          commentsEnabled: _commentsEnabled,
          membersOnly: _membersOnly,
          tags: _tags,
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

      final status = await ref.read(uploadServiceProvider).getStatus(videoId);
      if (!mounted) return;

      if (status?.status == 'ready') {
        timer.cancel();
        setState(() => _stage = _Stage.done);
      } else if (status?.status == 'error') {
        timer.cancel();
        setState(() {
          _errorMessage =
              'Your file finished uploading, but processing failed. Please try a different file.';
          _stage = _Stage.error;
        });
      } else if (_pollAttempts >= 100) {
        // ~5 minutes — unusually long, but the upload itself succeeded and
        // the video will keep processing in the background. Let the
        // creator move on instead of staring at a spinner forever; it'll
        // show up in My Videos once Mux finishes.
        timer.cancel();
        setState(() => _stage = _Stage.done);
      }
    });
  }

  void _reset() {
    _pollTimer?.cancel();
    setState(() {
      _file = null;
      _fileSizeBytes = null;
      _titleController.clear();
      _descriptionController.clear();
      _tagController.clear();
      _category = _categories.first;
      _visibility = 'public';
      _spokenLanguage = 'auto';
      _tags.clear();
      _madeForKids = false;
      _ageRestricted = false;
      _commentsEnabled = true;
      _membersOnly = false;
      _progress = 0;
      _uploadedVideoId = null;
      _errorMessage = null;
      _publishing = false;
      _stage = _Stage.picking;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        title: const Text(
          'Upload',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
        leading: _stage == _Stage.details
            ? IconButton(
                icon: const Icon(Icons.close, color: AppColors.textPrimaryDark),
                onPressed: _reset,
              )
            : null,
      ),
      body: SafeArea(child: _buildStage()),
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
      case _Stage.error:
        return _buildError();
    }
  }

  Widget _buildPicking() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.cloud_upload_outlined,
            size: 64,
            color: AppColors.brandOrange.withValues(alpha: 0.5),
          ),
          const SizedBox(height: 16),
          const Text(
            'Upload Content',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: AppColors.textPrimaryDark,
            ),
          ),
          const SizedBox(height: 8),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              'Upload videos and shorts to share with the world',
              style: TextStyle(color: AppColors.textSecondaryDark),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 32),
          ElevatedButton.icon(
            onPressed: () => _pickVideo('video'),
            icon: const Icon(Icons.video_library),
            label: const Text('Upload Video'),
            style: ElevatedButton.styleFrom(minimumSize: const Size(220, 48)),
          ),
          const SizedBox(height: 16),
          ElevatedButton.icon(
            onPressed: () => _pickVideo('short'),
            icon: const Icon(Icons.play_circle),
            label: const Text('Upload Short'),
            style: ElevatedButton.styleFrom(minimumSize: const Size(220, 48)),
          ),
        ],
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
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.cardDark,
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              Icon(
                _contentType == 'short' ? Icons.play_circle : Icons.movie_outlined,
                color: AppColors.brandOrange,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _file?.name ?? '',
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.textPrimaryDark,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      '$sizeLabel • ${_contentType == 'short' ? 'Short' : 'Video'}',
                      style: const TextStyle(
                        color: AppColors.textSecondaryDark,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: AppColors.textSecondaryDark),
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
          ],
          selected: {_contentType},
          onSelectionChanged: (s) => setState(() => _contentType = s.first),
        ),
        const SizedBox(height: 20),
        _label('Title'),
        TextField(
          controller: _titleController,
          maxLength: 100,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: _inputDecoration('Give it a title'),
        ),
        _label('Description'),
        TextField(
          controller: _descriptionController,
          maxLength: 500,
          maxLines: 3,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: _inputDecoration('Tell viewers about it'),
        ),
        _label('Category'),
        DropdownButtonFormField<String>(
          value: _category,
          dropdownColor: AppColors.cardDark,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: _inputDecoration(null),
          items: _categories
              .map((c) => DropdownMenuItem(value: c, child: Text(c, overflow: TextOverflow.ellipsis)))
              .toList(),
          onChanged: (v) => setState(() => _category = v ?? _category),
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
        _label('Spoken Language'),
        DropdownButtonFormField<String>(
          value: _spokenLanguage,
          dropdownColor: AppColors.cardDark,
          style: const TextStyle(color: AppColors.textPrimaryDark),
          decoration: _inputDecoration(null),
          items: _languageOptions
              .map((o) => DropdownMenuItem(value: o.value, child: Text(o.label)))
              .toList(),
          onChanged: (v) => setState(() => _spokenLanguage = v ?? _spokenLanguage),
        ),
        _label('Tags'),
        TextField(
          controller: _tagController,
          style: const TextStyle(color: AppColors.textPrimaryDark),
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
            runSpacing: 8,
            children: _tags
                .map((t) => Chip(
                      label: Text(t),
                      backgroundColor: AppColors.cardDark,
                      labelStyle: const TextStyle(color: AppColors.textPrimaryDark),
                      onDeleted: () => setState(() => _tags.remove(t)),
                    ))
                .toList(),
          ),
        ],
        const SizedBox(height: 12),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeColor: AppColors.brandOrange,
          title: const Text('Made for kids', style: TextStyle(color: AppColors.textPrimaryDark)),
          value: _madeForKids,
          onChanged: (v) => setState(() => _madeForKids = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeColor: AppColors.brandOrange,
          title: const Text('Age restricted', style: TextStyle(color: AppColors.textPrimaryDark)),
          value: _ageRestricted,
          onChanged: (v) => setState(() => _ageRestricted = v),
        ),
        SwitchListTile(
          contentPadding: EdgeInsets.zero,
          activeColor: AppColors.brandOrange,
          title: const Text('Comments enabled', style: TextStyle(color: AppColors.textPrimaryDark)),
          value: _commentsEnabled,
          onChanged: (v) => setState(() => _commentsEnabled = v),
        ),
        if (_contentType == 'video')
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            activeColor: AppColors.brandOrange,
            title: const Text('Members only', style: TextStyle(color: AppColors.textPrimaryDark)),
            subtitle: const Text(
              'Only active paid members can watch',
              style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 12),
            ),
            value: _membersOnly,
            onChanged: (v) => setState(() => _membersOnly = v),
          ),
        const SizedBox(height: 20),
        ElevatedButton(
          onPressed: _publishing ? null : _publish,
          style: ElevatedButton.styleFrom(minimumSize: const Size(double.infinity, 52)),
          child: Text(_publishing ? 'Publishing...' : 'Publish ${_contentType == 'short' ? 'Short' : 'Video'}'),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(top: 16, bottom: 6),
        child: Text(
          text,
          style: const TextStyle(
            color: AppColors.textSecondaryDark,
            fontWeight: FontWeight.w600,
            fontSize: 13,
          ),
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

  Widget _buildUploading() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 88,
            height: 88,
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircularProgressIndicator(
                  value: _progress,
                  strokeWidth: 6,
                  color: AppColors.brandOrange,
                  backgroundColor: Colors.white.withValues(alpha: 0.1),
                ),
                Text(
                  '${(_progress * 100).round()}%',
                  style: const TextStyle(
                    color: AppColors.textPrimaryDark,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Text(
            'Uploading your ${_contentType == 'short' ? 'short' : 'video'}...',
            style: const TextStyle(
              color: AppColors.textPrimaryDark,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'Please keep this screen open.',
            style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildProcessing() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const CircularProgressIndicator(color: AppColors.brandOrange),
          const SizedBox(height: 20),
          const Text(
            'Processing your upload...',
            style: TextStyle(
              color: AppColors.textPrimaryDark,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          const Text(
            'This usually takes under a minute.',
            style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 13),
          ),
        ],
      ),
    );
  }

  Widget _buildDone() {
    final isShort = _contentType == 'short';
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.check_circle, color: AppColors.brandOrange, size: 64),
          const SizedBox(height: 16),
          Text(
            'Your ${isShort ? 'short' : 'video'} is published! 🎉',
            style: const TextStyle(
              color: AppColors.textPrimaryDark,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          const SizedBox(height: 24),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            alignment: WrapAlignment.center,
            children: [
              ElevatedButton(
                onPressed: () {
                  if (isShort) {
                    context.push('/shorts');
                  } else if (_uploadedVideoId != null) {
                    context.push('/watch/$_uploadedVideoId');
                  }
                },
                child: Text(isShort ? 'Watch Shorts' : 'Watch Video'),
              ),
              OutlinedButton(
                onPressed: _reset,
                child: const Text('Upload Another'),
              ),
            ],
          ),
        ],
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
            const Icon(Icons.error_outline, color: AppColors.error, size: 56),
            const SizedBox(height: 16),
            Text(
              _errorMessage ?? 'Something went wrong.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.textSecondaryDark),
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 12,
              alignment: WrapAlignment.center,
              children: [
                ElevatedButton(
                  onPressed: () => setState(() => _stage = _Stage.details),
                  child: const Text('Try Again'),
                ),
                OutlinedButton(
                  onPressed: _reset,
                  child: const Text('Start Over'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
