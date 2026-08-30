import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../providers/kid_mode_provider.dart';
import '../../../../services/content_access_service.dart';
import '../../../../services/video_service.dart';
import '../../../auth/presentation/widgets/auth_modals.dart';

/// The single source of truth for 18+ and Kids content controls in the
/// hamburger drawer. It mirrors the website's one-mode model:
///
/// * 18+ on = `all` (requires the account passkey)
/// * 18+ off = `family`
/// * Kids on = `kids`
/// * Kids off = `family`
/// Every transition is confirmed with the same account-owned six-digit passkey.
///
/// The passkey sheet is deliberately independent from this drawer state.
/// It only returns an input after its route is completely popped; network
/// requests and drawer updates happen afterwards. This avoids deactivating a
/// dependent drawer widget while a dialog is still mounted, the source of
/// Flutter's `_dependents.isEmpty` assertion on cancel/submit.
class ContentAccessDrawerSection extends ConsumerStatefulWidget {
  static const adultToggleKey = ValueKey<String>('content-access-adult-toggle');
  static const passkeyFieldKey = ValueKey<String>('content-access-passkey');
  static const confirmPasskeyFieldKey = ValueKey<String>(
    'content-access-confirm-passkey',
  );
  static const cancelKey = ValueKey<String>('content-access-cancel');
  static const continueKey = ValueKey<String>('content-access-continue');

  const ContentAccessDrawerSection({super.key});

  @override
  ConsumerState<ContentAccessDrawerSection> createState() =>
      _ContentAccessDrawerSectionState();
}

/// Kept separate from [authStateProvider] so the drawer can be exercised
/// without booting Cognito in a widget test. Production still derives this
/// directly from the live auth state.
final contentAccessSignedInProvider = Provider<bool>((ref) {
  return ref.watch(authStateProvider) is AuthStateAuthenticated;
});

/// Shared passkey prompt for startup age filtering and the drawer. It returns
/// only after the dialog's reverse transition has completed, so callers can
/// safely update providers and server-backed filters.
Future<({String passkey, bool createPasskey})?> showContentAccessPasskeyDialog(
  BuildContext context, {
  required bool needsNewPasskey,
}) async {
  final route = RawDialogRoute<_AdultUnlockRequest>(
    barrierDismissible: false,
    barrierLabel: 'Content access passkey',
    barrierColor: Colors.black.withValues(alpha: .68),
    transitionDuration: const Duration(milliseconds: 180),
    pageBuilder: (context, animation, secondaryAnimation) =>
        _AdultPasskeySheet(needsNewPasskey: needsNewPasskey),
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      final curve = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
      );
      return FadeTransition(
        opacity: curve,
        child: ScaleTransition(
          scale: Tween<double>(begin: .97, end: 1).animate(curve),
          child: child,
        ),
      );
    },
  );
  final navigator = Navigator.of(context, rootNavigator: true);
  final result = await navigator.push(route);
  await route.completed;
  if (result == null) return null;
  return (passkey: result.passkey, createPasskey: result.createPasskey);
}

class _ContentAccessDrawerSectionState
    extends ConsumerState<ContentAccessDrawerSection> {
  AudienceMode _mode = AudienceMode.family;
  bool _hasPasskey = false;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final access = await ref.read(contentAccessServiceProvider).getState();
    if (!mounted) return;
    setState(() {
      if (access != null) {
        _mode = access.mode;
        _hasPasskey = access.hasPasskey;
      }
      _loading = false;
    });
  }

  bool get _signedIn => ref.read(contentAccessSignedInProvider);

  void _applyAudienceChange(AudienceMode mode) {
    VideoService.clearAudienceCaches();
    ref.read(contentAccessRevisionProvider.notifier).state++;
    setState(() => _mode = mode);
    unawaited(
      ref.read(kidModeProvider.notifier).setKidMode(mode == AudienceMode.kids),
    );
  }

  Future<void> _exitKidsMode() async {
    await _setNarrowMode(AudienceMode.family);
  }

  Future<void> _enableKidsMode() async {
    await _setNarrowMode(AudienceMode.kids);
  }

  Future<void> _setNarrowMode(AudienceMode next) async {
    if (_loading || _busy) return;
    await _requestAdultMode(next);
  }

  Future<void> _requestAdultMode([
    AudienceMode target = AudienceMode.all,
  ]) async {
    if (_loading || _busy) return;
    if (!_signedIn) {
      showSignInModal(context);
      return;
    }

    // `Navigator.push` completes as soon as the route is popped, before its
    // reverse transition has removed the overlay. Retain the route and await
    // `completed` too: only then may this drawer update providers or state.
    // That keeps InheritedWidget dependents out of a deactivating dialog route,
    // including when the user presses Cancel.
    final route = RawDialogRoute<_AdultUnlockRequest>(
      barrierDismissible: false,
      barrierLabel: 'Content access passkey',
      barrierColor: Colors.black.withValues(alpha: .68),
      transitionDuration: const Duration(milliseconds: 180),
      pageBuilder: (context, animation, secondaryAnimation) =>
          _AdultPasskeySheet(needsNewPasskey: !_hasPasskey),
      transitionBuilder: (context, animation, secondaryAnimation, child) {
        final curve = CurvedAnimation(
          parent: animation,
          curve: Curves.easeOutCubic,
        );
        return FadeTransition(
          opacity: curve,
          child: ScaleTransition(
            scale: Tween<double>(begin: .97, end: 1).animate(curve),
            child: child,
          ),
        );
      },
    );
    final navigator = Navigator.of(context, rootNavigator: true);
    final request = await navigator.push(route);
    await route.completed;
    if (!mounted || request == null) return;

    setState(() {
      _busy = true;
      _error = null;
    });
    final service = ref.read(contentAccessServiceProvider);

    if (request.createPasskey) {
      final created = await service.setPasskey(request.passkey);
      if (!mounted) return;
      if (!created.success) {
        setState(() {
          _busy = false;
          _error = created.error ?? 'Could not save the passkey.';
        });
        return;
      }
      // The server has accepted the new code even if the subsequent mode
      // request is interrupted. Keep this truth locally so a retry asks for
      // the existing passkey instead of trying to create it a second time.
      if (mounted) setState(() => _hasPasskey = true);
    }

    final unlocked = await service.setMode(target, passkey: request.passkey);
    if (!mounted) return;
    setState(() => _busy = false);
    if (unlocked.success) {
      setState(() => _hasPasskey = true);
      _applyAudienceChange(target);
    } else {
      // A stale cached `hasPasskey` must not trap someone in a broken flow.
      // The server's 409 is authoritative, so offer create-passkey next time.
      setState(() {
        if (unlocked.needsPasskey) _hasPasskey = false;
        _error = unlocked.error ?? 'Could not update content access.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final adultOn = _mode == AudienceMode.all;
    final kidsOn = _mode == AudienceMode.kids;
    final disabled = _loading || _busy;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
          child: Text(
            'CONTENT',
            style: TextStyle(
              color: AppColors.brandOrangeLight,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 1.8,
            ),
          ),
        ),
        _DrawerToggleRow(
          key: ContentAccessDrawerSection.adultToggleKey,
          icon: Icons.eighteen_up_rating_rounded,
          label: '18+ content',
          hint: _loading
              ? 'Checking...'
              : adultOn
              ? 'Showing everything, 18+ included'
              : '18+ hidden - passkey to unlock',
          value: adultOn,
          disabled: disabled,
          onChanged: (enabled) => enabled
              ? _requestAdultMode()
              : _setNarrowMode(AudienceMode.family),
        ),
        _DrawerToggleRow(
          icon: Icons.child_care_rounded,
          label: 'Kids only',
          hint: _loading
              ? 'Checking...'
              : kidsOn
              ? 'Only Kids videos, everywhere'
              : 'Limit InPlayer to Kids videos',
          value: kidsOn,
          disabled: disabled,
          onChanged: (enabled) => enabled ? _enableKidsMode() : _exitKidsMode(),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 2),
            child: Text(
              _error!,
              style: const TextStyle(color: AppColors.error, fontSize: 11),
            ),
          ),
      ],
    );
  }
}

class _AdultUnlockRequest {
  final String passkey;
  final bool createPasskey;

  const _AdultUnlockRequest({
    required this.passkey,
    required this.createPasskey,
  });
}

/// Kept outside the drawer's state tree on purpose. It owns and disposes its
/// text controllers, returns only a plain value, and never reads a provider
/// or updates the drawer while its route is being removed.
class _AdultPasskeySheet extends StatefulWidget {
  final bool needsNewPasskey;

  const _AdultPasskeySheet({required this.needsNewPasskey});

  @override
  State<_AdultPasskeySheet> createState() => _AdultPasskeySheetState();
}

class _AdultPasskeySheetState extends State<_AdultPasskeySheet> {
  final _passkey = TextEditingController();
  final _confirmation = TextEditingController();
  String? _validationError;

  @override
  void dispose() {
    _passkey.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  void _submit() {
    final passkey = _passkey.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(passkey)) {
      setState(() => _validationError = 'Enter a 6-digit numeric passkey.');
      return;
    }
    if (widget.needsNewPasskey && passkey != _confirmation.text.trim()) {
      setState(() => _validationError = 'The two passkeys do not match.');
      return;
    }
    Navigator.of(context, rootNavigator: true).pop(
      _AdultUnlockRequest(
        passkey: passkey,
        createPasskey: widget.needsNewPasskey,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final surface = isDark ? const Color(0xFF07111F) : AppColors.surfaceLight;
    final textPrimary = isDark
        ? AppColors.textPrimaryDark
        : AppColors.textPrimaryLight;
    final textSecondary = isDark
        ? AppColors.textSecondaryDark
        : AppColors.textSecondaryLight;
    final border = isDark
        ? Colors.white.withValues(alpha: .12)
        : Colors.black.withValues(alpha: .10);

    return SafeArea(
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Material(
            color: surface,
            borderRadius: BorderRadius.circular(24),
            clipBehavior: Clip.antiAlias,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 380),
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.brandOrange.withValues(alpha: .14),
                          ),
                          child: Icon(
                            Icons.security_rounded,
                            color: AppColors.brandOrange,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                widget.needsNewPasskey
                                    ? 'Create a passkey'
                                    : 'Enter your passkey',
                                style: TextStyle(
                                  color: textPrimary,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                widget.needsNewPasskey
                                    ? 'Choose 6 digits to protect every content-mode change.'
                                    : 'Enter your 6-digit passkey to change the content filter.',
                                style: TextStyle(
                                  color: textSecondary,
                                  fontSize: 12.5,
                                  height: 1.35,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 20),
                    _PasskeyInput(
                      fieldKey: ContentAccessDrawerSection.passkeyFieldKey,
                      controller: _passkey,
                      hint: widget.needsNewPasskey ? 'New passkey' : 'Passkey',
                      autofocus: true,
                      onSubmitted: (_) => _submit(),
                    ),
                    if (widget.needsNewPasskey) ...[
                      const SizedBox(height: 10),
                      _PasskeyInput(
                        fieldKey:
                            ContentAccessDrawerSection.confirmPasskeyFieldKey,
                        controller: _confirmation,
                        hint: 'Confirm passkey',
                        onSubmitted: (_) => _submit(),
                      ),
                    ],
                    if (_validationError != null) ...[
                      const SizedBox(height: 10),
                      Text(
                        _validationError!,
                        style: const TextStyle(
                          color: AppColors.error,
                          fontSize: 12,
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            key: ContentAccessDrawerSection.cancelKey,
                            onPressed: () => Navigator.of(
                              context,
                              rootNavigator: true,
                            ).pop(),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: textPrimary,
                              side: BorderSide(color: border),
                              padding: const EdgeInsets.symmetric(vertical: 13),
                            ),
                            child: const Text('Cancel'),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: ElevatedButton(
                            key: ContentAccessDrawerSection.continueKey,
                            onPressed: _submit,
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 13),
                            ),
                            child: const Text('Continue'),
                          ),
                        ),
                      ],
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
}

class _PasskeyInput extends StatelessWidget {
  final Key? fieldKey;
  final TextEditingController controller;
  final String hint;
  final bool autofocus;
  final ValueChanged<String>? onSubmitted;

  const _PasskeyInput({
    this.fieldKey,
    required this.controller,
    required this.hint,
    this.autofocus = false,
    this.onSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return TextField(
      key: fieldKey,
      controller: controller,
      autofocus: autofocus,
      obscureText: true,
      keyboardType: TextInputType.number,
      textInputAction: TextInputAction.done,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(6),
      ],
      textAlign: TextAlign.center,
      style: TextStyle(
        color: isDark ? AppColors.textPrimaryDark : AppColors.textPrimaryLight,
        letterSpacing: 7,
        fontSize: 18,
      ),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(letterSpacing: 0, fontSize: 13),
        contentPadding: const EdgeInsets.symmetric(vertical: 13),
      ),
      onSubmitted: onSubmitted,
    );
  }
}

class _DrawerToggleRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String hint;
  final bool value;
  final bool disabled;
  final ValueChanged<bool> onChanged;

  const _DrawerToggleRow({
    super.key,
    required this.icon,
    required this.label,
    required this.hint,
    required this.value,
    required this.disabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: disabled ? null : () => onChanged(!value),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
            child: Row(
              children: [
                Icon(icon, color: context.textSecondary, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        label,
                        style: TextStyle(
                          color: context.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        hint,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: context.textDim, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                IgnorePointer(
                  child: Switch.adaptive(
                    value: value,
                    onChanged: disabled ? null : onChanged,
                    activeThumbColor: AppColors.brandOrange,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
