import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../services/ai_assist_service.dart';

/// One completed generation. Kept as a list so the results panel can hold a
/// running session — ask again without leaving it, and every answer stays
/// visible above the new one with the time it was produced.
class _AiGeneration {
  final String prompt;
  final String category;
  final List<String> lines;
  final DateTime at;

  const _AiGeneration({
    required this.prompt,
    required this.category,
    required this.lines,
    required this.at,
  });
}

/// A deliberately bounded dialog for the lightweight home-screen AI helper.
///
/// This is not an [AlertDialog]: the app supports a narrow mobile layout and
/// a full prompt/result view. Giving it an explicit height means the scroll
/// region is always laid out with finite constraints, which avoids the
/// framework's repeated semantics/layout failure that the old intrinsic
/// `Center > Column > Flexible > Wrap` tree could trigger on newer Flutter.
///
/// Two panels rather than one long column. Previously the prompt form and
/// the answer lived in the same scroll view, with the answer appended at the
/// bottom — so generating anything pushed the result below the fold and you
/// had to scroll down to read what you had just asked for. Now the compose
/// panel is short enough to fit without scrolling, and generating switches to
/// a results panel that opens at the answer.
class AIStudioModal extends ConsumerStatefulWidget {
  const AIStudioModal({super.key});

  @override
  ConsumerState<AIStudioModal> createState() => _AIStudioModalState();
}

enum _AiView { compose, results }

class _AIStudioModalState extends ConsumerState<AIStudioModal> {
  final TextEditingController _promptController = TextEditingController();
  final TextEditingController _followUpController = TextEditingController();
  final FocusNode _promptFocus = FocusNode();
  final ScrollController _resultsScroll = ScrollController();

  static const List<String> _categories = [
    'Entertainment',
    'Gaming',
    'Music',
    'Comedy',
    'Tech',
    'Lifestyle',
  ];

  static const _quickPrompts = <String>[
    'Viral title for a gaming video',
    'Catchy music track description',
    'Trending tags for a comedy Short',
    'Topics for a tech review',
  ];

  final List<_AiGeneration> _generations = [];
  _AiView _view = _AiView.compose;
  bool _isLoading = false;
  String? _error;
  String _selectedCategory = 'Entertainment';

  @override
  void dispose() {
    _promptController.dispose();
    _followUpController.dispose();
    _promptFocus.dispose();
    _resultsScroll.dispose();
    super.dispose();
  }

  // ── Generation ────────────────────────────────────────────────────────

  Future<void> _generate(String rawPrompt) async {
    final query = rawPrompt.trim();
    if (query.isEmpty || _isLoading) return;

    FocusScope.of(context).unfocus();
    setState(() {
      _isLoading = true;
      _error = null;
      // Switch immediately so the spinner is on the panel the answer will
      // land in, rather than leaving the user on the form wondering.
      _view = _AiView.results;
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
      final lines = titles
          .take(5)
          .map((t) => t.trim())
          .where((t) => t.isNotEmpty)
          .toList();

      setState(() {
        _generations.add(_AiGeneration(
          prompt: query,
          category: _selectedCategory,
          lines: lines,
          at: DateTime.now(),
        ));
        _isLoading = false;
        _followUpController.clear();
      });
      _scrollResultsToEnd();
    } on AIAssistException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _isLoading = false;
        // Nothing to show on the results panel yet — send them back to the
        // form so the failed prompt is still in front of them to retry.
        if (_generations.isEmpty) _view = _AiView.compose;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Could not reach InPlayer AI. Please try again.';
        _isLoading = false;
        if (_generations.isEmpty) _view = _AiView.compose;
      });
    }
  }

  void _scrollResultsToEnd() {
    // After the frame the new card has been laid out, so maxScrollExtent is
    // finally the real one.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_resultsScroll.hasClients) return;
      _resultsScroll.animateTo(
        _resultsScroll.position.maxScrollExtent,
        duration: const Duration(milliseconds: 260),
        curve: Curves.easeOut,
      );
    });
  }

  void _useQuickPrompt(String prompt) {
    _promptController
      ..text = prompt
      ..selection = TextSelection.collapsed(offset: prompt.length);
    _generate(prompt);
  }

  /// Back to the form with the last prompt loaded and the caret in it, so
  /// "not quite right" is one edit away rather than a retype.
  void _editLastPrompt() {
    final last = _generations.isNotEmpty
        ? _generations.last.prompt
        : _promptController.text;
    _promptController
      ..text = last
      ..selection = TextSelection.collapsed(offset: last.length);
    setState(() {
      _view = _AiView.compose;
      _error = null;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _promptFocus.requestFocus();
    });
  }

  Future<void> _copy(String text) async {
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      const SnackBar(content: Text('Copied'), duration: Duration(seconds: 1)),
    );
  }

  static String _timeLabel(DateTime t) {
    final diff = DateTime.now().difference(t);
    if (diff.inSeconds < 45) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    final hour12 = t.hour % 12 == 0 ? 12 : t.hour % 12;
    final minute = t.minute.toString().padLeft(2, '0');
    return '$hour12:$minute ${t.hour >= 12 ? 'PM' : 'AM'}';
  }

  // ── Shell ─────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    final media = MediaQuery.of(context);
    final screen = media.size;
    final availableHeight = screen.height - media.viewInsets.bottom - 32;
    final results = _view == _AiView.results;

    // The compose panel is sized to what it actually contains; only the
    // results panel needs the taller box.
    final maxHeight = results
        ? math.min(620.0, math.max(400.0, availableHeight * .88))
        : math.min(500.0, math.max(340.0, availableHeight * .88));
    final dialogWidth = math.min(460.0, screen.width - 24.0);
    final surface = isDark ? const Color(0xFF0F172A) : AppColors.surfaceLight;

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Center(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOutCubic,
            width: dialogWidth,
            height: maxHeight,
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
                child: results ? _buildResultsPanel() : _buildComposePanel(),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Panel 1: compose ──────────────────────────────────────────────────

  Widget _buildComposePanel() {
    final isDark = context.isDark;
    final inputSurface =
        isDark ? const Color(0xFF172033) : const Color(0xFFFFFFFF);

    return Column(
      children: [
        _buildHeader(
          title: 'InPlayer AI',
          subtitle: 'Smart titles, hooks and content ideas',
          leading: null,
          trailing: _generations.isEmpty
              ? null
              : IconButton(
                  tooltip: 'Back to results',
                  icon: Icon(Icons.history_rounded,
                      color: context.textSecondary, size: 21),
                  onPressed: () => setState(() => _view = _AiView.results),
                ),
        ),
        Divider(height: 1, color: context.borderSubtle),
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.fromLTRB(
              18,
              14,
              18,
              14 + MediaQuery.viewInsetsOf(context).bottom,
            ),
            keyboardDismissBehavior:
                ScrollViewKeyboardDismissBehavior.onDrag,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _miniLabel('CONTENT TYPE'),
                const SizedBox(height: 8),
                // One scrolling row instead of a wrapping block — six chips
                // wrapped to three rows was most of the height that pushed
                // everything else off-screen.
                SizedBox(
                  height: 34,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _categories.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (context, i) {
                      final category = _categories[i];
                      final selected = category == _selectedCategory;
                      return _pill(
                        label: category,
                        selected: selected,
                        onTap: _isLoading
                            ? null
                            : () =>
                                setState(() => _selectedCategory = category),
                      );
                    },
                  ),
                ),
                const SizedBox(height: 14),
                _miniLabel('QUICK START'),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final prompt in _quickPrompts)
                      _pill(
                        label: prompt,
                        selected: false,
                        onTap:
                            _isLoading ? null : () => _useQuickPrompt(prompt),
                      ),
                  ],
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: _promptController,
                  focusNode: _promptFocus,
                  minLines: 2,
                  maxLines: 3,
                  textInputAction: TextInputAction.done,
                  onSubmitted: (v) => _generate(v),
                  style: TextStyle(color: context.textPrimary, fontSize: 14),
                  decoration: _inputDecoration(
                    hint: 'Ask AI for titles, hooks, or video ideas…',
                    fill: inputSurface,
                  ),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  _buildMessage(
                    text: _error!,
                    color: AppColors.error,
                    icon: Icons.error_outline_rounded,
                  ),
                ],
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _isLoading
                        ? null
                        : () => _generate(_promptController.text),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.brandOrange,
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    icon: const Icon(Icons.auto_awesome_rounded, size: 19),
                    label: const Text(
                      'Generate ideas',
                      style: TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ── Panel 2: results ──────────────────────────────────────────────────

  Widget _buildResultsPanel() {
    final isDark = context.isDark;
    final inputSurface =
        isDark ? const Color(0xFF172033) : const Color(0xFFFFFFFF);

    return Column(
      children: [
        _buildHeader(
          title: 'Results',
          subtitle: _generations.isEmpty
              ? 'Working on it…'
              : '${_generations.length} generation'
                  '${_generations.length == 1 ? '' : 's'} this session',
          leading: IconButton(
            tooltip: 'Back',
            icon: Icon(Icons.arrow_back_rounded,
                color: context.textSecondary, size: 22),
            onPressed: () => setState(() => _view = _AiView.compose),
          ),
          trailing: IconButton(
            tooltip: 'Edit prompt',
            icon: Icon(Icons.edit_outlined,
                color: context.textSecondary, size: 20),
            onPressed: _isLoading ? null : _editLastPrompt,
          ),
        ),
        Divider(height: 1, color: context.borderSubtle),
        Expanded(
          child: ListView(
            controller: _resultsScroll,
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [
              for (final generation in _generations) ...[
                _buildGenerationCard(generation),
                const SizedBox(height: 12),
              ],
              if (_isLoading) _buildLoadingCard(),
              if (_error != null) ...[
                _buildMessage(
                  text: _error!,
                  color: AppColors.error,
                  icon: Icons.error_outline_rounded,
                ),
              ],
            ],
          ),
        ),
        Divider(height: 1, color: context.borderSubtle),
        // Ask again without leaving the answers.
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: TextField(
                  controller: _followUpController,
                  minLines: 1,
                  maxLines: 3,
                  textInputAction: TextInputAction.send,
                  onSubmitted: (v) => _generate(v),
                  style: TextStyle(color: context.textPrimary, fontSize: 13.5),
                  decoration: _inputDecoration(
                    hint: 'Ask for more…',
                    fill: inputSurface,
                    dense: true,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 46,
                height: 46,
                child: Material(
                  color: _isLoading
                      ? AppColors.brandOrange.withValues(alpha: .45)
                      : AppColors.brandOrange,
                  borderRadius: BorderRadius.circular(14),
                  clipBehavior: Clip.antiAlias,
                  child: InkWell(
                    onTap: _isLoading
                        ? null
                        : () => _generate(_followUpController.text),
                    child: Center(
                      child: _isLoading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.arrow_upward_rounded,
                              color: Colors.white, size: 20),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildGenerationCard(_AiGeneration generation) {
    return Container(
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
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.auto_awesome_rounded,
                  size: 16, color: AppColors.brandOrange),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  generation.prompt,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: context.textPrimary,
                    fontWeight: FontWeight.w800,
                    fontSize: 13,
                    height: 1.35,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Padding(
            padding: const EdgeInsets.only(left: 24),
            child: Text(
              '${generation.category} · ${_timeLabel(generation.at)}',
              style: TextStyle(color: context.textMuted, fontSize: 10.5),
            ),
          ),
          const SizedBox(height: 10),
          if (generation.lines.isEmpty)
            Text(
              'No suggestions came back for that one. Try rewording it.',
              style: TextStyle(color: context.textSecondary, fontSize: 12.5),
            )
          else
            for (final line in generation.lines)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: InkWell(
                  onTap: () => _copy(line),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 2),
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
                            line,
                            style: TextStyle(
                              color: context.textPrimary,
                              fontSize: 13,
                              height: 1.5,
                            ),
                          ),
                        ),
                        Icon(Icons.copy_rounded,
                            size: 13, color: context.textMuted),
                      ],
                    ),
                  ),
                ),
              ),
        ],
      ),
    );
  }

  Widget _buildLoadingCard() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 16),
      decoration: BoxDecoration(
        color: context.bgCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: context.borderSubtle),
      ),
      child: Row(
        children: [
          const SizedBox(
            width: 16,
            height: 16,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: AppColors.brandOrange,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            'Generating…',
            style: TextStyle(color: context.textSecondary, fontSize: 13),
          ),
        ],
      ),
    );
  }

  // ── Shared bits ───────────────────────────────────────────────────────

  Widget _buildHeader({
    required String title,
    required String subtitle,
    Widget? leading,
    Widget? trailing,
  }) {
    return Padding(
      padding: EdgeInsets.fromLTRB(leading == null ? 20 : 6, 12, 6, 10),
      child: Row(
        children: [
          if (leading != null)
            leading
          else
            Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.brandOrange.withValues(alpha: .15),
              ),
              child: const Icon(
                Icons.auto_awesome_rounded,
                color: AppColors.brandOrange,
                size: 18,
              ),
            ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 15.5,
                    fontWeight: FontWeight.w800,
                    color: context.textPrimary,
                  ),
                ),
                Text(
                  subtitle,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style:
                      TextStyle(fontSize: 10.5, color: context.textSecondary),
                ),
              ],
            ),
          ),
          ?trailing,
          IconButton(
            tooltip: 'Close InPlayer AI',
            icon: Icon(Icons.close_rounded,
                color: context.textSecondary, size: 21),
            onPressed: () =>
                Navigator.of(context, rootNavigator: true).pop(),
          ),
        ],
      ),
    );
  }

  Widget _miniLabel(String text) => Text(
        text,
        style: TextStyle(
          color: context.textMuted,
          fontSize: 9.5,
          fontWeight: FontWeight.w800,
          letterSpacing: 1.2,
        ),
      );

  Widget _pill({
    required String label,
    required bool selected,
    VoidCallback? onTap,
  }) {
    final isDark = context.isDark;
    return Material(
      color: selected
          ? AppColors.brandOrange
          : (isDark ? const Color(0xFF18263D) : const Color(0xFFE2E8F0)),
      borderRadius: BorderRadius.circular(999),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: selected ? AppColors.brandOrange : context.borderSubtle,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? Colors.white : context.textPrimary,
              fontWeight: FontWeight.w700,
              fontSize: 11.5,
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String hint,
    required Color fill,
    bool dense = false,
  }) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(color: context.textDim, fontSize: 12.5),
      filled: true,
      fillColor: fill,
      isDense: dense,
      contentPadding: EdgeInsets.all(dense ? 12 : 13),
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
    );
  }

  Widget _buildMessage({
    required String text,
    required Color color,
    required IconData icon,
  }) {
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: .28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 17),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 12.5,
                color: context.textPrimary,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
