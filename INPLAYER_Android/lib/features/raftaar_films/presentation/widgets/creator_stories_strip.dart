import 'package:flutter/material.dart';
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
    return Container(
      height: 88,
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: Colors.white.withValues(alpha: 0.06)),
        ),
      ),
      child: ListView.separated(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        scrollDirection: Axis.horizontal,
        itemCount: creators.length + 1,
        separatorBuilder: (context, index) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          if (index == 0) {
            final isSelected = selectedCreatorId == null;
            return GestureDetector(
              onTap: () => onSelectCreator(null),
              child: SizedBox(
                width: 56,
                child: Column(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: isSelected
                            ? const LinearGradient(
                                colors: [Color(0xFFFF7A18), Color(0xFFFFB000)],
                              )
                            : null,
                        color: isSelected
                            ? null
                            : Colors.white.withValues(alpha: 0.07),
                        border: isSelected
                            ? null
                            : Border.all(
                                color: Colors.white.withValues(alpha: 0.15),
                              ),
                      ),
                      child: Text(
                        'ALL',
                        style: TextStyle(
                          color: isSelected
                              ? const Color(0xFF111111)
                              : Colors.white70,
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.4,
                        ),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Everyone',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: isSelected
                            ? FontWeight.w700
                            : FontWeight.w500,
                        color: isSelected
                            ? const Color(0xFFFF9A00)
                            : Colors.white54,
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          final creator = creators[index - 1];
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
              width: 56,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 48,
                    height: 48,
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
                              colors: [
                                Color(0xFFFF7A18),
                                Color(0xFFE50914),
                                Color(0xFFB81D24),
                              ],
                              begin: Alignment.topRight,
                              end: Alignment.bottomLeft,
                            ),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: const Color(
                                  0xFFFF7A18,
                                ).withValues(alpha: 0.5),
                                blurRadius: 10,
                                spreadRadius: 1,
                              ),
                            ]
                          : null,
                    ),
                    child: Container(
                      padding: const EdgeInsets.all(1.5),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.black,
                      ),
                      child: ClipOval(
                        child: SafeAppImage(
                          imageUrl: creator.creatorAvatarUrl,
                          fit: BoxFit.cover,
                          placeholder: (context, url) => Container(
                            color: Colors.grey[800],
                            child: const Icon(
                              Icons.person,
                              color: Colors.white54,
                              size: 24,
                            ),
                          ),
                          errorWidget: (context, url, error) => Container(
                            color: Colors.grey[800],
                            child: const Icon(
                              Icons.person,
                              color: Colors.white54,
                              size: 24,
                            ),
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
                      fontWeight: isSelected
                          ? FontWeight.w700
                          : FontWeight.w500,
                      color: isSelected
                          ? const Color(0xFFFF9A00)
                          : Colors.white70,
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
