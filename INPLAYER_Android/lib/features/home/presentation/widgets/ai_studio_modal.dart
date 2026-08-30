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
  final List<String> _categories = const [
    'Entertainment',
    'Gaming',
    'Music',
    'Comedy',
    'Tech',
    'Lifestyle',
  ];
  bool _isLoading = false;
  String? _response;
  String? _error;
  String _selectedCategory = 'Entertainment';

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
      final promptContext = AIPromptContext(
        title: query,
        description: '',
        category: _selectedCategory,
        contentType: 'video',
        userDescription: query,
      );
      final titles = await ref
          .read(aiAssistServiceProvider)
          .suggestTitles(promptContext);

      if (!mounted) return;
      setState(() {
        _response = titles.take(5).map((title) => title).toList().join('\n');
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
    final dialogHeight = math.min(620.0, math.max(420.0, screen.height * .78));
    final dialogWidth = math.min(460.0, screen.width - 24.0);
    final surface = isDark ? const Color(0xFF0F172A) : AppColors.surfaceLight;
    final inputSurface = isDark ? const Color(0xFF172033) : const Color(0xFFFFFFFF);
    final softSurface = isDark ? const Color(0xFF111B2E) : const Color(0xFFF8FAFC);

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Center(
          child: SizedBox(
            width: dialogWidth,
            height: dialogHeight,
            child: Material(
              color: surface,
              clipBehavior: Clip.antiAlias,
              borderRadius: BorderRadius.circular(28),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(
                    color: isDark
                        ? AppColors.brandOrange.withValues(alpha: .30)
                        : const Color(0xFFE7D9C8),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: isDark ? .55 : .18),
                      blurRadius: 32,
                      offset: const Offset(0, 12),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    _buildHeader(context),
                    Divider(height: 1, color: context.borderSubtle),
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.fromLTRB(18, 16, 18, 18),
                        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: softSurface,
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(color: context.borderSubtle),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'CONTENT TYPE',
                                    style: TextStyle(
                                      color: context.textMuted,
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 1.2,
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: _categories.map((category) {
                                      final selected = category == _selectedCategory;
                                      return ChoiceChip(
                                        label: Text(category),
                                        selected: selected,
                                        onSelected: _isLoading ? null : (_) => setState(() => _selectedCategory = category),
                                        selectedColor: AppColors.brandOrange,
                                        backgroundColor: isDark ? const Color(0xFF18263D) : const Color(0xFFE2E8F0),
                                        labelStyle: TextStyle(
                                          color: selected ? Colors.white : context.textPrimary,
                                          fontWeight: FontWeight.w700,
                                          fontSize: 12,
                                        ),
                                        side: BorderSide(color: selected ? AppColors.brandOrange : context.borderSubtle),
                                      );
                                    }).toList(),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
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
                                child: Material(
                                  color: Colors.transparent,
                                  child: InkWell(
                                    onTap: _isLoading ? null : () => _useQuickPrompt(prompt),
                                    borderRadius: BorderRadius.circular(14),
                                    child: Ink(
                                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                      decoration: BoxDecoration(
                                        color: softSurface,
                                        borderRadius: BorderRadius.circular(14),
                                        border: Border.all(color: context.borderSubtle),
                                      ),
                                      child: Text(
                                        prompt,
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: context.textPrimary,
                                        ),
                                      ),
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
                                hintText: 'Ask AI for titles, hooks, or video ideas…',
                                hintStyle: TextStyle(
                                  color: context.textDim,
                                  fontSize: 13,
                                ),
                                filled: true,
                                fillColor: inputSurface,
                                contentPadding: const EdgeInsets.all(14),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: BorderSide(color: context.borderSubtle),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: BorderSide(color: context.borderSubtle),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(14),
                                  borderSide: const BorderSide(color: AppColors.brandOrange, width: 1.4),
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton.icon(
                                onPressed: _isLoading ? null : _generate,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.brandOrange,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  padding: const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                ),
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
                                  _isLoading ? 'Generating…' : 'Generate ideas',
                                  style: const TextStyle(fontWeight: FontWeight.w800),
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
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.brandOrange.withValues(alpha: .08),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(color: AppColors.brandOrange.withValues(alpha: .25)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(Icons.auto_awesome_rounded, size: 18, color: AppColors.brandOrange),
                                        const SizedBox(width: 8),
                                        Text(
                                          'AI suggestions',
                                          style: TextStyle(
                                            color: context.textPrimary,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 14,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 10),
                                    ..._response!
                                        .split('\n')
                                        .where((line) => line.trim().isNotEmpty)
                                        .map((line) => Padding(
                                              padding: const EdgeInsets.only(bottom: 8),
                                              child: Row(
                                                crossAxisAlignment: CrossAxisAlignment.start,
                                                children: [
                                                  Container(
                                                    width: 6,
                                                    height: 6,
                                                    margin: const EdgeInsets.only(top: 7, right: 10),
                                                    decoration: const BoxDecoration(
                                                      color: AppColors.brandOrange,
                                                      shape: BoxShape.circle,
                                                    ),
                                                  ),
                                                  Expanded(
                                                    child: Text(
                                                      line.trim(),
                                                      style: TextStyle(
                                                        color: context.textPrimary,
                                                        fontSize: 13,
                                                        height: 1.5,
                                                      ),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            )),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
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
