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
    return GestureDetector(
      onTapDown: (_) => setState(() => _isTapped = true),
      onTapUp: (_) {
        setState(() => _isTapped = false);
        context.push('/raftaar-films/${widget.series.seriesId}');
      },
      onTapCancel: () => setState(() => _isTapped = false),
      child: AnimatedScale(
        scale: _isTapped ? 0.95 : 1.0,
        duration: const Duration(milliseconds: 150),
        curve: Curves.easeOutCubic,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Colors.transparent, // Replaced by gradient border using ShaderMask or similar, but simpler: just a subtle color
            ),
            gradient: const LinearGradient(
              colors: [Color(0x33FF7A18), Color(0x11FF9A00)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFFFF7A18).withValues(alpha: _isTapped ? 0.3 : 0.15),
                blurRadius: _isTapped ? 16 : 8,
                offset: const Offset(0, 4),
              ),
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 8,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.15), width: 1),
            ),
            clipBehavior: Clip.antiAlias,
            child: AspectRatio(
              aspectRatio: 9 / 14,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  // Poster Image
                  widget.series.posterUrl.isNotEmpty
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
    
                  // Premium Gradient Overlay
                  Container(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          Colors.transparent,
                          const Color(0xFFFF7A18).withValues(alpha: 0.05),
                          Colors.black.withValues(alpha: 0.85),
                          Colors.black.withValues(alpha: 0.98),
                        ],
                        stops: const [0.35, 0.55, 0.80, 1.0],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
    
                  // Top Episode Badge
                  Positioned(
                    top: 10,
                    right: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: Colors.white.withValues(alpha: 0.20),
                          width: 0.5,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.play_arrow_rounded,
                            size: 13,
                            color: Color(0xFFFF9A00),
                          ),
                          const SizedBox(width: 3),
                          Text(
                            '${widget.series.episodeCount} ${widget.series.episodeCount == 1 ? "Ep" : "Eps"}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10.5,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
    
                  // Genre Badge on top left
                  if (widget.series.genre.isNotEmpty)
                    Positioned(
                      top: 10,
                      left: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFFF7A18).withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          widget.series.genre,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ),
                    ),
    
                  // Bottom Details
                  Positioned(
                    left: 10,
                    right: 10,
                    bottom: 10,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.series.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            height: 1.2,
                            shadows: [
                              Shadow(
                                color: Colors.black87,
                                blurRadius: 4,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            CircleAvatar(
                              radius: 9,
                              backgroundColor: Colors.white24,
                              backgroundImage: widget.series.creatorAvatarUrl.isNotEmpty
                                  ? CachedNetworkImageProvider(widget.series.creatorAvatarUrl)
                                  : null,
                              child: widget.series.creatorAvatarUrl.isEmpty
                                  ? const Icon(Icons.person, size: 10, color: Colors.white)
                                  : null,
                            ),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                widget.series.creatorName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  color: Colors.white70,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
