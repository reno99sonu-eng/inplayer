import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import '../../../../models/film_series.dart';

class SeriesCardWidget extends StatefulWidget {
  final FilmSeries series;

  const SeriesCardWidget({
    super.key,
    required this.series,
  });

  @override
  State<SeriesCardWidget> createState() => _SeriesCardWidgetState();
}

class _SeriesCardWidgetState extends State<SeriesCardWidget> {
  bool _isTapped = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTapDown: (_) => setState(() => _isTapped = true),
      onTapUp: (_) {
        setState(() => _isTapped = false);
        context.push('/raftaar-films/${widget.series.seriesId}');
      },
      onTapCancel: () => setState(() => _isTapped = false),
      child: AnimatedScale(
        scale: _isTapped ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOutCubic,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Poster Image Container (Clean artwork without text or badges)
            AspectRatio(
              aspectRatio: 9 / 14,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.12),
                    width: 0.8,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.4),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                    BoxShadow(
                      color: const Color(0xFFFF7A18).withValues(alpha: _isTapped ? 0.25 : 0.08),
                      blurRadius: _isTapped ? 14 : 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: widget.series.posterUrl.isNotEmpty
                    ? CachedNetworkImage(
                        imageUrl: widget.series.posterUrl,
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          color: const Color(0xFF1E1E26),
                          child: const Center(
                            child: Icon(Icons.movie_outlined, color: Colors.white24, size: 36),
                          ),
                        ),
                        errorWidget: (context, url, error) => Container(
                          color: const Color(0xFF1E1E26),
                          child: const Center(
                            child: Icon(Icons.broken_image_outlined, color: Colors.white24, size: 36),
                          ),
                        ),
                      )
                    : Container(
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [Color(0xFF2A0845), Color(0xFF6441A5)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                        ),
                        child: const Center(
                          child: Icon(Icons.movie_outlined, color: Colors.white30, size: 40),
                        ),
                      ),
              ),
            ),
            const SizedBox(height: 7),
            // Title (Matching Image 2: Bold, clean, line-clamp 1)
            Text(
              widget.series.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black.withValues(alpha: 0.87),
                fontSize: 13.0,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.2,
              ),
            ),
            const SizedBox(height: 2),
            // Episodes (Matching Image 2: lowercase "episodes")
            Text(
              '${widget.series.episodeCount} ${widget.series.episodeCount == 1 ? "episode" : "episodes"}',
              style: TextStyle(
                color: isDark ? Colors.white.withValues(alpha: 0.6) : Colors.black.withValues(alpha: 0.54),
                fontSize: 11.5,
                fontWeight: FontWeight.w400,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
