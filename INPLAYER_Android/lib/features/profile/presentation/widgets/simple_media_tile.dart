import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/image_utils.dart';

class SimpleMediaTile extends StatelessWidget {
  final String videoId;
  final String title;
  final String? thumbnailUrl;
  final String timeLabel;
  final VoidCallback? onRemove;

  const SimpleMediaTile({
    super.key,
    required this.videoId,
    required this.title,
    this.thumbnailUrl,
    required this.timeLabel,
    this.onRemove,
  });

  @override
  Widget build(BuildContext context) {
    final provider =
        thumbnailUrl != null && thumbnailUrl!.isNotEmpty ? smartImageProvider(thumbnailUrl!) : null;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: videoId.isEmpty ? null : () => context.push('/watch/$videoId'),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: Container(
                  width: 120,
                  height: 68,
                  color: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                  child: provider != null
                      ? Image(image: provider, fit: BoxFit.cover)
                      : Icon(Icons.play_circle_outline,
                          color: context.textDim, size: 28),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title.isEmpty ? 'Untitled video' : title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: context.textPrimary,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        height: 1.25,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      timeLabel,
                      style: TextStyle(
                        color: context.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              if (onRemove != null)
                IconButton(
                  icon: Icon(Icons.close,
                      size: 18, color: context.textDim),
                  onPressed: onRemove,
                ),
            ],
          ),
        ),
      ),
    );
  }
}
