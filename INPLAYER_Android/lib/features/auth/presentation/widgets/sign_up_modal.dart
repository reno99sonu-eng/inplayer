import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/auth_provider.dart';
import 'google_sign_in_button.dart';

class SignUpModal extends ConsumerStatefulWidget {
  final VoidCallback? onClose;
  final VoidCallback? onSuccess;
  final VoidCallback? onSwitchToSignIn;
  final Function(String email)? onNeedsVerification;

  const SignUpModal({
    super.key,
    this.onClose,
    this.onSuccess,
    this.onSwitchToSignIn,
    this.onNeedsVerification,
  });

  @override
  ConsumerState<SignUpModal> createState() => _SignUpModalState();
}

class _SignUpModalState extends ConsumerState<SignUpModal>
    with SingleTickerProviderStateMixin {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _ageController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _vendorIdController = TextEditingController();

  String _accountType = 'user'; // 'user' or 'vendor'
  bool _showPassword = false;
  bool _showConfirmPassword = false;
  bool _loading = false;
  bool _googleLoading = false;
  String? _error;
  bool _success = false;

  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _shakeAnimation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0.0, end: -8.0), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -8.0, end: 8.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: 8.0, end: -8.0), weight: 2),
      TweenSequenceItem(tween: Tween(begin: -8.0, end: 0.0), weight: 1),
    ]).animate(CurvedAnimation(parent: _shakeController, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _ageController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _vendorIdController.dispose();
    _shakeController.dispose();
    super.dispose();
  }

  int get _passwordStrengthScore {
    final p = _passwordController.text;
    if (p.isEmpty) return 0;
    int score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (RegExp(r'[A-Z]').hasMatch(p) && RegExp(r'[a-z]').hasMatch(p)) score++;
    if (RegExp(r'[0-9]').hasMatch(p)) score++;
    if (RegExp(r'[^A-Za-z0-9]').hasMatch(p)) score++;
    return score;
  }

  String get _passwordStrengthLabel {
    final s = _passwordStrengthScore;
    if (s <= 1) return 'Weak';
    if (s <= 3) return 'Fair';
    if (s == 4) return 'Good';
    return 'Strong';
  }

  Color get _passwordStrengthColor {
    final s = _passwordStrengthScore;
    if (s <= 1) return const Color(0xFFEF4444);
    if (s <= 3) return const Color(0xFFFB923C);
    if (s == 4) return const Color(0xFFFBBF24);
    return const Color(0xFF10B981);
  }

  void _triggerError(String msg) {
    setState(() {
      _error = msg;
      _loading = false;
      _googleLoading = false;
    });
    _shakeController.forward(from: 0.0);
  }

  void _handleClose() {
    if (widget.onClose != null) {
      widget.onClose!();
    } else if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go('/');
    }
  }

  void _handleSuccess() {
    if (widget.onSuccess != null) {
      widget.onSuccess!();
    } else if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    } else {
      context.go('/');
    }
  }

  Future<void> _handleSignUp() async {
    final name = _nameController.text.trim();
    final email = _emailController.text.trim();
    final password = _passwordController.text;
    final confirm = _confirmPasswordController.text;

    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      _triggerError('Please fill in your name, email, and password.');
      return;
    }

    if (password.length < 8) {
      _triggerError('Password must be at least 8 characters long.');
      return;
    }

    if (password != confirm) {
      _triggerError('Passwords do not match.');
      return;
    }

    if (_accountType == 'vendor') {
      final vendorId = _vendorIdController.text.trim();
      if (vendorId.isEmpty) {
        _triggerError('Please enter your Vendor ID.');
        return;
      }
    }

    setState(() {
      _error = null;
      _loading = true;
    });

    try {
      await ref.read(authStateProvider.notifier).signUp(
            email: email,
            password: password,
            name: name,
          );

      if (mounted) {
        final authState = ref.read(authStateProvider);
        if (authState is AuthStateNeedsVerification) {
          setState(() {
            _success = true;
            _loading = false;
          });
          await Future.delayed(const Duration(milliseconds: 500));
          if (mounted) {
            if (widget.onNeedsVerification != null) {
              widget.onNeedsVerification!(email);
            } else {
              _handleSuccess();
            }
          }
        } else if (authState is AuthStateError) {
          _triggerError(authState.message);
        } else {
          setState(() {
            _success = true;
            _loading = false;
          });
          await Future.delayed(const Duration(milliseconds: 500));
          if (mounted) {
            _handleSuccess();
          }
        }
      }
    } catch (e) {
      if (mounted) {
        _triggerError(e.toString());
      }
    }
  }

  Future<void> _handleGoogle() async {
    setState(() {
      _error = null;
      _googleLoading = true;
    });

    try {
      final success = await ref.read(authStateProvider.notifier).signInWithGoogle();
      if (success && mounted) {
        setState(() {
          _success = true;
          _googleLoading = false;
        });
        await Future.delayed(const Duration(milliseconds: 500));
        if (mounted) {
          _handleSuccess();
        }
      } else if (mounted) {
        final authState = ref.read(authStateProvider);
        if (authState is AuthStateError) {
          _triggerError(authState.message);
        } else {
          _triggerError("Google sign-in isn't set up for this site yet. Please create an account with your email instead.");
        }
      }
    } catch (_) {
      if (mounted) {
        _triggerError("Google sign-in isn't set up for this site yet. Please create an account with your email instead.");
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    return AnimatedBuilder(
      animation: _shakeAnimation,
      builder: (context, child) {
        return Transform.translate(
          offset: Offset(_shakeAnimation.value, 0),
          child: child,
        );
      },
      child: Center(
        child: Material(
          type: MaterialType.transparency,
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
            child: Container(
            constraints: const BoxConstraints(maxWidth: 440),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(28),
              border: Border.all(
                color: isDark
                    ? AppColors.brandOrange.withValues(alpha: 0.22)
                    : AppColors.brandOrange.withValues(alpha: 0.35),
                width: 1.5,
              ),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: isDark
                    ? const [
                        Color(0xFF07111F),
                        Color(0xFF0B1728),
                        Color(0xFF040A14),
                      ]
                    : const [
                        Color(0xFFFBF6EA),
                        Color(0xFFEDE2C9),
                        Color(0xFFFBF6EA),
                      ],
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: isDark ? 0.65 : 0.20),
                  blurRadius: 50,
                  offset: const Offset(0, 20),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(28),
              child: Stack(
                children: [
                  // Close 'X' Button
                  if (!_success)
                    Positioned(
                      top: 16,
                      right: 16,
                      child: GestureDetector(
                        onTap: _handleClose,
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: isDark
                                ? Colors.white.withValues(alpha: 0.08)
                                : Colors.black.withValues(alpha: 0.06),
                            border: Border.all(
                              color: isDark
                                  ? Colors.white.withValues(alpha: 0.12)
                                  : Colors.black.withValues(alpha: 0.12),
                            ),
                          ),
                          child: Icon(
                            Icons.close_rounded,
                            size: 18,
                            color: context.textSecondary,
                          ),
                        ),
                      ),
                    ),

                  // Main Content
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 24, 24, 24),
                    child: _success ? _buildSuccessView(context) : _buildFormView(context, isDark),
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

  Widget _buildSuccessView(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 24),
        Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF10B981).withValues(alpha: 0.18),
            border: Border.all(color: const Color(0xFF34D399), width: 1.5),
          ),
          child: const Center(
            child: Icon(Icons.check_rounded, color: Color(0xFF34D399), size: 34),
          ),
        ),
        const SizedBox(height: 18),
        Text(
          'Account Created!',
          style: TextStyle(
            color: context.textPrimary,
            fontSize: 22,
            fontWeight: FontWeight.w900,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'Setting up your InPlayer workspace...',
          style: TextStyle(
            color: context.textSecondary,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }

  Widget _buildFormView(BuildContext context, bool isDark) {
    final score = _passwordStrengthScore;
    final label = _passwordStrengthLabel;
    final color = _passwordStrengthColor;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // Pill Badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3.5),
          decoration: BoxDecoration(
            color: AppColors.brandOrange.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppColors.brandOrange.withValues(alpha: 0.35)),
          ),
          child: const Text(
            'INPLAYER JOIN',
            style: TextStyle(
              color: AppColors.brandOrange,
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 2.5,
            ),
          ),
        ),

        const SizedBox(height: 12),

        // Title
        Text(
          'Join\nInPlayer.',
          style: TextStyle(
            color: context.textPrimary,
            fontSize: 26,
            fontWeight: FontWeight.w900,
            letterSpacing: -0.8,
            height: 1.1,
          ),
        ),

        const SizedBox(height: 6),

        // Subtitle
        Text(
          'Create an account to stream, interact, and access exclusive content.',
          style: TextStyle(
            color: context.textSecondary,
            fontSize: 13,
            height: 1.35,
          ),
        ),

        const SizedBox(height: 16),

        // Account Type Toggle (User vs Vendor)
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF07111F) : Colors.black.withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isDark ? Colors.white.withValues(alpha: 0.10) : Colors.black.withValues(alpha: 0.10),
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _accountType = 'user'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: _accountType == 'user'
                          ? AppColors.brandOrange
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: _accountType == 'user'
                          ? [
                              BoxShadow(
                                color: AppColors.brandOrange.withValues(alpha: 0.35),
                                blurRadius: 10,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Center(
                      child: Text(
                        'As User',
                        style: TextStyle(
                          color: _accountType == 'user'
                              ? const Color(0xFF0F172A)
                              : context.textSecondary,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _accountType = 'vendor'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: _accountType == 'vendor'
                          ? AppColors.brandOrange
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                      boxShadow: _accountType == 'vendor'
                          ? [
                              BoxShadow(
                                color: AppColors.brandOrange.withValues(alpha: 0.35),
                                blurRadius: 10,
                                offset: const Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    child: Center(
                      child: Text(
                        'As Vendor',
                        style: TextStyle(
                          color: _accountType == 'vendor'
                              ? const Color(0xFF0F172A)
                              : context.textSecondary,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // Full Name
        Text(
          'Full Name',
          style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _nameController,
          hint: 'e.g. John Doe',
          icon: Icons.person_outline_rounded,
          isDark: isDark,
        ),

        const SizedBox(height: 12),

        // Email
        Text(
          'Email Address',
          style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _emailController,
          hint: 'you@example.com',
          icon: Icons.mail_outline_rounded,
          keyboardType: TextInputType.emailAddress,
          isDark: isDark,
        ),

        if (_accountType == 'vendor') ...[
          const SizedBox(height: 12),
          Text(
            'Vendor ID',
            style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 6),
          _buildTextField(
            controller: _vendorIdController,
            hint: 'VEND-XXXX',
            icon: Icons.storefront_outlined,
            isDark: isDark,
          ),
        ],

        const SizedBox(height: 12),

        // Password
        Text(
          'Password',
          style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _passwordController,
          hint: '••••••••',
          icon: Icons.lock_outline_rounded,
          obscureText: !_showPassword,
          isDark: isDark,
          onChanged: (_) => setState(() {}),
          suffix: GestureDetector(
            onTap: () => setState(() => _showPassword = !_showPassword),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Text(
                _showPassword ? 'Hide' : 'Show',
                style: const TextStyle(
                  color: AppColors.brandOrange,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ),

        // Password Strength Bar
        if (_passwordController.text.isNotEmpty) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: (score / 5).clamp(0.0, 1.0),
                    backgroundColor: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.black.withValues(alpha: 0.08),
                    valueColor: AlwaysStoppedAnimation<Color>(color),
                    minHeight: 4,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Text(
                label,
                style: TextStyle(
                  color: color,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],

        const SizedBox(height: 12),

        // Confirm Password
        Text(
          'Confirm Password',
          style: TextStyle(color: context.textSecondary, fontSize: 12, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 6),
        _buildTextField(
          controller: _confirmPasswordController,
          hint: '••••••••',
          icon: Icons.lock_outline_rounded,
          obscureText: !_showConfirmPassword,
          isDark: isDark,
          suffix: GestureDetector(
            onTap: () => setState(() => _showConfirmPassword = !_showConfirmPassword),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              child: Text(
                _showConfirmPassword ? 'Hide' : 'Show',
                style: const TextStyle(
                  color: AppColors.brandOrange,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          onSubmitted: (_) => _handleSignUp(),
        ),

        if (_error != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFFEF4444).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline_rounded, color: Color(0xFFF87171), size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Color(0xFFFCA5A5), fontSize: 11.5, height: 1.25),
                  ),
                ),
              ],
            ),
          ),
        ],

        const SizedBox(height: 18),

        // Create Account Button
        GestureDetector(
          onTap: _loading ? null : _handleSignUp,
          child: Container(
            height: 48,
            width: double.infinity,
            decoration: BoxDecoration(
              gradient: AppColors.flameGradient,
              borderRadius: BorderRadius.circular(16),
              boxShadow: [
                BoxShadow(
                  color: AppColors.brandOrange.withValues(alpha: 0.35),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Center(
              child: _loading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)),
                    )
                  : const Text(
                      'Create Account',
                      style: TextStyle(
                        color: Color(0xFF0F172A),
                        fontSize: 15,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
            ),
          ),
        ),

        const SizedBox(height: 14),

        // OR Divider
        Row(
          children: [
            Expanded(child: Divider(color: context.borderSubtle)),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Text(
                'OR',
                style: TextStyle(color: context.textDim, fontSize: 10, fontWeight: FontWeight.w700),
              ),
            ),
            Expanded(child: Divider(color: context.borderSubtle)),
          ],
        ),

        const SizedBox(height: 14),

        // Google Button
        GoogleSignInButton(
          onPressed: _handleGoogle,
          isLoading: _googleLoading,
        ),

        const SizedBox(height: 16),

        // Switch to Sign In
        Center(
          child: GestureDetector(
            onTap: () {
              if (widget.onSwitchToSignIn != null) {
                widget.onSwitchToSignIn!();
              } else {
                context.go('/signin');
              }
            },
            child: RichText(
              text: TextSpan(
                style: TextStyle(color: context.textSecondary, fontSize: 12.5),
                children: const [
                  TextSpan(text: 'Already have an account? '),
                  TextSpan(
                    text: 'Sign In',
                    style: TextStyle(
                      color: AppColors.brandOrange,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool obscureText = false,
    TextInputType? keyboardType,
    Widget? suffix,
    required bool isDark,
    ValueChanged<String>? onChanged,
    ValueChanged<String>? onSubmitted,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF07111F) : Colors.black.withValues(alpha: 0.03),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? Colors.white.withValues(alpha: 0.10) : Colors.black.withValues(alpha: 0.10),
          width: 1,
        ),
      ),
      child: TextField(
        controller: controller,
        obscureText: obscureText,
        keyboardType: keyboardType,
        onChanged: onChanged,
        onSubmitted: onSubmitted,
        style: TextStyle(
          color: context.textPrimary,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
        cursorColor: AppColors.brandOrange,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: context.textDim, fontSize: 13.5),
          prefixIcon: Icon(icon, color: context.textDim, size: 18),
          suffixIcon: suffix,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
        ),
      ),
    );
  }
}
