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
              child: Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: isDark
                        ? const [Color(0xFF1B2435), Color(0xFF0B1020)]
                        : const [Color(0xFFFDF8EC), Color(0xFFF0E3C6)],
                  ),
                  border: Border.all(
                    color: isDark
                        ? AppColors.brandOrange.withValues(alpha: _pulseAnimation.value)
                        : AppColors.brandOrange.withValues(alpha: _pulseAnimation.value * 0.9),
                    width: 1.5,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: isDark
                          ? const Color(0xFFFFAA00).withValues(alpha: 0.35)
                          : const Color(0xFFEA580C).withValues(alpha: 0.28),
                      blurRadius: 32,
                      spreadRadius: 2,
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: isDark ? 0.4 : 0.15),
                      blurRadius: 10,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    '✦',
                    style: TextStyle(
                      color: isDark ? const Color(0xFFFCD34D) : const Color(0xFFF97316),
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      shadows: [
                        Shadow(
                          color: isDark
                              ? const Color(0xFFFFAA00).withValues(alpha: 0.6)
                              : const Color(0xFFEA580C).withValues(alpha: 0.4),
                          blurRadius: 10,
                        ),
                      ],
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
