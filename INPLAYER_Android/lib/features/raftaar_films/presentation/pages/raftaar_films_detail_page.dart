import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../models/film_series.dart';
import '../../../../models/film_episode.dart';
import '../../../../services/raftaar_films_service.dart';
import '../../../../providers/auth_provider.dart';

class RaftaarFilmsDetailPage extends ConsumerStatefulWidget {
  final String seriesId;

  const RaftaarFilmsDetailPage({
    super.key,
    required this.seriesId,
  });

  @override
  ConsumerState<RaftaarFilmsDetailPage> createState() =>
      _RaftaarFilmsDetailPageState();
}

class _RaftaarFilmsDetailPageState
    extends ConsumerState<RaftaarFilmsDetailPage> {
  FilmSeries? _series;
  List<FilmEpisode> _episodes = [];
  bool _isLoading = true;
  bool _isFollowing = false;
  bool _showFullDesc = false;

  @override
  void initState() {
    super.initState();
    _loadSeries();
  }

  Future<void> _loadSeries() async {
    setState(() => _isLoading = true);
    final service = ref.read(raftaarFilmsServiceProvider);

    try {
      final detail = await service.getSeriesDetail(widget.seriesId);
      final isSub = await service.isSubscribed(widget.seriesId);

      if (mounted) {
        setState(() {
          if (detail != null) {
            _series = detail.series;
            _episodes = detail.episodes;
          }
          _isFollowing = isSub;
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleFollow() async {
    final nextState = !_isFollowing;
    setState(() => _isFollowing = nextState);
    final service = ref.read(raftaarFilmsServiceProvider);
    await service.toggleSubscribe(widget.seriesId, nextState);
  }

  void _shareSeries() {
    if (_series == null) return;
    SharePlus.instance.share(
      ShareParams(
        text: 'Watch "${_series!.title}" on Raftaar Films: https://inplayer.in/raftaar-films/${_series!.seriesId}',
        subject: _series!.title,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F0F13),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.brandOrange),
        ),
      );
    }

    if (_series == null) {
      return Scaffold(
        backgroundColor: const Color(0xFF0F0F13),
        appBar: AppBar(
          backgroundColor: Colors.transparent,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white),
            onPressed: () => context.pop(),
          ),
        ),
        body: const Center(
          child: Text(
            'Series not found',
            style: TextStyle(color: Colors.white70, fontSize: 16),
          ),
        ),
      );
    }

    final series = _series!;
    final firstEpisode = _episodes.isNotEmpty ? _episodes.first : null;
    final authState = ref.watch(authStateProvider);
    final currentUser = authState is AuthStateAuthenticated ? authState.user : null;
    final cleanHandle = series.creatorHandle.replaceAll('@', '').trim();
    final isOwner = currentUser != null &&
        (currentUser.userId == series.creatorId ||
         (currentUser.handle != null && currentUser.handle!.replaceAll('@', '').trim().toLowerCase() == cleanHandle.toLowerCase()) ||
         currentUser.username.replaceAll('@', '').trim().toLowerCase() == cleanHandle.toLowerCase());

    return Scaffold(
      backgroundColor: const Color(0xFF0F0F13),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F0F13),
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_ios_new_rounded,
            color: Colors.white,
            size: 18,
          ),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/raftaar-films');
            }
          },
        ),
        title: Row(
          children: [
            Expanded(
              child: Text(
                series.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            if (series.genre.isNotEmpty) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF7A18).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: const Color(0xFFFF7A18).withValues(alpha: 0.4),
                    width: 0.8,
                  ),
                ),
                child: Text(
                  series.genre,
                  style: const TextStyle(
                    color: Color(0xFFFF7A18),
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          // Small creator avatar only
          GestureDetector(
            onTap: () {
              if (isOwner) {
                context.push('/my-videos');
              } else {
                final handle = cleanHandle.isNotEmpty ? cleanHandle : series.creatorId;
                if (handle.isNotEmpty) {
                  context.push('/channel/$handle');
                }
              }
            },
            child: CircleAvatar(
              radius: 14,
              backgroundColor: Colors.grey[800],
              backgroundImage: series.creatorAvatarUrl.isNotEmpty
                  ? smartImageProvider(series.creatorAvatarUrl)
                  : null,
              child: series.creatorAvatarUrl.isEmpty
                  ? const Icon(Icons.person, color: Colors.white, size: 14)
                  : null,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.share_outlined, color: Colors.white, size: 20),
            onPressed: _shareSeries,
          ),
          const SizedBox(width: 6),
        ],
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Creator Row
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.05),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.08),
                        width: 1,
                      ),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () {
                              if (isOwner) {
                                context.push('/my-videos');
                              } else {
                                final handle = cleanHandle.isNotEmpty ? cleanHandle : series.creatorId;
                                if (handle.isNotEmpty) {
                                  context.push('/channel/$handle');
                                }
                              }
                            },
                            child: Row(
                              children: [
                                CircleAvatar(
                                  radius: 20,
                                  backgroundColor: Colors.grey[800],
                                  backgroundImage: series.creatorAvatarUrl.isNotEmpty
                                      ? smartImageProvider(series.creatorAvatarUrl)
                                      : null,
                                  child: series.creatorAvatarUrl.isEmpty
                                      ? const Icon(Icons.person, color: Colors.white)
                                      : null,
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Flexible(
                                            child: Text(
                                              series.creatorName,
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis,
                                              style: const TextStyle(
                                                color: Colors.white,
                                                fontWeight: FontWeight.w700,
                                                fontSize: 14,
                                              ),
                                            ),
                                          ),
                                          if (isOwner) ...[
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFFF7A18).withValues(alpha: 0.25),
                                                borderRadius: BorderRadius.circular(4),
                                                border: Border.all(
                                                  color: const Color(0xFFFF7A18).withValues(alpha: 0.5),
                                                  width: 0.5,
                                                ),
                                              ),
                                              child: const Text(
                                                'You',
                                                style: TextStyle(
                                                  color: Color(0xFFFF7A18),
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.w700,
                                                ),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      Text(
                                        '@$cleanHandle',
                                        style: const TextStyle(
                                          color: Colors.white54,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                        if (!isOwner) ...[
                          const SizedBox(width: 8),
                          GestureDetector(
                            onTap: _toggleFollow,
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 200),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 8,
                              ),
                              decoration: BoxDecoration(
                                color: _isFollowing
                                    ? Colors.white.withValues(alpha: 0.1)
                                    : const Color(0xFFFF7A18),
                                borderRadius: BorderRadius.circular(20),
                                border: _isFollowing
                                    ? Border.all(color: Colors.white24)
                                    : null,
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    _isFollowing ? Icons.check : Icons.add,
                                    size: 14,
                                    color: Colors.white,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    _isFollowing ? 'In-Family' : 'In-Family',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Synopsis / Description
                  if (series.description.isNotEmpty) ...[
                    Text(
                      series.description,
                      maxLines: _showFullDesc ? null : 3,
                      overflow: _showFullDesc ? null : TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 13,
                        height: 1.45,
                      ),
                    ),
                    if (series.description.length > 120) ...[
                      const SizedBox(height: 4),
                      GestureDetector(
                        onTap: () => setState(() => _showFullDesc = !_showFullDesc),
                        child: Text(
                          _showFullDesc ? 'Show less' : 'Read more',
                          style: const TextStyle(
                            color: Color(0xFFFF9A00),
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                  ],

                  // Watch Episode 1 Big CTA Button
                  if (firstEpisode != null) ...[
                    GestureDetector(
                      onTap: () {
                        context.push('/raftaar-films/${series.seriesId}/${firstEpisode.videoId}');
                      },
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        decoration: BoxDecoration(
                          gradient: const LinearGradient(
                            colors: [Color(0xFFFF7A18), Color(0xFFFF9A00)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          borderRadius: BorderRadius.circular(16),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFFFF7A18).withValues(alpha: 0.45),
                              blurRadius: 16,
                              offset: const Offset(0, 4),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(Icons.play_arrow_rounded, color: Colors.white, size: 24),
                            const SizedBox(width: 8),
                            Text(
                              'Watch Episode 1',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w800,
                                fontSize: 16,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],

                  // Episodes Section Header
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Episodes',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        'Total ${_episodes.length}',
                        style: const TextStyle(
                          color: Colors.white54,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Episodes Grid (2 columns)
                  if (_episodes.isEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 36),
                      alignment: Alignment.center,
                      child: const Text(
                        'No episodes uploaded yet.',
                        style: TextStyle(color: Colors.white38, fontSize: 13),
                      ),
                    )
                  else
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: _episodes.length,
                      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: 2,
                        crossAxisSpacing: 10,
                        mainAxisSpacing: 12,
                        childAspectRatio: 9 / 14,
                      ),
                      itemBuilder: (context, index) {
                        final ep = _episodes[index];
                        final thumb = ep.thumbnailUrl.isNotEmpty
                            ? ep.thumbnailUrl
                            : series.posterUrl;

                        return GestureDetector(
                          onTap: () {
                            context.push('/raftaar-films/${series.seriesId}/${ep.videoId}');
                          },
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.08),
                                width: 1,
                              ),
                            ),
                            clipBehavior: Clip.antiAlias,
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                thumb.isNotEmpty
                                    ? SafeAppImage(
                                        imageUrl: thumb,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) => Container(color: Colors.grey[900]),
                                        errorWidget: (context, url, error) => Container(color: Colors.grey[900]),
                                      )
                                    : Container(color: Colors.grey[900]),
                                Container(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      colors: [
                                        Colors.transparent,
                                        Colors.black.withValues(alpha: 0.85),
                                      ],
                                      stops: const [0.45, 1.0],
                                      begin: Alignment.topCenter,
                                      end: Alignment.bottomCenter,
                                    ),
                                  ),
                                ),
                                Positioned(
                                  top: 8,
                                  left: 8,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(alpha: 0.65),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      'Ep ${ep.episodeNumber}',
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.w700,
                                        fontSize: 10,
                                      ),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  left: 8,
                                  right: 8,
                                  bottom: 8,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        ep.title,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '${ep.views} views',
                                        style: const TextStyle(
                                          color: Colors.white60,
                                          fontSize: 10,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),

                  const SizedBox(height: 36),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
