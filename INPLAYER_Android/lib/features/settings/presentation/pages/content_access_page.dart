import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/content_access_service.dart';
import '../../../auth/presentation/widgets/auth_modals.dart';

/// The real version of what used to be two disconnected, non-functional
/// stand-ins elsewhere in the app: a local-only "18+ Content" switch on
/// this same Settings page that wrote the wrong value strings to the wrong
/// place, and a pair of Switches inside the hamburger drawer that never
/// persisted or sent anything anywhere. Ported row-for-row from the
/// website's own Settings > General > Content Access
/// (app/components/settings/sections/ContentAccessSection.tsx) — the mode
/// itself lives in a server-set HttpOnly cookie no client script can
/// forge, and every change is authorised by a 6-digit passkey hashed
/// against the account, so this screen can only ever ASK the server to
/// change something, same as the website.
class ContentAccessPage extends ConsumerStatefulWidget {
  const ContentAccessPage({super.key});

  @override
  ConsumerState<ContentAccessPage> createState() => _ContentAccessPageState();
}

enum _PendingKind { mode, newPasskey, changePasskey }

class _Pending {
  final _PendingKind kind;
  final AudienceMode? mode;
  const _Pending(this.kind, {this.mode});
}

class _ContentAccessPageState extends ConsumerState<ContentAccessPage> {
  AudienceMode _mode = AudienceMode.family;
  bool _hasPasskey = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final state = await ref.read(contentAccessServiceProvider).getState();
    if (!mounted) return;
    setState(() {
      if (state != null) {
        _mode = state.mode;
        _hasPasskey = state.hasPasskey;
      }
      _loading = false;
    });
  }

  bool get _signedIn => ref.read(authStateProvider) is AuthStateAuthenticated;

  void _requestMode(AudienceMode next) {
    if (!_signedIn) {
      showSignInModal(context);
      return;
    }
    _openPasskeyDialog(
      _hasPasskey ? _Pending(_PendingKind.mode, mode: next) : _Pending(_PendingKind.newPasskey, mode: next),
    );
  }

  Future<void> _openPasskeyDialog(_Pending pending) async {
    final passkeyController = TextEditingController();
    final confirmController = TextEditingController();
    final currentController = TextEditingController();
    bool busy = false;
    String? error;

    await showDialog<void>(
      context: context,
      builder: (dialogCtx) {
        return StatefulBuilder(
          builder: (dialogCtx, setDialogState) {
            Future<void> submit() async {
              if (busy) return;
              setDialogState(() {
                busy = true;
                error = null;
              });

              try {
                if (pending.kind == _PendingKind.mode) {
                  final result = await ref
                      .read(contentAccessServiceProvider)
                      .setMode(pending.mode!, passkeyController.text);
                  if (!result.success) throw Exception(result.error ?? 'Something went wrong.');
                  setState(() => _mode = pending.mode!);
                } else {
                  if (passkeyController.text != confirmController.text) {
                    throw Exception("Those two passkeys don't match.");
                  }
                  final result = await ref.read(contentAccessServiceProvider).setPasskey(
                        passkeyController.text,
                        currentPasskey: pending.kind == _PendingKind.changePasskey ? currentController.text : null,
                      );
                  if (!result.success) throw Exception(result.error ?? "Couldn't save that passkey.");
                  setState(() => _hasPasskey = true);

                  if (pending.kind == _PendingKind.newPasskey && pending.mode != null) {
                    final modeResult = await ref
                        .read(contentAccessServiceProvider)
                        .setMode(pending.mode!, passkeyController.text);
                    if (modeResult.success) {
                      setState(() => _mode = pending.mode!);
                    }
                  }
                }

                if (dialogCtx.mounted) Navigator.of(dialogCtx).pop();
              } catch (e) {
                setDialogState(() {
                  busy = false;
                  error = e.toString().replaceFirst('Exception: ', '');
                });
              }
            }

            final title = pending.kind == _PendingKind.mode
                ? 'Enter your passkey'
                : pending.kind == _PendingKind.changePasskey
                    ? 'Change your passkey'
                    : 'Create a passkey';
            final subtitle = pending.kind == _PendingKind.mode
                ? 'Enter your 6-digit passkey to change what content is shown.'
                : "Pick 6 digits. You'll need them any time this setting is changed, on any device.";

            return AlertDialog(
              backgroundColor: dialogCtx.bgModal,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: BorderSide(color: dialogCtx.borderSubtle),
              ),
              title: Text(title, style: TextStyle(color: dialogCtx.textPrimary, fontWeight: FontWeight.bold)),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(subtitle, style: TextStyle(color: dialogCtx.textSecondary, fontSize: 12.5)),
                  const SizedBox(height: 16),
                  if (pending.kind == _PendingKind.changePasskey) ...[
                    _PasskeyField(
                      controller: currentController,
                      hint: 'Current passkey',
                      onChanged: (_) => setDialogState(() {}),
                    ),
                    const SizedBox(height: 10),
                  ],
                  _PasskeyField(
                    controller: passkeyController,
                    hint: pending.kind == _PendingKind.mode ? 'Passkey' : 'New passkey',
                    onChanged: (_) => setDialogState(() {}),
                    autofocus: true,
                  ),
                  if (pending.kind != _PendingKind.mode) ...[
                    const SizedBox(height: 10),
                    _PasskeyField(
                      controller: confirmController,
                      hint: 'Confirm passkey',
                      onChanged: (_) => setDialogState(() {}),
                    ),
                  ],
                  if (error != null) ...[
                    const SizedBox(height: 10),
                    Text(error!, style: const TextStyle(color: AppColors.error, fontSize: 12)),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: busy ? null : () => Navigator.of(dialogCtx).pop(),
                  child: Text('Cancel', style: TextStyle(color: dialogCtx.textSecondary)),
                ),
                ElevatedButton(
                  onPressed: busy || passkeyController.text.length != 6 ? null : submit,
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange),
                  child: busy
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          pending.kind == _PendingKind.mode ? 'Unlock' : 'Save passkey',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        title: Text(
          'Content Access',
          style: TextStyle(fontWeight: FontWeight.w800, color: context.textPrimary, fontSize: 20),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 8),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Text(
              'Control which content is shown across InPlayer, locked with a 6-digit passkey.',
              style: TextStyle(color: context.textSecondary, fontSize: 13),
            ),
          ),
          SwitchListTile(
            secondary: Icon(Icons.shield_outlined, color: context.textPrimary, size: 22),
            title: Text('Show 18+ content', style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
            subtitle: Text(
              _loading
                  ? 'Checking…'
                  : _mode == AudienceMode.all
                      ? '18+ videos are visible everywhere on InPlayer.'
                      : '18+ videos are hidden from every feed, search result and direct link.',
              style: TextStyle(color: context.textSecondary, fontSize: 12),
            ),
            activeThumbColor: AppColors.brandOrange,
            value: _mode == AudienceMode.all,
            onChanged: _loading ? null : (checked) => _requestMode(checked ? AudienceMode.all : AudienceMode.family),
          ),
          SwitchListTile(
            secondary: Icon(Icons.face_outlined, color: context.textPrimary, size: 22),
            title: Text('Kids content only', style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
            subtitle: Text(
              _loading
                  ? 'Checking…'
                  : _mode == AudienceMode.kids
                      ? 'Only videos a creator marked as Kids can be seen or played.'
                      : 'Turn on to limit InPlayer to Kids content and nothing else.',
              style: TextStyle(color: context.textSecondary, fontSize: 12),
            ),
            activeThumbColor: AppColors.brandOrange,
            value: _mode == AudienceMode.kids,
            onChanged: _loading ? null : (checked) => _requestMode(checked ? AudienceMode.kids : AudienceMode.family),
          ),
          ListTile(
            leading: Icon(Icons.key_outlined, color: context.textPrimary, size: 22),
            title: Text(
              _hasPasskey ? 'Change passkey' : 'Create passkey',
              style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w600),
            ),
            subtitle: Text(
              _hasPasskey ? 'Required to change either setting above.' : "You'll be asked to set one the first time you change a setting above.",
              style: TextStyle(color: context.textSecondary, fontSize: 12),
            ),
            trailing: _loading
                ? null
                : Text(audienceModeLabel(_mode), style: const TextStyle(color: AppColors.brandOrange, fontSize: 11.5, fontWeight: FontWeight.w600)),
            onTap: () {
              if (!_signedIn) {
                showSignInModal(context);
                return;
              }
              _openPasskeyDialog(_Pending(_hasPasskey ? _PendingKind.changePasskey : _PendingKind.newPasskey));
            },
          ),
          if (!_signedIn && !_loading)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 4),
              child: Text(
                'Sign in to change these — signed-out viewing always hides 18+ content.',
                style: TextStyle(color: context.textDim, fontSize: 11.5),
              ),
            ),
        ],
      ),
    );
  }
}

class _PasskeyField extends StatelessWidget {
  final TextEditingController controller;
  final String hint;
  final ValueChanged<String> onChanged;
  final bool autofocus;

  const _PasskeyField({
    required this.controller,
    required this.hint,
    required this.onChanged,
    this.autofocus = false,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      autofocus: autofocus,
      obscureText: true,
      keyboardType: TextInputType.number,
      inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
      textAlign: TextAlign.center,
      style: TextStyle(color: context.textPrimary, fontSize: 18, letterSpacing: 8),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(color: context.textDim, letterSpacing: 0, fontSize: 13),
        filled: true,
        fillColor: context.bgCard,
        contentPadding: const EdgeInsets.symmetric(vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: context.borderSubtle),
        ),
      ),
      onChanged: onChanged,
    );
  }
}
