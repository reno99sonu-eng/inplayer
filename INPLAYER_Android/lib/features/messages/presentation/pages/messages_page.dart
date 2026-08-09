import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class MessagesPage extends StatelessWidget {
  const MessagesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        title: const Text(
          'Messages',
          style: TextStyle(
            fontWeight: FontWeight.bold,
            color: AppColors.textPrimaryDark,
          ),
        ),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.message_outlined,
              size: 64,
              color: AppColors.textSecondaryDark.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 16),
            const Text(
              'No messages yet',
              style: TextStyle(
                color: AppColors.textSecondaryDark,
                fontSize: 16,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Messages from creators will appear here',
              style: TextStyle(
                color: AppColors.textSecondaryDark.withValues(alpha: 0.7),
                fontSize: 14,
              ),
            ),
          ],
        ),
      ),
    );
  }
}