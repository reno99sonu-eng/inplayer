import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../models/comment.dart';
import '../../../../services/video_interaction_service.dart';

/// Modal bottom sheet allowing users to report an abusive, offensive, or
/// inappropriate comment.
class CommentReportSheet extends ConsumerStatefulWidget {
  final String videoId;
  final Comment comment;

  const CommentReportSheet({
    super.key,
    required this.videoId,
    required this.comment,
  });

  @override
  ConsumerState<CommentReportSheet> createState() => _CommentReportSheetState();
}

class _CommentReportSheetState extends ConsumerState<CommentReportSheet> {
  String? _selectedReason;
  final _detailsController = TextEditingController();
  bool _submitting = false;
  bool _submitted = false;

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _submitReport() async {
    if (_selectedReason == null || _submitting) return;

    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please sign in to report comments.'),
          backgroundColor: AppColors.surfaceDark,
        ),
      );
      return;
    }

    setState(() => _submitting = true);

    final ok = await ref.read(videoInteractionServiceProvider).reportComment(
          videoId: widget.videoId,
          commentId: widget.comment.commentId,
          reason: _selectedReason!,
          details: _detailsController.text.trim(),
        );

    if (!mounted) return;

    setState(() {
      _submitting = false;
      if (ok) _submitted = true;
    });

    if (ok) {
      Future.delayed(const Duration(milliseconds: 1200), () {
        if (mounted) Navigator.of(context).pop();
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Could not submit report. Please try again.'),
          backgroundColor: Colors.redAccent,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      decoration: BoxDecoration(
        color: context.isDark ? AppColors.drawerDark : AppColors.surfaceLight,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: context.borderSubtle),
      ),
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            child: _submitted ? _buildSuccessView() : _buildFormView(),
          ),
        ),
      ),
    );
  }

  Widget _buildSuccessView() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 36),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.check_circle_rounded,
              color: Colors.green,
              size: 48,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Report Submitted',
            style: TextStyle(
              color: context.textPrimary,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Thank you for helping keep our community safe. Our team will review this comment.',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: context.textSecondary,
              fontSize: 13,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Drag Handle
        Center(
          child: Container(
            margin: const EdgeInsets.only(bottom: 12),
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: context.textDim.withValues(alpha: 0.3),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),

        // Header
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                const Icon(
                  Icons.flag_rounded,
                  color: Colors.redAccent,
                  size: 22,
                ),
                const SizedBox(width: 8),
                Text(
                  'Report Comment',
                  style: TextStyle(
                    color: context.textPrimary,
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            IconButton(
              icon: Icon(
                Icons.close,
                color: context.textSecondary,
                size: 20,
              ),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),

        // Comment snippet
        Container(
          width: double.infinity,
          margin: const EdgeInsets.symmetric(vertical: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: context.isDark
                ? Colors.white.withValues(alpha: 0.05)
                : Colors.black.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: context.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '@${widget.comment.userName}',
                style: const TextStyle(
                  color: AppColors.brandOrange,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                widget.comment.text,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: context.textSecondary,
                  fontSize: 12.5,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ],
          ),
        ),

        Text(
          'Why are you reporting this comment?',
          style: TextStyle(
            color: context.textPrimary,
            fontSize: 13.5,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),

        // Reasons List
        RadioGroup<String>(
          groupValue: _selectedReason,
          onChanged: (val) => setState(() => _selectedReason = val),
          child: Column(
            children: [
              for (final reason in kReportReasons)
                InkWell(
                  onTap: () => setState(() => _selectedReason = reason['value']),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 4),
                    child: Row(
                      children: [
                        Radio<String>(
                          value: reason['value']!,
                          activeColor: AppColors.brandOrange,
                          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          visualDensity: VisualDensity.compact,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            reason['label']!,
                            style: TextStyle(
                              color: _selectedReason == reason['value']
                                  ? context.textPrimary
                                  : context.textSecondary,
                              fontSize: 13.5,
                              fontWeight: _selectedReason == reason['value']
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),

        const SizedBox(height: 12),

        // Additional Details Field
        TextField(
          controller: _detailsController,
          maxLines: 2,
          style: TextStyle(color: context.textPrimary, fontSize: 13),
          decoration: InputDecoration(
            hintText: 'Additional details (optional)',
            hintStyle: TextStyle(color: context.textDim, fontSize: 12.5),
            contentPadding: const EdgeInsets.all(12),
            filled: true,
            fillColor: context.isDark
                ? Colors.white.withValues(alpha: 0.04)
                : Colors.black.withValues(alpha: 0.02),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: context.borderSubtle),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: BorderSide(color: context.borderSubtle),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(10),
              borderSide: const BorderSide(color: AppColors.brandOrange),
            ),
          ),
        ),

        const SizedBox(height: 16),

        // Submit Button
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: (_selectedReason == null || _submitting)
                ? null
                : _submitReport,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              disabledBackgroundColor: Colors.redAccent.withValues(alpha: 0.3),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 13),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: _submitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: Colors.white,
                    ),
                  )
                : const Text(
                    'Submit Report',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
          ),
        ),
      ],
    );
  }
}

/// Helper function to display the comment report modal sheet
Future<void> showCommentReportSheet(
  BuildContext context, {
  required String videoId,
  required Comment comment,
}) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (ctx) => CommentReportSheet(
      videoId: videoId,
      comment: comment,
    ),
  );
}
