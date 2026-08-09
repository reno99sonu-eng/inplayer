import 'package:flutter/material.dart';
import '../../../../core/theme/app_colors.dart';

class UploadPage extends StatelessWidget {
  const UploadPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      appBar: AppBar(
        backgroundColor: AppColors.backgroundDark,
        title: const Text(
          'Upload',
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
              Icons.cloud_upload_outlined,
              size: 64,
              color: AppColors.brandOrange.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 16),
            const Text(
              'Upload Content',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimaryDark,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Upload videos and shorts to share with the world',
              style: TextStyle(
                color: AppColors.textSecondaryDark,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: () {
                // TODO: Implement video upload
              },
              icon: const Icon(Icons.video_library),
              label: const Text('Upload Video'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(200, 48),
              ),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: () {
                // TODO: Implement short upload
              },
              icon: const Icon(Icons.play_circle),
              label: const Text('Upload Short'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size(200, 48),
              ),
            ),
          ],
        ),
      ),
    );
  }
}