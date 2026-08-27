import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../providers/kid_mode_provider.dart';

class ParentalPinDialog extends ConsumerStatefulWidget {
  final String title;
  final String subtitle;
  final bool isSettingNewPin;
  final ValueChanged<bool>? onResult;

  const ParentalPinDialog({
    super.key,
    this.title = 'Parental Verification',
    this.subtitle = 'Enter your 4-digit PIN to exit Kids Safe Mode',
    this.isSettingNewPin = false,
    this.onResult,
  });

  static Future<bool> show(
    BuildContext context, {
    String? title,
    String? subtitle,
    bool isSettingNewPin = false,
  }) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => ParentalPinDialog(
        title: title ?? (isSettingNewPin ? 'Set Parental PIN' : 'Parental Verification'),
        subtitle: subtitle ??
            (isSettingNewPin
                ? 'Create a 4-digit PIN to secure Kids Safe Mode'
                : 'Enter your 4-digit PIN to exit Kids Safe Mode'),
        isSettingNewPin: isSettingNewPin,
      ),
    );
    return result ?? false;
  }

  @override
  ConsumerState<ParentalPinDialog> createState() => _ParentalPinDialogState();
}

class _ParentalPinDialogState extends ConsumerState<ParentalPinDialog> {
  String _pin = '';
  String? _error;

  void _onDigitPress(String digit) {
    if (_pin.length < 4) {
      setState(() {
        _pin += digit;
        _error = null;
      });
      if (_pin.length == 4) {
        _submitPin();
      }
    }
  }

  void _onDeletePress() {
    if (_pin.isNotEmpty) {
      setState(() {
        _pin = _pin.substring(0, _pin.length - 1);
        _error = null;
      });
    }
  }

  Future<void> _submitPin() async {
    final notifier = ref.read(kidModeProvider.notifier);
    if (widget.isSettingNewPin) {
      await notifier.setParentalPin(_pin);
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } else {
      final isValid = await notifier.verifyPin(_pin);
      if (isValid) {
        await notifier.setKidMode(false);
        if (mounted) {
          Navigator.of(context).pop(true);
        }
      } else {
        setState(() {
          _pin = '';
          _error = 'Incorrect PIN. Try again (Default: 0000)';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    return Dialog(
      backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: BorderSide(color: context.borderSubtle),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.brandOrange.withOpacity(0.15),
              ),
              child: const Icon(
                Icons.lock_person_rounded,
                color: AppColors.brandOrange,
                size: 28,
              ),
            ),
            const SizedBox(height: 16),
            Text(
              widget.title,
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              widget.subtitle,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: context.textSecondary,
                fontSize: 12,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            // PIN Dots Indicator
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(4, (index) {
                final filled = index < _pin.length;
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.symmetric(horizontal: 8),
                  width: 14,
                  height: 14,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: filled ? AppColors.brandOrange : context.borderSubtle,
                    border: Border.all(
                      color: filled ? AppColors.brandOrange : context.textDim,
                      width: 1.5,
                    ),
                  ),
                );
              }),
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(
                _error!,
                style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.w600),
              ),
            ],
            const SizedBox(height: 24),
            // Keypad
            _buildKeypad(context),
            const SizedBox(height: 12),
            TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: Text(
                'Cancel',
                style: TextStyle(color: context.textDim, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildKeypad(BuildContext context) {
    return Column(
      children: [
        for (var row = 0; row < 3; row++)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                for (var col = 1; col <= 3; col++)
                  _buildKeyButton((row * 3 + col).toString(), context),
              ],
            ),
          ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
          children: [
            const SizedBox(width: 60, height: 60),
            _buildKeyButton('0', context),
            SizedBox(
              width: 60,
              height: 60,
              child: IconButton(
                onPressed: _onDeletePress,
                icon: Icon(Icons.backspace_outlined, color: context.textSecondary),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildKeyButton(String val, BuildContext context) {
    final isDark = context.isDark;
    return Material(
      color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
      shape: const CircleBorder(),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _onDigitPress(val),
        child: SizedBox(
          width: 60,
          height: 60,
          child: Center(
            child: Text(
              val,
              style: TextStyle(
                color: context.textPrimary,
                fontSize: 22,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
