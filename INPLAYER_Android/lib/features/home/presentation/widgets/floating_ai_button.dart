import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import 'ai_studio_modal.dart';

/// Theme-aware entry point for the on-device AI assistant.
///
/// It deliberately uses the same surface, border, and text tokens as the
/// surrounding screen. The former translucent white/navy circle looked like a
/// separate design system when the app switched between parchment and
/// obsidian themes.
class FloatingAIButton extends StatefulWidget {
  final ScrollController? scrollController;

  const FloatingAIButton({super.key, this.scrollController});

  @override
  State<FloatingAIButton> createState() => _FloatingAIButtonState();
}

class _FloatingAIButtonState extends State<FloatingAIButton>
    with TickerProviderStateMixin {
  bool _isHidden = false;
  late final AnimationController _tapController;
  late final Animation<double> _scaleAnimation;
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _tapController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _scaleAnimation = Tween<double>(begin: 1, end: .94).animate(
      CurvedAnimation(parent: _tapController, curve: Curves.easeInOut),
    );

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);
    _pulseAnimation = Tween<double>(begin: .20, end: .62).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    widget.scrollController?.addListener(_onScroll);
  }

  @override
  void dispose() {
    widget.scrollController?.removeListener(_onScroll);
    _tapController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  void _onScroll() {
    final controller = widget.scrollController;
    if (controller == null || !controller.hasClients) return;

    final position = controller.position;
    final shouldHide =
        position.maxScrollExtent - position.pixels <= 100 &&
        position.maxScrollExtent > 0;
    if (shouldHide != _isHidden && mounted) {
      setState(() => _isHidden = shouldHide);
    }
  }

  void _showAIStudioModal() {
    final isDark = context.isDark;
    showGeneralDialog<void>(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Close InPlayer AI',
      barrierColor: isDark
          ? Colors.black.withValues(alpha: .68)
          : const Color(0xFF2A2015).withValues(alpha: .48),
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (context, animation, secondaryAnimation) =>
          const AIStudioModal(),
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        return FadeTransition(
          opacity: animation,
          child: ScaleTransition(
            scale: Tween<double>(begin: .96, end: 1).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutCubic),
            ),
            child: child,
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    final surfaceColor = isDark
        ? const Color(0xFF0F172A).withValues(alpha: 0.85)
        : Colors.white.withValues(alpha: 0.92);
    final iconColor = isDark ? const Color(0xFFFFA726) : AppColors.brandOrange;
    final borderColor = isDark
        ? AppColors.brandOrange.withValues(alpha: 0.35)
        : const Color(0xFFE5DBC7);
    final glowColor = isDark
        ? AppColors.brandOrange.withValues(alpha: 0.25)
        : AppColors.brandOrange.withValues(alpha: 0.15);

    return AnimatedPositioned(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      bottom: _isHidden ? -100 : 80,
      right: 16,
      child: AnimatedBuilder(
        animation: _pulseAnimation,
        builder: (context, child) {
          return Semantics(
            button: true,
            label: 'Open InPlayer AI',
            child: GestureDetector(
              onTapDown: (_) => _tapController.forward(),
              onTapUp: (_) {
                _tapController.reverse();
                _showAIStudioModal();
              },
              onTapCancel: _tapController.reverse,
              child: ScaleTransition(
                scale: _scaleAnimation,
                child: SizedBox(
                  width: 50,
                  height: 50,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Breathing Outer Glow Ring
                      Container(
                        width: 50,
                        height: 50,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: borderColor.withValues(
                              alpha: (0.10 + (_pulseAnimation.value * 0.30)).clamp(0.0, 1.0),
                            ),
                            width: 1.2,
                          ),
                        ),
                      ),
                      // Frosted Glass Floating Action Button
                      ClipOval(
                        child: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: surfaceColor,
                            border: Border.all(
                              color: borderColor,
                              width: 1.2,
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: glowColor,
                                blurRadius: 12,
                                spreadRadius: 1,
                              ),
                              BoxShadow(
                                color: Colors.black.withValues(alpha: isDark ? 0.35 : 0.08),
                                blurRadius: 6,
                                offset: const Offset(0, 2),
                              ),
                            ],
                          ),
                          child: Material(
                            color: Colors.transparent,
                            child: InkWell(
                              customBorder: const CircleBorder(),
                              onTap: _showAIStudioModal,
                              child: Center(
                                child: Icon(
                                  Icons.auto_awesome_rounded,
                                  color: iconColor,
                                  size: 20,
                                  shadows: [
                                    Shadow(
                                      color: glowColor.withValues(alpha: 0.8),
                                      blurRadius: 6,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
