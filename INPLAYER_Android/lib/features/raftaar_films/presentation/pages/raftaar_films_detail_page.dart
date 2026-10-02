import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../models/film_episode.dart';
import '../../../../models/film_series.dart';
import '../../../../providers/auth_provider.dart';
import '../../../../services/raftaar_films_service.dart';

class RaftaarFilmsDetailPage extends ConsumerStatefulWidget {
  final String seriesId;

  const RaftaarFilmsDetailPage({super.key, required this.seriesId});

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
    final series = _series;
    if (series == null) return;
    SharePlus.instance.share(
      ShareParams(
        text:
            'Watch "${series.title}" on Raftaar Films: https://inplayer.in/raftaar-films/${series.seriesId}',
        subject: series.title,
      ),
    );
  }

  void _openCreatorProfile(
    FilmSeries series,
    String cleanHandle,
    bool isOwner,
  ) {
    if (isOwner) {
      context.push('/my-videos?tab=raftaar-films');
      return;
    }
    final handle = cleanHandle.isNotEmpty ? cleanHandle : series.creatorId;
    if (handle.isNotEmpty) context.push('/channel/$handle');
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.brandOrange),
        ),
      );
    }

    final series = _series;
    if (series == null) {
      return Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(
          backgroundColor: Colors.black,
          foregroundColor: Colors.white,
          title: const Text('Raftaar Films'),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_rounded),
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

    final sortedEpisodes = List<FilmEpisode>.of(_episodes)
      ..sort((a, b) => a.episodeNumber.compareTo(b.episodeNumber));
    final firstEpisode = sortedEpisodes.isEmpty ? null : sortedEpisodes.first;
    final authState = ref.watch(authStateProvider);
    final currentUser = authState is AuthStateAuthenticated
        ? authState.user
        : null;
    final cleanHandle = series.creatorHandle.replaceAll('@', '').trim();
    final userHandle = currentUser?.handle?.replaceAll('@', '').trim();
    final userName = currentUser?.username.replaceAll('@', '').trim();
    final isOwner =
        currentUser != null &&
        (currentUser.userId == series.creatorId ||
            (userHandle != null &&
                userHandle.toLowerCase() == cleanHandle.toLowerCase()) ||
            (userName != null &&
                userName.toLowerCase() == cleanHandle.toLowerCase()));

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: const Icon(
            Icons.arrow_back_rounded,
            color: Colors.white,
            size: 20,
          ),
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/raftaar-films');
            }
          },
        ),
        titleSpacing: 0,
        title: Row(
          children: [
            Flexible(
              child: Text(
                series.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            if (series.genre.isNotEmpty) ...[
              const SizedBox(width: 6),
              Container(
                constraints: const BoxConstraints(maxWidth: 76),
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF7A18).withValues(alpha: 0.16),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: const Color(0xFFFF7A18).withValues(alpha: 0.28),
                  ),
                ),
                child: Text(
                  series.genre,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Color(0xFFFF9A00),
                    fontSize: 9,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ],
          ],
        ),
        actions: [
          GestureDetector(
            onTap: () => _openCreatorProfile(series, cleanHandle, isOwner),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: CircleAvatar(
                radius: 14,
                backgroundColor: const Color(0xFF27272A),
                backgroundImage: series.creatorAvatarUrl.isNotEmpty
                    ? smartImageProvider(series.creatorAvatarUrl)
                    : null,
                child: series.creatorAvatarUrl.isEmpty
                    ? const Icon(Icons.person, color: Colors.white70, size: 15)
                    : null,
              ),
            ),
          ),
          if (isOwner)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 5),
              child: Center(
                child: Text(
                  'You',
                  style: TextStyle(
                    color: const Color(0xFFFF9A00),
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 9, horizontal: 3),
              child: Material(
                color: _isFollowing
                    ? Colors.white.withValues(alpha: 0.12)
                    : const Color(0xFFFF7A18),
                borderRadius: BorderRadius.circular(18),
                child: InkWell(
                  onTap: _toggleFollow,
                  borderRadius: BorderRadius.circular(18),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _isFollowing
                              ? Icons.check_rounded
                              : Icons.add_rounded,
                          color: _isFollowing ? Colors.white : Colors.black,
                          size: 13,
                        ),
                        const SizedBox(width: 3),
                        Text(
                          'In-Family',
                          style: TextStyle(
                            color: _isFollowing ? Colors.white : Colors.black,
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          IconButton(
            tooltip: 'Share series',
            icon: const Icon(
              Icons.share_outlined,
              color: Colors.white,
              size: 18,
            ),
            onPressed: _shareSeries,
          ),
          const SizedBox(width: 2),
        ],
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 28),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              spacing: 7,
              runSpacing: 8,
              children: [
                InkWell(
                  onTap: () =>
                      _openCreatorProfile(series, cleanHandle, isOwner),
                  borderRadius: BorderRadius.circular(20),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircleAvatar(
                        radius: 13,
                        backgroundColor: const Color(0xFF27272A),
                        backgroundImage: series.creatorAvatarUrl.isNotEmpty
                            ? smartImageProvider(series.creatorAvatarUrl)
                            : null,
                        child: series.creatorAvatarUrl.isEmpty
                            ? const Icon(
                                Icons.person,
                                color: Colors.white70,
                                size: 14,
                              )
                            : null,
                      ),
                      const SizedBox(width: 6),
                      Text.rich(
                        TextSpan(
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 11,
                          ),
                          children: [
                            const TextSpan(text: 'by '),
                            TextSpan(
                              text:
                                  '@${cleanHandle.isEmpty ? 'creator' : cleanHandle}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const Text('•', style: TextStyle(color: Colors.white30)),
                Text(
                  '${sortedEpisodes.length} Episodes',
                  style: const TextStyle(
                    color: Color(0xFFFF9A00),
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (series.totalViews > 0) ...[
                  const Text('•', style: TextStyle(color: Colors.white30)),
                  Text(
                    '${series.totalViews} views',
                    style: const TextStyle(color: Colors.white54, fontSize: 10),
                  ),
                ],
                if (firstEpisode != null)
                  Material(
                    color: const Color(0xFFFF8A00),
                    borderRadius: BorderRadius.circular(20),
                    child: InkWell(
                      onTap: () => context.push(
                        '/raftaar-films/${series.seriesId}/${firstEpisode.videoId}',
                      ),
                      borderRadius: BorderRadius.circular(20),
                      child: const Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 11,
                          vertical: 6,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.play_arrow_rounded,
                              color: Colors.black,
                              size: 15,
                            ),
                            SizedBox(width: 2),
                            Text(
                              'Watch Episode 1',
                              style: TextStyle(
                                color: Colors.black,
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
            if (series.description.isNotEmpty) ...[
              const SizedBox(height: 12),
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 11,
                  vertical: 9,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.035),
                  borderRadius: BorderRadius.circular(11),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.06),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      series.description,
                      maxLines: _showFullDesc ? null : 2,
                      overflow: _showFullDesc ? null : TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 11,
                        height: 1.4,
                      ),
                    ),
                    if (series.description.length > 120) ...[
                      const SizedBox(height: 3),
                      GestureDetector(
                        onTap: () =>
                            setState(() => _showFullDesc = !_showFullDesc),
                        child: Text(
                          _showFullDesc ? 'Show less' : 'Read more',
                          style: const TextStyle(
                            color: Color(0xFFFF9A00),
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
            const SizedBox(height: 16),
            Row(
              children: [
                const Text(
                  'Episodes',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(width: 7),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 7,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.09),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    sortedEpisodes.isEmpty
                        ? '0'
                        : '1 – ${sortedEpisodes.length}',
                    style: const TextStyle(
                      color: Color(0xFFFF9A00),
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                const Spacer(),
                const Text(
                  'Tap any episode to watch',
                  style: TextStyle(color: Colors.white54, fontSize: 9.5),
                ),
              ],
            ),
            const SizedBox(height: 9),
            if (sortedEpisodes.isEmpty)
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 26,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.025),
                  borderRadius: BorderRadius.circular(13),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.06),
                  ),
                ),
                alignment: Alignment.center,
                child: const Text(
                  'No episodes uploaded to this series yet.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white38, fontSize: 11),
                ),
              )
            else
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: sortedEpisodes.length,
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  crossAxisSpacing: 9,
                  mainAxisSpacing: 10,
                  childAspectRatio: 9 / 16,
                ),
                itemBuilder: (context, index) =>
                    _buildEpisodeCard(series, sortedEpisodes[index], index),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildEpisodeCard(FilmSeries series, FilmEpisode episode, int index) {
    final episodeNumber = episode.episodeNumber > 0
        ? episode.episodeNumber
        : index + 1;
    final imageUrl = episode.thumbnailUrl.isNotEmpty
        ? episode.thumbnailUrl
        : series.posterUrl;
    final title = episode.title.isNotEmpty
        ? episode.title
        : 'Episode $episodeNumber';

    return Material(
      color: const Color(0xFF18181B),
      borderRadius: BorderRadius.circular(13),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => context.push(
          '/raftaar-films/${series.seriesId}/${episode.videoId}',
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (imageUrl.isNotEmpty)
              SafeAppImage(
                imageUrl: imageUrl,
                fit: BoxFit.cover,
                placeholder: (context, url) => const _EpisodeImageFallback(),
                errorWidget: (context, url, error) =>
                    const _EpisodeImageFallback(),
              )
            else
              const _EpisodeImageFallback(),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black54,
                    Colors.transparent,
                    Colors.transparent,
                    Colors.black87,
                  ],
                  stops: [0, 0.28, 0.48, 1],
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 3,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.72),
                          borderRadius: BorderRadius.circular(5),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.14),
                          ),
                        ),
                        child: Text(
                          'Ep $episodeNumber',
                          style: const TextStyle(
                            color: Color(0xFFFFC46B),
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const Spacer(),
                      const Icon(
                        Icons.play_circle_fill_rounded,
                        color: Color(0xFFFF9A00),
                        size: 20,
                      ),
                    ],
                  ),
                  const Spacer(),
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                      height: 1.2,
                      shadows: [Shadow(color: Colors.black87, blurRadius: 4)],
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    '${episode.views} views',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 9,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EpisodeImageFallback extends StatelessWidget {
  const _EpisodeImageFallback();

  @override
  Widget build(BuildContext context) {
    return const ColoredBox(
      color: Color(0xFF18181B),
      child: Center(
        child: Icon(Icons.movie_outlined, color: Colors.white24, size: 28),
      ),
    );
  }
}
