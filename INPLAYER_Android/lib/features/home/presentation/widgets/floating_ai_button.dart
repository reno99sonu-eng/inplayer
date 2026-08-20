import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';
import 'ai_studio_modal.dart';

class FloatingAIButton extends StatefulWidget {
  final ScrollController? scrollController;

  const FloatingAIButton({super.key, this.scrollController});

  @override
  State<FloatingAIButton> createState() => _FloatingAIButtonState();
}

class _FloatingAIButtonState extends State<FloatingAIButton>
    with SingleTickerProviderStateMixin {
  bool _isHidden = false;
  late AnimationController _animationController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.1).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: Curves.easeInOut,
      ),
    );

    widget.scrollController?.addListener(_onScroll);
  }

  @override
  void dispose() {
    widget.scrollController?.removeListener(_onScroll);
    _animationController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (widget.scrollController == null) return;
    
    final maxScroll = widget.scrollController!.position.maxScrollExtent;
    final currentScroll = widget.scrollController!.position.pixels;
    
    // Hide when near bottom
    if (maxScroll - currentScroll <= 100) {
      if (!_isHidden) {
        setState(() => _isHidden = true);
      }
    } else {
      if (_isHidden) {
        setState(() => _isHidden = false);
      }
    }
  }

  void _showAIStudioModal() {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'AI Studio Modal',
      barrierColor: Colors.black.withValues(alpha: 0.5),
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (context, animation, secondaryAnimation) {
        return const AIStudioModal();
      },
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        return FadeTransition(
          opacity: animation,
          child: ScaleTransition(
            scale: Tween<double>(begin: 0.95, end: 1.0).animate(
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
    return AnimatedPositioned(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      bottom: _isHidden ? -100 : 90, // Above bottom nav
      right: 16,
      child: GestureDetector(
        onTapDown: (_) => _animationController.forward(),
        onTapUp: (_) {
          _animationController.reverse();
          _showAIStudioModal();
        },
        onTapCancel: () => _animationController.reverse(),
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF1B2435),
                  Color(0xFF0B1020),
                ],
              ),
              border: Border.all(
                color: AppColors.brandOrange.withValues(alpha: 0.2),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppColors.brandOrange.withValues(alpha: 0.35),
                  blurRadius: 40,
                  spreadRadius: 0,
                ),
              ],
            ),
            child: const Center(
              child: Text(
                '✦',
                style: TextStyle(
                  color: AppColors.brandGold,
                  fontSize: 24,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
