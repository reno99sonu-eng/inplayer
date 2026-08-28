import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../services/ai_assist_service.dart';

/// A deliberately bounded dialog for the lightweight home-screen AI helper.
///
/// This is not an [AlertDialog]: the app supports a narrow mobile layout and
/// a full prompt/result view. Giving it an explicit height means the scroll
/// region is always laid out with finite constraints, which avoids the
/// framework's repeated semantics/layout failure that the old intrinsic
/// `Center > Column > Flexible > Wrap` tree could trigger on newer Flutter.
class AIStudioModal extends ConsumerStatefulWidget {
  const AIStudioModal({super.key});

  @override
  ConsumerState<AIStudioModal> createState() => _AIStudioModalState();
}

class _AIStudioModalState extends ConsumerState<AIStudioModal> {
  final TextEditingController _promptController = TextEditingController();
  bool _isLoading = false;
  String? _response;
  String? _error;
  String? _selectedCategory;

  static const _quickPrompts = <String>[
    'Generate a viral title for a gaming video',
    'Write a catchy description for a music track',
    'Suggest trending tags for a comedy Short',
    'Recommend topics for a tech review',
  ];

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _generate([String? prompt]) async {
    final query = (prompt ?? _promptController.text).trim();
    if (query.isEmpty || _isLoading) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _isLoading = true;
      _response = null;
      _error = null;
    });

    try {
      final context = AIPromptContext(
        title: query,
        description: '',
        category: _selectedCategory ?? 'Entertainment',
        contentType: 'video',
        userDescription: query,
      );
      final titles = await ref
          .read(aiAssistServiceProvider)
          .suggestTitles(context);

      if (!mounted) return;
      setState(() {
        _response = titles.map((title) => '\u2022 $title').join('\n\n');
        _isLoading = false;
      });
    } on AIAssistException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _isLoading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not reach InPlayer AI. Please try again.';
        _isLoading = false;
      });
    }
  }

  void _useQuickPrompt(String prompt) {
    _promptController
      ..text = prompt
      ..selection = TextSelection.collapsed(offset: prompt.length);
    _generate(prompt);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    final screen = MediaQuery.sizeOf(context);
    final dialogHeight = math.min(600.0, math.max(360.0, screen.height * .72));
    final dialogWidth = math.min(440.0, screen.width - 32.0);
    final surface = isDark ? const Color(0xFF0F172A) : AppColors.surfaceLight;
    final inputSurface = isDark ? const Color(0xFF172033) : Colors.white;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Align(
          alignment: Alignment.center,
          child: SizedBox(
            width: dialogWidth,
            height: dialogHeight,
            child: Material(
              color: surface,
              clipBehavior: Clip.antiAlias,
              borderRadius: BorderRadius.circular(24),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(
                    color: isDark
                        ? AppColors.brandOrange.withValues(alpha: .30)
                        : const Color(0xFFE2D9C8),
                    width: 1.25,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: isDark ? .52 : .18),
                      blurRadius: 30,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    _buildHeader(context),
                    Divider(height: 1, color: context.borderSubtle),
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.all(18),
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        children: [
                          Text(
                            'START WITH A PROMPT',
                            style: TextStyle(
                              color: context.textMuted,
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 1.2,
                            ),
                          ),
                          const SizedBox(height: 10),
                          for (final prompt in _quickPrompts)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: OutlinedButton(
                                onPressed: _isLoading
                                    ? null
                                    : () => _useQuickPrompt(prompt),
                                style: OutlinedButton.styleFrom(
                                  alignment: Alignment.centerLeft,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 14,
                                    vertical: 12,
                                  ),
                                  side: BorderSide(color: context.borderSubtle),
                                  foregroundColor: context.textSecondary,
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                ),
                                child: Text(
                                  prompt,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ),
                          const SizedBox(height: 10),
                          TextField(
                            controller: _promptController,
                            minLines: 2,
                            maxLines: 4,
                            textInputAction: TextInputAction.done,
                            onSubmitted: (_) => _generate(),
                            style: TextStyle(
                              color: context.textPrimary,
                              fontSize: 14,
                            ),
                            decoration: InputDecoration(
                              hintText: 'Ask AI or enter a video idea\u2026',
                              hintStyle: TextStyle(
                                color: context.textDim,
                                fontSize: 13,
                              ),
                              filled: true,
                              fillColor: inputSurface,
                              contentPadding: const EdgeInsets.all(14),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(
                                  color: context.borderSubtle,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: BorderSide(
                                  color: context.borderSubtle,
                                ),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(
                                  color: AppColors.brandOrange,
                                  width: 1.4,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: _isLoading ? null : _generate,
                              icon: _isLoading
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Icon(Icons.auto_awesome_rounded),
                              label: Text(
                                _isLoading
                                    ? 'Generating\u2026'
                                    : 'Generate ideas',
                              ),
                            ),
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 16),
                            _buildMessage(
                              context,
                              text: _error!,
                              color: AppColors.error,
                              icon: Icons.error_outline_rounded,
                            ),
                          ],
                          if (_response != null) ...[
                            const SizedBox(height: 16),
                            _buildMessage(
                              context,
                              text: _response!,
                              color: AppColors.brandOrange,
                              icon: Icons.auto_awesome_rounded,
                              selectable: true,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 10, 12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.brandOrange.withValues(alpha: .15),
            ),
            child: const Icon(
              Icons.auto_awesome_rounded,
              color: AppColors.brandOrange,
              size: 20,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'InPlayer AI Studio',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: context.textPrimary,
                  ),
                ),
                Text(
                  'Smart titles, hooks and content ideas',
                  style: TextStyle(fontSize: 11, color: context.textSecondary),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Close InPlayer AI',
            icon: Icon(
              Icons.close_rounded,
              color: context.textSecondary,
              size: 22,
            ),
            onPressed: () => Navigator.of(context, rootNavigator: true).pop(),
          ),
        ],
      ),
    );
  }

  Widget _buildMessage(
    BuildContext context, {
    required String text,
    required Color color,
    required IconData icon,
    bool selectable = false,
  }) {
    final content = Text(
      text,
      style: TextStyle(fontSize: 13, color: context.textPrimary, height: 1.55),
    );
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: .28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: selectable
                ? SelectableText(
                    text,
                    style: TextStyle(
                      fontSize: 13,
                      color: context.textPrimary,
                      height: 1.55,
                    ),
                  )
                : content,
          ),
        ],
      ),
    );
  }
}
