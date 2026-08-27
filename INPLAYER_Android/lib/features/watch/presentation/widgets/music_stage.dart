import 'dart:ui';
import 'package:flutter/material.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/utils/music_track_utils.dart';
import '../../../../models/lyric_line.dart';

class MusicStage extends StatefulWidget {
  final List<String> covers;
  final int coverIntervalSeconds;
  final List<LyricLine> lyrics;
  final double currentTime;
  final double? durationSeconds;
  final String title;
  final String? artist;

  const MusicStage({
    super.key,
    required this.covers,
    this.coverIntervalSeconds = 12,
    required this.lyrics,
    required this.currentTime,
    this.durationSeconds,
    required this.title,
    this.artist,
  });

  @override
  State<MusicStage> createState() => _MusicStageState();
}

class _MusicStageState extends State<MusicStage> {
  final ScrollController _scrollController = ScrollController();
  int _lastActiveIndex = -1;

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToActive(int index) {
    if (index == _lastActiveIndex || !_scrollController.hasClients || index < 0) return;
    _lastActiveIndex = index;

    // Approximate height per line ~48px
    const itemExtent = 48.0;
    final targetOffset = (index * itemExtent) - 100.0;
    _scrollController.animateTo(
      targetOffset.clamp(0.0, _scrollController.position.maxScrollExtent),
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final safeCovers = widget.covers.where((c) => c.isNotEmpty).toList();
    final targetCoverIndex = coverIndexAt(widget.currentTime, safeCovers.length, widget.coverIntervalSeconds);
    final activeIndex = activeLyricIndex(widget.lyrics, widget.currentTime);
    final hasLyrics = widget.lyrics.isNotEmpty;
    final sweep = lyricLineProgress(
      widget.lyrics,
      activeIndex,
      widget.currentTime,
      durationSeconds: widget.durationSeconds,
    );

    if (hasLyrics && activeIndex >= 0 && activeIndex != _lastActiveIndex) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToActive(activeIndex));
    }

    final currentCoverUrl = safeCovers.isNotEmpty ? safeCovers[targetCoverIndex % safeCovers.length] : null;

    return Stack(
      fit: StackFit.expand,
      children: [
        // Ambient wash
        if (currentCoverUrl != null)
          Positioned.fill(
            child: AnimatedSwitcher(
              duration: const Duration(milliseconds: 1800),
              child: Image(
                key: ValueKey(currentCoverUrl),
                image: smartImageProvider(currentCoverUrl)!,
                fit: BoxFit.cover,
                width: double.infinity,
                height: double.infinity,
              ),
            ),
          )
        else
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [Color(0xFF1A0F05), Color(0xFF090B10), Color(0xFF040609)],
              ),
            ),
          ),

        // Blur backdrop
        Positioned.fill(
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 36, sigmaY: 36),
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.55),
                    Colors.black.withValues(alpha: 0.35),
                    Colors.black.withValues(alpha: 0.75),
                  ],
                ),
              ),
            ),
          ),
        ),

        // Stage Content (Cover Art Sleeve + Lyrics)
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 60),
            child: hasLyrics
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Sleeve
                      _buildSleeve(safeCovers, targetCoverIndex, isCompact: true),
                      const SizedBox(width: 16),
                      // Lyrics list
                      Expanded(
                        child: _buildLyricsList(activeIndex, sweep),
                      ),
                    ],
                  )
                // Wrapped in FittedBox(scaleDown) as a safety margin: this
                // Column sits inside a fixed-height SafeArea/Padding/Stack
                // chain with no scroll fallback, so on short screens or with
                // long titles it could exceed the available height. Whenever
                // there's already enough room (the common case) the scale
                // factor is 1.0 and nothing visually changes; it only
                // shrinks proportionally, never clips, if it would have
                // overflowed.
                : FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Column(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      _buildSleeve(safeCovers, targetCoverIndex, isCompact: false),
                      const SizedBox(height: 20),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              widget.title,
                              textAlign: TextAlign.center,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.5,
                                shadows: [Shadow(color: Colors.black87, blurRadius: 16)],
                              ),
                            ),
                            if (widget.artist != null && widget.artist!.isNotEmpty) ...[
                              const SizedBox(height: 4),
                              Text(
                                widget.artist!,
                                textAlign: TextAlign.center,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.75),
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                    ),
                  ),
          ),
        ),
      ],
    );
  }

  Widget _buildSleeve(List<String> covers, int targetIndex, {required bool isCompact}) {
    final size = isCompact ? 140.0 : 220.0;
    final currentUrl = covers.isNotEmpty ? covers[targetIndex % covers.length] : null;

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.65),
                  blurRadius: 32,
                  spreadRadius: 4,
                  offset: const Offset(0, 16),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: currentUrl != null
                  ? AnimatedSwitcher(
                      duration: const Duration(milliseconds: 1800),
                      child: Image(
                        key: ValueKey(currentUrl),
                        image: smartImageProvider(currentUrl)!,
                        fit: BoxFit.cover,
                        width: size,
                        height: size,
                      ),
                    )
                  : Container(
                      decoration: const BoxDecoration(
                        gradient: LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [Color(0xFFE8590C), Color(0xFF1E1E1E)],
                        ),
                      ),
                      child: const Center(
                        child: Icon(Icons.music_note_rounded, color: Colors.white70, size: 54),
                      ),
                    ),
            ),
          ),
          if (covers.length > 1) ...[
            const SizedBox(height: 10),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: List.generate(covers.length, (i) {
                final isSelected = i == (targetIndex % covers.length);
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 500),
                  margin: const EdgeInsets.symmetric(horizontal: 2.5),
                  width: isSelected ? 16 : 5,
                  height: 5,
                  decoration: BoxDecoration(
                    color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.35),
                    borderRadius: BorderRadius.circular(3),
                  ),
                );
              }),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildLyricsList(int activeIndex, double sweep) {
    return Stack(
      children: [
        ListView.builder(
          controller: _scrollController,
          padding: const EdgeInsets.symmetric(vertical: 60),
          itemCount: widget.lyrics.length,
          itemBuilder: (context, i) {
            final line = widget.lyrics[i];
            final isActive = i == activeIndex;
            final distance = (i - activeIndex).abs();

            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 300),
                style: TextStyle(
                  fontSize: isActive ? 20 : (distance == 1 ? 16 : 14),
                  fontWeight: isActive ? FontWeight.w900 : FontWeight.w600,
                  letterSpacing: -0.3,
                  height: 1.3,
                  color: isActive
                      ? Colors.white
                      : (distance == 1 ? Colors.white.withValues(alpha: 0.5) : Colors.white.withValues(alpha: 0.22)),
                ),
                child: isActive
                    ? ShaderMask(
                        shaderCallback: (bounds) {
                          return LinearGradient(
                            begin: Alignment.centerLeft,
                            end: Alignment.centerRight,
                            colors: [
                              Colors.white,
                              Colors.white,
                              Colors.white.withValues(alpha: 0.4),
                              Colors.white.withValues(alpha: 0.4),
                            ],
                            stops: [
                              0.0,
                              sweep.clamp(0.0, 1.0),
                              (sweep + 0.04).clamp(0.0, 1.0),
                              1.0,
                            ],
                          ).createShader(bounds);
                        },
                        child: Text(
                          line.text,
                          style: const TextStyle(
                            color: Colors.white,
                            shadows: [Shadow(color: Colors.black87, blurRadius: 16)],
                          ),
                        ),
                      )
                    : Text(line.text),
              ),
            );
          },
        ),

        // Feathered top / bottom masks
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 48,
          child: IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [Colors.black.withValues(alpha: 0.7), Colors.transparent],
                ),
              ),
            ),
          ),
        ),
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          height: 48,
          child: IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Colors.black.withValues(alpha: 0.7), Colors.transparent],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
