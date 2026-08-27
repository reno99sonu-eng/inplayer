import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../services/ai_assist_service.dart';

/// The app's counterpart to the website's `AITitleAssistModal.tsx`.
///
/// The important part is not the sheet, it's the question it asks. The model
/// cannot watch the uploaded file — before the website added this step its
/// only signals were the raw filename and the picked category, which is
/// exactly why "Generate AI Title" produced near-random results. Asking the
/// creator what the video is actually about, and feeding that in as
/// `userDescription`, is what fixed it. The app asks the same question and
/// sends the same prompt (see AIAssistService.buildPrompt), so the two
/// surfaces cannot drift into suggesting differently.
///
/// Returns the picked title, or null if dismissed.
Future<String?> showAITitleAssistSheet(
  BuildContext context, {
  required AIPromptContext Function(String userDescription) buildContext,
  String initialDescription = '',
}) {
  return showModalBottomSheet<String>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _AITitleAssistSheet(
      buildContext: buildContext,
      initialDescription: initialDescription,
    ),
  );
}

class _AITitleAssistSheet extends ConsumerStatefulWidget {
  final AIPromptContext Function(String userDescription) buildContext;
  final String initialDescription;

  const _AITitleAssistSheet({
    required this.buildContext,
    required this.initialDescription,
  });

  @override
  ConsumerState<_AITitleAssistSheet> createState() => _AITitleAssistSheetState();
}

class _AITitleAssistSheetState extends ConsumerState<_AITitleAssistSheet> {
  late final TextEditingController _ctrl =
      TextEditingController(text: widget.initialDescription);

  bool _generating = false;
  String? _error;
  List<String> _suggestions = const [];

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _generate() async {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _generating) return;

    setState(() {
      _generating = true;
      _error = null;
    });

    try {
      final results = await ref
          .read(aiAssistServiceProvider)
          .suggestTitles(widget.buildContext(text));
      if (!mounted) return;
      setState(() {
        _suggestions = results;
        _generating = false;
      });
    } on AIAssistException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _generating = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    // Padding for the keyboard — this sheet is text-entry first, and without
    // it the Generate button sits under the keyboard on most phones.
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.88,
        ),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF08111F) : const Color(0xFFF5EEDC),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.25)),
        ),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: context.textSecondary.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.brandOrange.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(Icons.auto_awesome_rounded,
                        color: AppColors.brandOrangeLight, size: 20),
                  ),
                  const Spacer(),
                  IconButton(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: Icon(Icons.close_rounded, color: context.textSecondary),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                'Generate a title with AI',
                style: TextStyle(
                  color: context.textPrimary,
                  fontSize: 20,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                "The AI can't watch your video, so tell it what happens in a "
                'sentence or two — the more specific you are, the better the '
                'title options.',
                style: TextStyle(
                  color: context.textSecondary,
                  fontSize: 13,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _ctrl,
                maxLines: 3,
                minLines: 3,
                textCapitalization: TextCapitalization.sentences,
                style: TextStyle(color: context.textPrimary, fontSize: 14),
                decoration: InputDecoration(
                  hintText:
                      'e.g. A 3-minute tutorial showing how to fix a leaking '
                      'kitchen tap with basic tools',
                  hintStyle: TextStyle(
                    color: context.textSecondary.withValues(alpha: 0.7),
                    fontSize: 13,
                  ),
                  filled: true,
                  fillColor: context.textPrimary.withValues(alpha: 0.03),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: context.borderSubtle),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: context.borderSubtle),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(
                      color: AppColors.brandOrange.withValues(alpha: 0.5),
                    ),
                  ),
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed:
                      _generating || _ctrl.text.trim().isEmpty ? null : _generate,
                  icon: _generating
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.black87),
                        )
                      : const Icon(Icons.auto_awesome_rounded, size: 16),
                  label: Text(
                    _generating ? 'Generating titles...' : 'Generate titles',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.brandOrange,
                    foregroundColor: Colors.black87,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                ),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(
                  _error!,
                  style: const TextStyle(color: Color(0xFFF87171), fontSize: 12),
                ),
              ],
              if (_suggestions.isNotEmpty) ...[
                const SizedBox(height: 18),
                Text(
                  'PICK ONE',
                  style: TextStyle(
                    color: context.textSecondary,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.6,
                  ),
                ),
                const SizedBox(height: 8),
                // The five come back in a fixed tone order (clickbait,
                // playful, dramatic, understated, question) — see the prompt
                // in AIAssistService. They are deliberately NOT relabelled
                // here; the website shows them unlabelled too, so the
                // creator judges them on how they read rather than on which
                // bucket they came from.
                ..._suggestions.map(
                  (s) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => Navigator.of(context).pop(s),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 14),
                        decoration: BoxDecoration(
                          color: context.textPrimary.withValues(alpha: 0.02),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: context.borderSubtle),
                        ),
                        child: Text(
                          s,
                          style: TextStyle(
                            color: context.textPrimary,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
