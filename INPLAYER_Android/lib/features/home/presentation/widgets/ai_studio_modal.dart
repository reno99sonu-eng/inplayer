import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../services/ai_assist_service.dart';

class AIStudioModal extends ConsumerStatefulWidget {
  const AIStudioModal({super.key});

  @override
  ConsumerState<AIStudioModal> createState() => _AIStudioModalState();
}

class _AIStudioModalState extends ConsumerState<AIStudioModal> {
  final TextEditingController _promptController = TextEditingController();
  bool _isLoading = false;
  String? _response;
  String? _selectedCategory;

  final List<String> _quickPrompts = [
    'Generate viral title for gaming video',
    'Write catchy description for music track',
    'Suggest trending tags for comedy Short',
    'Recommend topics for tech review',
  ];

  @override
  void dispose() {
    _promptController.dispose();
    super.dispose();
  }

  Future<void> _generate(String query) async {
    if (query.trim().isEmpty) return;
    setState(() {
      _isLoading = true;
      _response = null;
    });

    try {
      final aiService = AIAssistService();
      final ctx = AIPromptContext(
        title: query,
        description: '',
        category: _selectedCategory ?? 'Entertainment',
        contentType: 'video',
        userDescription: query,
      );

      final titles = await aiService.suggestTitles(ctx);
      if (mounted) {
        setState(() {
          _isLoading = false;
          if (titles.isNotEmpty) {
            _response = titles.map((t) => '• $t').join('\n\n');
          } else {
            _response = 'Here are creative ideas for your prompt:\n\n1. Behind the scenes exploration\n2. Top 5 highlights & reactions\n3. Deep dive & ultimate guide';
          }
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _response = 'Creative suggestions:\n\n• Ultimate Guide: \n• The Truth About \n• 5 Things You Did not Know';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    final bgSurface = isDark ? const Color(0xFF0F172A) : const Color(0xFFFAF6EE);
    final cardBg = isDark ? const Color(0xFF1E293B) : Colors.white;

    return Center(
      child: Material(
        color: Colors.transparent,
        child: Container(
          width: MediaQuery.of(context).size.width * 0.92,
          constraints: const BoxConstraints(maxHeight: 580, maxWidth: 440),
          decoration: BoxDecoration(
            color: bgSurface,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: isDark ? AppColors.brandOrange.withValues(alpha: 0.3) : const Color(0xFFE2D9C8),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: isDark ? Colors.black.withValues(alpha: 0.5) : const Color(0x22000000),
                blurRadius: 30,
                offset: const Offset(0, 10),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 18, 16, 12),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.brandOrange.withValues(alpha: 0.15),
                      ),
                      child: const Icon(Icons.auto_awesome_rounded, color: AppColors.brandOrange, size: 20),
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
                            'Smart titles, hooks & content ideas',
                            style: TextStyle(
                              fontSize: 11,
                              color: context.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.close_rounded, color: context.textSecondary, size: 22),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),
              Divider(height: 1, color: context.borderSubtle),
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.all(18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _quickPrompts.map((p) {
                          return InkWell(
                            borderRadius: BorderRadius.circular(16),
                            onTap: () {
                              _promptController.text = p;
                              _generate(p);
                            },
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                color: cardBg,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: context.borderSubtle),
                              ),
                              child: Text(
                                p,
                                style: TextStyle(fontSize: 11, color: context.textSecondary, fontWeight: FontWeight.w600),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _promptController,
                              style: TextStyle(color: context.textPrimary, fontSize: 13),
                              decoration: InputDecoration(
                                hintText: 'Ask AI or enter video idea...',
                                hintStyle: TextStyle(color: context.textDim, fontSize: 13),
                                filled: true,
                                fillColor: cardBg,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
                                  borderSide: const BorderSide(color: AppColors.brandOrange),
                                ),
                              ),
                              onSubmitted: _generate,
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.brandOrange,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            ),
                            onPressed: _isLoading ? null : () => _generate(_promptController.text),
                            child: _isLoading
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                  )
                                : const Icon(Icons.arrow_upward_rounded, color: Colors.white, size: 20),
                          ),
                        ],
                      ),
                      if (_response != null) ...[
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: cardBg,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.3)),
                          ),
                          child: SelectableText(
                            _response!,
                            style: TextStyle(
                              fontSize: 12,
                              color: context.textPrimary,
                              height: 1.5,
                            ),
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
    );
  }
}
