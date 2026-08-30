import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../models/admin_platform_settings.dart';
import '../../../../services/admin_service.dart';

/// Dedicated Contact Us screen. The values are read from the backend platform
/// settings so the app stays in sync with the admin panel immediately when the
/// mail config changes there. The inplayer-specific addresses are kept as a
/// fallback if the server has not yet published new values.
class ContactUsPage extends ConsumerStatefulWidget {
  const ContactUsPage({super.key});

  @override
  ConsumerState<ContactUsPage> createState() => _ContactUsPageState();
}

class _ContactUsPageState extends ConsumerState<ContactUsPage> {
  String? _copiedEmail;
  bool _loading = true;
  List<Map<String, String>> _contactEmails = const [
    {'label': 'Hammart', 'address': 'Hammart@inplayer.in'},
    {'label': 'MillonBook', 'address': 'Millonbook@inplayer.in'},
    {'label': 'Sponsor / Banner Specs', 'address': 'Sponsor@inplayer.in'},
    {'label': 'InPlayer Digital', 'address': 'inplayerdigital@gmail.com'},
  ];

  @override
  void initState() {
    super.initState();
    _loadPlatformEmails();
  }

  Future<void> _loadPlatformEmails() async {
    final settings = await ref.read(adminServiceProvider).getPlatformSettings();
    if (!mounted) return;

    setState(() {
      _loading = false;
      _contactEmails = _buildContactEmails(settings);
    });
  }

  List<Map<String, String>> _buildContactEmails(AdminPlatformSettings? settings) {
    final emails = settings?.contactEmails ?? const <PlatformContactEmail>[];
    if (emails.isNotEmpty) {
      return emails
          .where((email) => email.address.trim().isNotEmpty)
          .map((email) => {'label': email.label, 'address': email.address})
          .toList();
    }

    final fallback = <String, String>{
      'Hammart': 'Hammart@inplayer.in',
      'MillonBook': 'Millonbook@inplayer.in',
      'Sponsor / Banner Specs': 'Sponsor@inplayer.in',
      'InPlayer Digital': 'inplayerdigital@gmail.com',
    };

    return fallback.entries.map((entry) => {'label': entry.key, 'address': entry.value}).toList();
  }

  void _copyEmail(String address) {
    Clipboard.setData(ClipboardData(text: address));
    setState(() => _copiedEmail = address);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Copied $address to clipboard'),
        backgroundColor: const Color(0xFF10B981),
        duration: const Duration(seconds: 2),
      ),
    );
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copiedEmail = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    final isDark = context.isDark;

    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        title: Text('Contact Us', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.w800, fontSize: 19)),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          Text(
            "Reach out and we'll get back to you as soon as we can.",
            style: TextStyle(color: context.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 18),
          if (_loading)
            const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
              ),
            )
          else
            ..._contactEmails.map((contact) {
              final isCopied = _copiedEmail == contact['address'];
              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: isDark ? Colors.white.withValues(alpha: 0.04) : Colors.black.withValues(alpha: 0.03),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: context.borderSubtle),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(contact['label']!, style: const TextStyle(color: AppColors.brandOrangeLight, fontSize: 11, fontWeight: FontWeight.bold)),
                          const SizedBox(height: 2),
                          Text(contact['address']!, style: TextStyle(color: context.textPrimary, fontSize: 14, fontWeight: FontWeight.w600)),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(isCopied ? Icons.check : Icons.copy, size: 18, color: isCopied ? const Color(0xFF10B981) : context.textSecondary),
                      onPressed: () => _copyEmail(contact['address']!),
                    ),
                  ],
                ),
              );
            }),
        ],
      ),
    );
  }
}
