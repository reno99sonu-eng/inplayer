import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import 'ai_studio_modal.dart';

class FloatingAIButton extends StatefulWidget {
  final ScrollController? scrollController;

  const FloatingAIButton({super.key, this.scrollController});

  @override
  State<FloatingAIButton> createState() => _FloatingAIButtonState();
}

class _FloatingAIButtonState extends State<FloatingAIButton>
    with TickerProviderStateMixin {
  bool _isHidden = false;
  late AnimationController _tapController;
  late Animation<double> _scaleAnimation;
  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _tapController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.92).animate(
      CurvedAnimation(parent: _tapController, curve: Curves.easeInOut),
    );

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.25, end: 0.65).animate(
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
    if (widget.scrollController == null) return;
    final maxScroll = widget.scrollController!.position.maxScrollExtent;
    final currentScroll = widget.scrollController!.position.pixels;

    if (maxScroll - currentScroll <= 100) {
      if (!_isHidden) setState(() => _isHidden = true);
    } else {
      if (_isHidden) setState(() => _isHidden = false);
    }
  }

  void _showAIStudioModal() {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'AI Studio Modal',
      barrierColor: Colors.black.withValues(alpha: 0.65),
      transitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (context, animation, secondaryAnimation) {
        return const AIStudioModal();
      },
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        return FadeTransition(
          opacity: animation,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.94, end: 1.0).animate(
              CurvedAnimation(parent: animation, curve: Curves.easeOutBack),
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

    return AnimatedPositioned(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      bottom: _isHidden ? -100 : 84, // Above bottom nav
      right: 16,
      child: AnimatedBuilder(
        animation: _pulseAnimation,
        builder: (context, child) {
          return GestureDetector(
            onTapDown: (_) => _tapController.forward(),
            onTapUp: (_) {
              _tapController.reverse();
              _showAIStudioModal();
            },
            onTapCancel: () => _tapController.reverse(),
            child: ScaleTransition(
              scale: _scaleAnimation,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(22),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: (isDark ? const Color(0xFF0F172A) : Colors.white).withValues(alpha: 0.75),
                    border: Border.all(
                      color: isDark
                          ? AppColors.brandOrange.withValues(alpha: _pulseAnimation.value * 0.8)
                          : AppColors.brandOrange.withValues(alpha: _pulseAnimation.value * 0.7),
                      width: 1.2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: isDark
                            ? const Color(0xFFFFAA00).withValues(alpha: 0.22)
                            : const Color(0xFFEA580C).withValues(alpha: 0.18),
                        blurRadius: 18,
                        spreadRadius: 1,
                      ),
                      BoxShadow(
                        color: Colors.black.withValues(alpha: isDark ? 0.3 : 0.08),
                        blurRadius: 8,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: Center(
                    child: Text(
                      '✦',
                      style: TextStyle(
                        color: isDark ? const Color(0xFFFCD34D) : const Color(0xFFF97316),
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        shadows: [
                          Shadow(
                            color: isDark
                                ? const Color(0xFFFFAA00).withValues(alpha: 0.5)
                                : const Color(0xFFEA580C).withValues(alpha: 0.3),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                    ),
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
