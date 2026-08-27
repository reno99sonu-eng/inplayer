import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// Dedicated Contact Us screen — previously an expandable "CONTACT US"
/// section inline at the bottom of the hamburger drawer (MobileMenuDrawer).
/// Moved here per explicit request so the drawer just links out to a real
/// screen instead of expanding in place. Same three addresses, same
/// copy-to-clipboard behavior, just given a proper full-screen home.
class ContactUsPage extends StatefulWidget {
  const ContactUsPage({super.key});

  @override
  State<ContactUsPage> createState() => _ContactUsPageState();
}

class _ContactUsPageState extends State<ContactUsPage> {
  String? _copiedEmail;

  final List<Map<String, String>> _contactEmails = const [
    {'label': 'Contact', 'address': 'contact@inplayer.in'},
    {'label': 'Help', 'address': 'help@inplayer.in'},
    {'label': 'Support', 'address': 'support@inplayer.in'},
  ];

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
