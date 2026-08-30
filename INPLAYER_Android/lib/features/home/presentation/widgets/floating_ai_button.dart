import 'package:flutter/material.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import 'ai_studio_modal.dart';

/// Theme-aware, single-gesture launcher for InPlayer AI.
///
/// The tap target intentionally has one [InkResponse] only. Stacking a
/// GestureDetector, InkWell, and explicit Semantics nodes around the same
/// animated child can result in duplicate route pushes and a broken semantics
/// tree on some Flutter/Android combinations.
class FloatingAIButton extends StatefulWidget {
  final ScrollController? scrollController;

  const FloatingAIButton({super.key, this.scrollController});

  @override
  State<FloatingAIButton> createState() => _FloatingAIButtonState();
}

class _FloatingAIButtonState extends State<FloatingAIButton>
    with TickerProviderStateMixin {
  bool _isHidden = false;
  bool _isDialogOpen = false;
  late final AnimationController _tapController;
  late final Animation<double> _scaleAnimation;
  late final AnimationController _pulseController;
  late final Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _tapController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 130),
    );
    _scaleAnimation = Tween<double>(
      begin: 1,
      end: .94,
    ).animate(CurvedAnimation(parent: _tapController, curve: Curves.easeOut));

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
        position.maxScrollExtent > 0 &&
        position.maxScrollExtent - position.pixels <= 100;
    if (shouldHide != _isHidden && mounted) {
      setState(() => _isHidden = shouldHide);
    }
  }

  Future<void> _openAIStudio() async {
    if (_isDialogOpen || !mounted) return;
    _isDialogOpen = true;
    _tapController.forward();

    final isDark = context.isDark;
    try {
      await showGeneralDialog<void>(
        context: context,
        useRootNavigator: true,
        barrierDismissible: true,
        barrierLabel: 'Close InPlayer AI',
        barrierColor: isDark
            ? Colors.black.withValues(alpha: .70)
            : const Color(0xFF25170F).withValues(alpha: .48),
        transitionDuration: const Duration(milliseconds: 220),
        pageBuilder: (dialogContext, animation, secondaryAnimation) =>
            const AIStudioModal(),
        transitionBuilder: (dialogContext, animation, secondaryAnimation, child) {
          final curve = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          );
          return FadeTransition(
            opacity: curve,
            child: ScaleTransition(
              scale: Tween<double>(begin: 0.96, end: 1.0).animate(curve),
              child: child,
            ),
          );
        },
      );
    } finally {
      _isDialogOpen = false;
      if (mounted) {
        _tapController.reverse();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    final surface = isDark ? const Color(0xFF0B1422) : AppColors.surfaceLight;
    final icon = isDark
        ? AppColors.brandGoldBright
        : AppColors.brandOrangeAccent;
    final border = isDark
        ? AppColors.brandGold.withValues(alpha: .30)
        : AppColors.brandOrangeAccent.withValues(alpha: .30);
    final glow = isDark
        ? AppColors.brandGold.withValues(alpha: .18)
        : AppColors.brandOrangeAccent.withValues(alpha: .16);

    return AnimatedPositioned(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      bottom: _isHidden ? -100 : 84,
      right: 16,
      child: IgnorePointer(
        ignoring: _isHidden || _isDialogOpen,
        child: ScaleTransition(
          scale: _scaleAnimation,
          child: AnimatedBuilder(
            animation: _pulseAnimation,
            builder: (context, _) {
              return SizedBox(
                width: 60,
                height: 60,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: 60,
                      height: 60,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: border.withValues(
                            alpha: .18 + (_pulseAnimation.value * .38),
                          ),
                          width: 1.2,
                        ),
                      ),
                    ),
                    DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: glow,
                            blurRadius: 18,
                            spreadRadius: 2,
                          ),
                          BoxShadow(
                            color: Colors.black.withValues(
                              alpha: isDark ? .30 : .12,
                            ),
                            blurRadius: 10,
                            offset: const Offset(0, 5),
                          ),
                        ],
                      ),
                      child: Material(
                        color: surface,
                        shape: const CircleBorder(),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: _openAIStudio,
                          splashColor: icon.withValues(alpha: .12),
                          highlightColor: icon.withValues(alpha: .08),
                          customBorder: const CircleBorder(),
                          child: SizedBox(
                            width: 52,
                            height: 52,
                            child: Center(
                              child: Icon(
                                Icons.auto_awesome_rounded,
                                color: icon,
                                size: 23,
                                shadows: [
                                  Shadow(
                                    color: glow.withValues(alpha: .80),
                                    blurRadius: 8,
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
              );
            },
          ),
        ),
      ),
    );
  }
}
