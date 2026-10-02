import 'package:flutter/material.dart';

class GenreChipBar extends StatelessWidget {
  final List<String> genres;
  final String selectedGenre;
  final ValueChanged<String> onSelectGenre;

  const GenreChipBar({
    super.key,
    required this.genres,
    required this.selectedGenre,
    required this.onSelectGenre,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 42,
      child: ListView.separated(
        clipBehavior: Clip.none,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        scrollDirection: Axis.horizontal,
        itemCount: genres.length,
        separatorBuilder: (context, index) => const SizedBox(width: 6),
        itemBuilder: (context, index) {
          final genre = genres[index];
          final isSelected = genre == selectedGenre;

          return GestureDetector(
            onTap: () => onSelectGenre(genre),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 160),
              height: 30,
              padding: const EdgeInsets.symmetric(horizontal: 13),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: isSelected
                    ? const LinearGradient(
                        colors: [Color(0xFFFF7A18), Color(0xFFFF9A00)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: isSelected ? null : Colors.white.withValues(alpha: 0.06),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: isSelected
                      ? Colors.transparent
                      : Colors.white.withValues(alpha: 0.08),
                  width: 0.8,
                ),
              ),
              child: Center(
                child: Text(
                  genre,
                  style: TextStyle(
                    color: isSelected
                        ? const Color(0xFF111111)
                        : Colors.white70,
                    fontSize: 11.5,
                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w500,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
