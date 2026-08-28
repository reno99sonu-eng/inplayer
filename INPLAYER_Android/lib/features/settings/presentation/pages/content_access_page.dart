import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/content_access_service.dart';
import '../../../../services/video_service.dart';
import '../../../auth/presentation/widgets/auth_modals.dart';

/// Kept as a deep-link destination for older installs. The live controls are
/// now in the hamburger drawer, matching the website. Its behavior is kept
/// identical so an old bookmarked route cannot reintroduce a second policy.
class ContentAccessPage extends ConsumerStatefulWidget {
  const ContentAccessPage({super.key});

  @override
  ConsumerState<ContentAccessPage> createState() => _ContentAccessPageState();
}

class _ContentAccessPageState extends ConsumerState<ContentAccessPage> {
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

  void _announceChange() {
    VideoService.clearAudienceCaches();
    ref.read(contentAccessRevisionProvider.notifier).state++;
  }

  Future<void> _applyNarrowMode(AudienceMode mode) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final result = await ref.read(contentAccessServiceProvider).setMode(mode);
    if (!mounted) return;
    setState(() {
      _busy = false;
      if (result.success) {
        _mode = mode;
      } else {
        _error = result.error ?? 'Could not update content access.';
      }
    });
    if (result.success) _announceChange();
  }

  Future<void> _requestAdultMode() async {
    if (!_signedIn) {
      showSignInModal(context);
      return;
    }
    await _showPasskeyDialog(switchToAdult: true);
  }

  Future<void> _showPasskeyDialog({bool switchToAdult = false}) async {
    final passkey = TextEditingController();
    final confirm = TextEditingController();
    final current = TextEditingController();
    final needsNew = !_hasPasskey;
    final changingOnly = !switchToAdult;
    var busy = false;
    String? error;

    try {
      await showDialog<void>(
        context: context,
        builder: (dialogContext) => StatefulBuilder(
          builder: (dialogContext, setDialogState) {
            Future<void> submit() async {
              if (busy || passkey.text.length != 6) return;
              if (needsNew && passkey.text != confirm.text) {
                setDialogState(() => error = 'The two passkeys do not match.');
                return;
              }
              if (changingOnly && !needsNew && current.text.length != 6) {
                setDialogState(() => error = 'Enter your current passkey.');
                return;
              }

              setDialogState(() {
                busy = true;
                error = null;
              });
              final service = ref.read(contentAccessServiceProvider);
              if (needsNew || changingOnly) {
                final save = await service.setPasskey(
                  passkey.text,
                  currentPasskey: needsNew ? null : current.text,
                );
                if (!save.success) {
                  setDialogState(() {
                    busy = false;
                    error = save.error ?? 'Could not save the passkey.';
                  });
                  return;
                }
              }

              if (switchToAdult) {
                final unlock = await service.setMode(
                  AudienceMode.all,
                  passkey: passkey.text,
                );
                if (!unlock.success) {
                  setDialogState(() {
                    busy = false;
                    error = unlock.error ?? 'Could not unlock 18+ content.';
                  });
                  return;
                }
                if (mounted) {
                  setState(() {
                    _mode = AudienceMode.all;
                    _hasPasskey = true;
                  });
                  _announceChange();
                }
              } else if (mounted) {
                setState(() => _hasPasskey = true);
              }

              if (dialogContext.mounted) Navigator.of(dialogContext).pop();
            }

            final title = changingOnly
                ? (needsNew ? 'Create a passkey' : 'Change passkey')
                : (needsNew ? 'Create a passkey' : 'Enter your passkey');
            return AlertDialog(
              backgroundColor: dialogContext.bgModal,
              title: Text(title, style: TextStyle(color: dialogContext.textPrimary)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    switchToAdult
                        ? 'A 6-digit passkey is required only to show 18+ content.'
                        : 'Use a 6-digit passkey to protect 18+ content on this account.',
                    style: TextStyle(color: dialogContext.textSecondary, fontSize: 12.5),
                  ),
                  const SizedBox(height: 14),
                  if (changingOnly && !needsNew) ...[
                    _PasskeyField(controller: current, hint: 'Current passkey'),
                    const SizedBox(height: 10),
                  ],
                  _PasskeyField(
                    controller: passkey,
                    hint: needsNew ? 'New passkey' : 'Passkey',
                    autofocus: true,
                  ),
                  if (needsNew) ...[
                    const SizedBox(height: 10),
                    _PasskeyField(controller: confirm, hint: 'Confirm passkey'),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 10),
                    Text(error!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: busy ? null : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: busy ? null : submit,
                  child: busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(switchToAdult ? 'Unlock' : 'Save'),
                ),
              ],
            );
          },
        ),
      );
    } finally {
      passkey.dispose();
      confirm.dispose();
      current.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final adultVisible = _mode == AudienceMode.all;
    final kidsOnly = _mode == AudienceMode.kids;
    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(title: const Text('Content Access')),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 10),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 6, 16, 16),
            child: Text(
              'These controls are also available in the hamburger menu.',
              style: TextStyle(color: context.textSecondary, fontSize: 13),
            ),
          ),
          SwitchListTile(
            secondary: const Icon(Icons.eighteen_up_rating_rounded),
            title: const Text('18+ content'),
            subtitle: Text(
              adultVisible ? 'Showing all content, including 18+.' : '18+ content is hidden.',
            ),
            value: adultVisible,
            onChanged: _loading || _busy
                ? null
                : (enabled) => enabled
                    ? _requestAdultMode()
                    : _applyNarrowMode(AudienceMode.family),
          ),
          SwitchListTile(
            secondary: const Icon(Icons.child_care_rounded),
            title: const Text('Kids only'),
            subtitle: Text(
              kidsOnly ? 'Only Kids videos are visible.' : 'Limit InPlayer to Kids videos.',
            ),
            value: kidsOnly,
            onChanged: _loading || _busy
                ? null
                : (enabled) => _applyNarrowMode(
                    enabled ? AudienceMode.kids : AudienceMode.family,
                  ),
          ),
          if (_signedIn)
            ListTile(
              leading: const Icon(Icons.key_outlined),
              title: Text(_hasPasskey ? 'Change 18+ passkey' : 'Create 18+ passkey'),
              subtitle: const Text('Only required when showing 18+ content.'),
              onTap: _loading || _busy ? null : _showPasskeyDialog,
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(_error!, style: const TextStyle(color: AppColors.error)),
            ),
        ],
      ),
    );
  }
}

class _PasskeyField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final bool autofocus;

  const _PasskeyField({
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
      decoration: InputDecoration(hintText: hint),
    );
  }
}
