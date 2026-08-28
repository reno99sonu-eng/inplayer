import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/content_access_service.dart';
import '../../../../services/video_service.dart';
import '../../../auth/presentation/widgets/auth_modals.dart';

/// The website's two content-access switches, rendered directly in the
/// hamburger drawer. They control one server-enforced mode, never two
/// independent booleans:
///
/// * 18+ on => all
/// * 18+ off => family
/// * Kids on => kids
/// * Kids off => family
///
/// Only turning 18+ on opens the 6-digit passkey prompt. Switching to Kids
/// or back to Family only restricts what is visible, so it deliberately works
/// even when the viewer is signed out.
class ContentAccessDrawerSection extends ConsumerStatefulWidget {
  const ContentAccessDrawerSection({super.key});

  @override
  ConsumerState<ContentAccessDrawerSection> createState() =>
      _ContentAccessDrawerSectionState();
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

  bool get _signedIn => ref.read(authStateProvider) is AuthStateAuthenticated;

  void _notifyAudienceChanged() {
    VideoService.clearAudienceCaches();
    ref.read(contentAccessRevisionProvider.notifier).state++;
  }

  Future<void> _applyNarrowMode(AudienceMode next) async {
    if (_busy || _loading) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final result = await ref.read(contentAccessServiceProvider).setMode(next);
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (result.success) {
        _mode = next;
      } else {
        _error = result.error ?? 'Could not update content access.';
      }
    });
    if (result.success) _notifyAudienceChanged();
  }

  Future<void> _requestAdultMode() async {
    if (_busy || _loading) return;
    if (!_signedIn) {
      showSignInModal(context);
      return;
    }
    await _showAdultPasskeyDialog();
  }

  Future<void> _showAdultPasskeyDialog() async {
    final passkey = TextEditingController();
    final confirm = TextEditingController();
    final needsNewPasskey = !_hasPasskey;
    var busy = false;
    String? error;

    try {
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (dialogContext, setDialogState) {
            Future<void> unlock() async {
              if (busy || passkey.text.length != 6) return;
              if (needsNewPasskey && passkey.text != confirm.text) {
                setDialogState(() => error = 'The two passkeys do not match.');
                return;
              }

              setDialogState(() {
                busy = true;
                error = null;
              });
              final service = ref.read(contentAccessServiceProvider);
              if (needsNewPasskey) {
                final created = await service.setPasskey(passkey.text);
                if (!created.success) {
                  setDialogState(() {
                    busy = false;
                    error = created.error ?? 'Could not save the passkey.';
                  });
                  return;
                }
              }

              final result = await service.setMode(
                AudienceMode.all,
                passkey: passkey.text,
              );
              if (!result.success) {
                setDialogState(() {
                  busy = false;
                  error = result.error ?? 'Could not unlock 18+ content.';
                });
                return;
              }

              if (mounted) {
                setState(() {
                  _mode = AudienceMode.all;
                  _hasPasskey = true;
                });
                _notifyAudienceChanged();
              }
              if (dialogContext.mounted) Navigator.of(dialogContext).pop();
            }

            return AlertDialog(
              backgroundColor: dialogContext.bgModal,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(color: dialogContext.borderSubtle),
              ),
              title: Text(
                needsNewPasskey ? 'Create a passkey' : 'Enter your passkey',
                style: TextStyle(
                  color: dialogContext.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    needsNewPasskey
                        ? 'Pick 6 digits. You will need them whenever 18+ content is switched on.'
                        : 'Enter your 6-digit passkey to show 18+ content.',
                    style: TextStyle(
                      color: dialogContext.textSecondary,
                      fontSize: 12.5,
                    ),
                  ),
                  const SizedBox(height: 14),
                  _DrawerPasskeyField(
                    controller: passkey,
                    hint: needsNewPasskey ? 'New passkey' : 'Passkey',
                    autofocus: true,
                  ),
                  if (needsNewPasskey) ...[
                    const SizedBox(height: 10),
                    _DrawerPasskeyField(
                      controller: confirm,
                      hint: 'Confirm passkey',
                    ),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      error!,
                      style: const TextStyle(
                        color: AppColors.error,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: busy
                      ? null
                      : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: busy ? null : unlock,
                  child: busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : const Text('Unlock'),
                ),
              ],
            );
          },
        ),
      );
    } finally {
      passkey.dispose();
      confirm.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final adultOn = _mode == AudienceMode.all;
    final kidsOn = _mode == AudienceMode.kids;
    final waiting = _loading || _busy;

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
          icon: Icons.eighteen_up_rating_rounded,
          label: '18+ content',
          hint: _loading
              ? 'Checking...'
              : adultOn
              ? 'Showing everything, 18+ included'
              : '18+ hidden - passkey to unlock',
          value: adultOn,
          busy: waiting,
          onChanged: (enabled) => enabled
              ? _requestAdultMode()
              : _applyNarrowMode(AudienceMode.family),
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
          busy: waiting,
          onChanged: (enabled) => _applyNarrowMode(
            enabled ? AudienceMode.kids : AudienceMode.family,
          ),
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

class _DrawerToggleRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String hint;
  final bool value;
  final bool busy;
  final ValueChanged<bool> onChanged;

  const _DrawerToggleRow({
    required this.icon,
    required this.label,
    required this.hint,
    required this.value,
    required this.busy,
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
          onTap: busy ? null : () => onChanged(!value),
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
                        style: TextStyle(
                          color: context.textDim,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
                IgnorePointer(
                  child: Switch.adaptive(
                    value: value,
                    onChanged: busy ? null : onChanged,
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

class _DrawerPasskeyField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final bool autofocus;

  const _DrawerPasskeyField({
    required this.controller,
    required this.hint,
    this.autofocus = false,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      autofocus: autofocus,
      obscureText: true,
      keyboardType: TextInputType.number,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(6),
      ],
      textAlign: TextAlign.center,
      style: TextStyle(
        color: context.textPrimary,
        letterSpacing: 7,
        fontSize: 18,
      ),
      decoration: InputDecoration(hintText: hint),
    );
  }
}
