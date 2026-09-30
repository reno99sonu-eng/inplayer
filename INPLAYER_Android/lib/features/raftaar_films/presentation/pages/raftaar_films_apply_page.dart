import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../models/film_creator_application.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/raftaar_films_service.dart';
import '../../../auth/presentation/widgets/auth_modals.dart';

class RaftaarFilmsApplyPage extends ConsumerStatefulWidget {
  const RaftaarFilmsApplyPage({super.key});

  @override
  ConsumerState<RaftaarFilmsApplyPage> createState() =>
      _RaftaarFilmsApplyPageState();
}

class _RaftaarFilmsApplyPageState
    extends ConsumerState<RaftaarFilmsApplyPage> {
  final _formKey = GlobalKey<FormState>();

  final _channelNameCtrl = TextEditingController();
  final _personalNameCtrl = TextEditingController();
  final _companyCtrl = TextEditingController();
  final _usernameCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();

  FilmCreatorApplication? _existingApp;
  bool _isLoading = true;
  bool _isSubmitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _checkStatus();
  }

  @override
  void dispose() {
    _channelNameCtrl.dispose();
    _personalNameCtrl.dispose();
    _companyCtrl.dispose();
    _usernameCtrl.dispose();
    _phoneCtrl.dispose();
    _emailCtrl.dispose();
    super.dispose();
  }

  Future<void> _checkStatus() async {
    setState(() => _isLoading = true);
    final service = ref.read(raftaarFilmsServiceProvider);

    try {
      final app = await service.getApplicationStatus();
      if (mounted) {
        setState(() {
          _existingApp = app;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final authState = ref.read(authStateProvider);
    if (authState is! AuthStateAuthenticated) {
      showSignInModal(context);
      return;
    }

    setState(() {
      _isSubmitting = true;
      _error = null;
    });

    final data = {
      'channelName': _channelNameCtrl.text.trim(),
      'personalName': _personalNameCtrl.text.trim(),
      'companyName': _companyCtrl.text.trim().isNotEmpty
          ? _companyCtrl.text.trim()
          : null,
      'username': _usernameCtrl.text.trim(),
      'email': _emailCtrl.text.trim(),
      'phoneNumber': _phoneCtrl.text.trim(),
    };

    final service = ref.read(raftaarFilmsServiceProvider);
    final success = await service.submitApplication(data);

    if (mounted) {
      setState(() => _isSubmitting = false);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Application submitted successfully! 48-72h SLA.'),
            backgroundColor: Colors.green,
          ),
        );
        _checkStatus();
      } else {
        setState(() {
          _error = 'Failed to submit application. Please try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;
    final authState = ref.watch(authStateProvider);
    final user = authState is AuthStateAuthenticated ? authState.user : null;

    if (user != null) {
      if (_usernameCtrl.text.isEmpty) {
        _usernameCtrl.text = user.handle ?? user.username;
      }
      if (_personalNameCtrl.text.isEmpty) {
        _personalNameCtrl.text = user.name;
      }
      if (_emailCtrl.text.isEmpty && user.email.isNotEmpty) {
        _emailCtrl.text = user.email;
      }
      if (_phoneCtrl.text.isEmpty && (user.phoneNumber?.isNotEmpty ?? false)) {
        _phoneCtrl.text = user.phoneNumber!;
      }
    }

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F0F13) : Colors.white,
      appBar: AppBar(
        backgroundColor: isDark ? const Color(0xFF0F0F13) : Colors.white,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new_rounded,
            color: isDark ? Colors.white : Colors.black87,
            size: 20,
          ),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Creator Application',
          style: TextStyle(
            color: isDark ? Colors.white : Colors.black87,
            fontWeight: FontWeight.w800,
            fontSize: 18,
          ),
        ),
      ),
      body: PatternBackground(
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.brandOrange),
              )
            : SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // SLA Badge Banner
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            const Color(0xFFFF7A18).withValues(alpha: 0.15),
                            const Color(0xFFFF9A00).withValues(alpha: 0.08),
                          ],
                        ),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: const Color(0xFFFF7A18).withValues(alpha: 0.3),
                          width: 1,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFFF7A18),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(
                                  Icons.timer_outlined,
                                  color: Colors.white,
                                  size: 16,
                                ),
                              ),
                              const SizedBox(width: 10),
                              const Text(
                                '48-72h Editorial Review SLA',
                                style: TextStyle(
                                  color: Color(0xFFFF9A00),
                                  fontWeight: FontWeight.w800,
                                  fontSize: 15,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'Apply to become a verified Raftaar Films creator. Once approved, you unlock vertical micro-drama series publishing, episode management, and revenue share.',
                            style: TextStyle(
                              color: isDark ? Colors.white70 : Colors.black87,
                              fontSize: 12.5,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Existing Application Status Cards
                    if (_existingApp != null) ...[
                      if (_existingApp!.isPending)
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.amber.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: Colors.amber.withValues(alpha: 0.4),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.hourglass_top_rounded,
                                color: Colors.amber,
                                size: 28,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      'Application Under Review',
                                      style: TextStyle(
                                        color: Colors.amber,
                                        fontWeight: FontWeight.w800,
                                        fontSize: 14,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'Submitted for "${_existingApp!.channelName}". Our editorial team is currently reviewing your application within 48-72 hours.',
                                      style: TextStyle(
                                        color: isDark
                                            ? Colors.white70
                                            : Colors.black87,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      if (_existingApp!.isApproved)
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.green.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: Colors.green.withValues(alpha: 0.5),
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.verified_rounded,
                                color: Colors.greenAccent,
                                size: 30,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    const Text(
                                      '🎉 Approved Creator',
                                      style: TextStyle(
                                        color: Colors.greenAccent,
                                        fontWeight: FontWeight.w800,
                                        fontSize: 15,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      'You are an officially approved Raftaar Films creator! You can now publish series from the Upload screen or Studio.',
                                      style: TextStyle(
                                        color: isDark
                                            ? Colors.white70
                                            : Colors.black87,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      if (_existingApp!.isRejected) ...[
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: Colors.red.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: Colors.red.withValues(alpha: 0.4),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Row(
                                children: [
                                  Icon(
                                    Icons.error_outline_rounded,
                                    color: Colors.redAccent,
                                    size: 22,
                                  ),
                                  SizedBox(width: 8),
                                  Text(
                                    'Application Not Approved',
                                    style: TextStyle(
                                      color: Colors.redAccent,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                'Reason: ${_existingApp!.rejectionReason ?? "Does not meet editorial guidelines"}',
                                style: TextStyle(
                                  color: isDark
                                      ? Colors.white70
                                      : Colors.black87,
                                  fontSize: 12.5,
                                ),
                              ),
                              const SizedBox(height: 8),
                              const Text(
                                'You may update your details below and re-apply.',
                                style: TextStyle(
                                  color: Colors.white54,
                                  fontSize: 11.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ],

                    if (_existingApp == null || _existingApp!.isRejected) ...[
                      Form(
                        key: _formKey,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _buildTextField(
                              label: 'Channel Name *',
                              controller: _channelNameCtrl,
                              hint: 'e.g. CineFlix Originals',
                              validator: (val) =>
                                  val == null || val.trim().isEmpty
                                      ? 'Channel name is required'
                                      : null,
                            ),
                            const SizedBox(height: 14),
                            _buildTextField(
                              label: 'Personal / Legal Name *',
                              controller: _personalNameCtrl,
                              hint: 'Full name',
                              validator: (val) =>
                                  val == null || val.trim().isEmpty
                                      ? 'Name is required'
                                      : null,
                            ),
                            const SizedBox(height: 14),
                            _buildTextField(
                              label: 'Production / Company Name',
                              controller: _companyCtrl,
                              hint: 'Optional studio or production house',
                            ),
                            const SizedBox(height: 14),
                            _buildTextField(
                              label: 'InPlayer Handle / Username *',
                              controller: _usernameCtrl,
                              hint: 'username',
                              validator: (val) =>
                                  val == null || val.trim().isEmpty
                                      ? 'Username is required'
                                      : null,
                            ),
                            const SizedBox(height: 14),
                            _buildTextField(
                              label: 'Email ID *',
                              controller: _emailCtrl,
                              hint: 'creator@example.com',
                              keyboardType: TextInputType.emailAddress,
                              validator: (val) {
                                if (val == null || val.trim().isEmpty) {
                                  return 'Email is required';
                                }
                                if (!val.contains('@') || !val.contains('.')) {
                                  return 'Enter a valid email address';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 14),
                            _buildTextField(
                              label: 'Phone Number *',
                              controller: _phoneCtrl,
                              hint: '+91 98765 43210',
                              keyboardType: TextInputType.phone,
                              validator: (val) {
                                if (val == null || val.trim().isEmpty) {
                                  return 'Phone number is required';
                                }
                                if (val.trim().length < 7) {
                                  return 'Enter a valid phone number';
                                }
                                return null;
                              },
                            ),
                            const SizedBox(height: 16),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: isDark
                                    ? Colors.white.withValues(alpha: 0.05)
                                    : Colors.black.withValues(alpha: 0.03),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: isDark
                                      ? Colors.white.withValues(alpha: 0.1)
                                      : Colors.black.withValues(alpha: 0.08),
                                ),
                              ),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(
                                    Icons.info_outline_rounded,
                                    color: Color(0xFFFF7A18),
                                    size: 18,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      'You can upload your Profile Picture, and set your Channel Bio and Social Links inside My Profile (Settings > Edit Profile) once your account is created.',
                                      style: TextStyle(
                                        color: isDark
                                            ? Colors.white.withValues(alpha: 0.7)
                                            : Colors.black87,
                                        fontSize: 12,
                                        height: 1.4,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 24),

                            if (_error != null)
                              Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: Text(
                                  _error!,
                                  style: const TextStyle(
                                    color: Colors.redAccent,
                                    fontSize: 13,
                                  ),
                                ),
                              ),

                            GestureDetector(
                              onTap: _isSubmitting ? null : _submit,
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                decoration: BoxDecoration(
                                  gradient: const LinearGradient(
                                    colors: [
                                      Color(0xFFFF7A18),
                                      Color(0xFFFF9A00),
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(16),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFFFF7A18)
                                          .withValues(alpha: 0.4),
                                      blurRadius: 14,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Center(
                                  child: _isSubmitting
                                      ? const SizedBox(
                                          width: 22,
                                          height: 22,
                                          child: CircularProgressIndicator(
                                            strokeWidth: 2.5,
                                            color: Colors.white,
                                          ),
                                        )
                                      : const Text(
                                          'Submit Application',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontWeight: FontWeight.w800,
                                            fontSize: 15,
                                          ),
                                        ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 30),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildTextField({
    required String label,
    required TextEditingController controller,
    String? hint,
    int maxLines = 1,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
  }) {
    final isDark = context.isDark;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            color: isDark ? Colors.white.withValues(alpha: 0.87) : Colors.black87,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          maxLines: maxLines,
          keyboardType: keyboardType,
          validator: validator,
          style: TextStyle(color: isDark ? Colors.white : Colors.black87),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(
              color: isDark ? Colors.white30 : Colors.black38,
              fontSize: 13,
            ),
            filled: true,
            fillColor: isDark
                ? Colors.white.withValues(alpha: 0.05)
                : Colors.black.withValues(alpha: 0.03),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 14,
              vertical: 12,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.1)
                    : Colors.black.withValues(alpha: 0.1),
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: isDark
                    ? Colors.white.withValues(alpha: 0.1)
                    : Colors.black.withValues(alpha: 0.1),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(
                color: Color(0xFFFF7A18),
                width: 1.5,
              ),
            ),
          ),
        ),
      ],
    );
  }
}
