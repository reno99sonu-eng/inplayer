import 'package:flutter/material.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/utils/image_utils.dart';

class CreatorStoryItem {
  final String creatorId;
  final String creatorName;
  final String creatorAvatarUrl;
  final String creatorHandle;

  CreatorStoryItem({
    required this.creatorId,
    required this.creatorName,
    required this.creatorAvatarUrl,
    required this.creatorHandle,
  });
}

class CreatorStoriesStrip extends StatelessWidget {
  final List<CreatorStoryItem> creators;
  final String? selectedCreatorId;
  final ValueChanged<String?> onSelectCreator;

  const CreatorStoriesStrip({
    super.key,
    required this.creators,
    this.selectedCreatorId,
    required this.onSelectCreator,
  });

  @override
  Widget build(BuildContext context) {
    if (creators.isEmpty) return const SizedBox.shrink();
    final isDark = context.isDark;

    return SizedBox(
      height: 96,
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        scrollDirection: Axis.horizontal,
        itemCount: creators.length,
        separatorBuilder: (context, index) => const SizedBox(width: 14),
        itemBuilder: (context, index) {
          final creator = creators[index];
          final isSelected = creator.creatorId == selectedCreatorId;

          return GestureDetector(
            onTap: () {
              if (isSelected) {
                onSelectCreator(null);
              } else {
                onSelectCreator(creator.creatorId);
              }
            },
            child: SizedBox(
              width: 68,
              child: Column(
                 mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 60,
                    height: 60,
                    padding: const EdgeInsets.all(2.5),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: isSelected
                          ? const LinearGradient(
                              colors: [Color(0xFFFF7A18), Color(0xFFFF9A00)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            )
                          : const LinearGradient(
                              colors: [Color(0xFFFF7A18), Color(0xFFE50914), Color(0xFFB81D24)],
                              begin: Alignment.topRight,
                              end: Alignment.bottomLeft,
                            ),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: const Color(0xFFFF7A18).withValues(alpha: 0.5),
                                blurRadius: 10,
                                spreadRadius: 1,
                              )
                            ]
                          : null,
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(1.5),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isDark ? Colors.black : Colors.white,
                      ),
                      child: ClipOval(
                        child: SafeAppImage(
                          imageUrl: creator.creatorAvatarUrl,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(
                            color: Colors.grey[800],
                            child: const Icon(Icons.person, color: Colors.white54, size: 24),
                          ),
                          errorWidget: (context, url, error) => Container(
                            color: Colors.grey[800],
                            child: const Icon(Icons.person, color: Colors.white54, size: 24),
                          ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    creator.creatorName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                      color: isSelected
                          ? const Color(0xFFFF7A18)
                          : (isDark ? Colors.white70 : Colors.black87),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
