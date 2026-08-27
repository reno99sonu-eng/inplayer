import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';

/// One playable game entry — mirrors app/data/playables.ts exactly (real
/// GameMonetize titles/thumbnails/ids already live on the website).
class _Playable {
  final String id;
  final String title;
  final String developer;
  final String thumbnail;

  const _Playable({required this.id, required this.title, required this.developer, required this.thumbnail});
}

const List<_Playable> _kPlayables = [
  _Playable(
    id: 'car-evolution',
    title: 'Car Evolution Game',
    developer: 'SKY HIGH STUDIO',
    thumbnail: 'https://img.gamemonetize.com/rrflwl9gzd8jw3wpk6mzgwfzi32pvnlp/512x384.jpg',
  ),
  _Playable(
    id: 'jungle-tube-sort',
    title: 'Jungle Tube Sort',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/gc27b80jq4qszm6es9mqtmy8fyavty8l/512x384.jpg',
  ),
  _Playable(
    id: 'scale-the-depths',
    title: 'Scale the Depths',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/vdyzczweogljzhl0f47jjbrfx87ja163/512x384.jpg',
  ),
  _Playable(
    id: 'stormhawk',
    title: 'STORMHAWK',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/xluntt2g2ij4zf2lrthjozqe4vhx8qi3/512x384.jpg',
  ),
  _Playable(
    id: 'farming-simulation',
    title: 'Farming Simulation Game',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/4wqbtp9q2umsv9k703yokgau6c8abtra/512x384.jpg',
  ),
  _Playable(
    id: 'rasgullas',
    title: 'Rasgullas',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/bgvootmi3hf47pyn2osbshsbvnhxy2ui/512x384.jpg',
  ),
  _Playable(
    id: 'bump-the-balls',
    title: 'Bump the Balls',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/1pb39gu1lkx49o8ng8yga0wh3ceyupfz/512x384.jpg',
  ),
  _Playable(
    id: 'football-legends-puzzle',
    title: 'Football Legends Sliding Puzzle',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/i0gwshzyncwhxd9q9hyprkrn7b0fwhrz/512x384.jpg',
  ),
  _Playable(
    id: 'police-transport',
    title: 'Police Transport Game',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/sn3ro971fse3r2cuk735a3depwknvlgy/512x384.jpg',
  ),
  _Playable(
    id: 'tuk-tuk-auto',
    title: 'Tuk Tuk Auto Rikshaw',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/e3nqbd83zbz64dri00qtgftk6ke4reds/512x384.jpg',
  ),
  _Playable(
    id: 'offroad-truck',
    title: 'Offroad Truck Driving Game',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/xtiazo4pxkvapm95lenz2ig6mwrdaqks/512x384.jpg',
  ),
  _Playable(
    id: 'sugar-drop',
    title: 'Sugar Drop',
    developer: 'GameMonetize',
    thumbnail: 'https://img.gamemonetize.com/hruvokintdgntinvmcz1rf1n10ajp3b3/512x384.jpg',
  ),
];

/// Horizontal "Playables" shelf. The games themselves run in an iframe on
/// the website (app/play/[id]/page.tsx) — embedding that same iframe in a
/// WebView here isn't something this app can safely add and verify without
/// a compiler, so this honestly opens the real game page on inplayer.in
/// instead of pretending to play it in-app.
class PlayablesShelf extends StatelessWidget {
  const PlayablesShelf({super.key});

  Future<void> _openGame(_Playable game) async {
    final uri = Uri.parse('${ApiConstants.websiteOrigin}/play/${game.id}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              const Text('🎮', style: TextStyle(fontSize: 18)),
              const SizedBox(width: 8),
              Text(
                'Playables',
                style: TextStyle(
                  color: context.textPrimary,
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  letterSpacing: -0.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 165,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _kPlayables.length,
            itemBuilder: (context, index) => _buildCard(context, _kPlayables[index]),
          ),
        ),
      ],
    );
  }

  Widget _buildCard(BuildContext context, _Playable game) {
    return GestureDetector(
      onTap: () => _openGame(game),
      child: Container(
        width: 130,
        margin: const EdgeInsets.only(right: 12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: AspectRatio(
                aspectRatio: 4 / 3,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CachedNetworkImage(
                      imageUrl: game.thumbnail,
                      fit: BoxFit.cover,
                      errorWidget: (context, url, error) => Container(
                        color: AppColors.surfaceDark,
                        child: const Icon(Icons.sports_esports, color: AppColors.brandOrange),
                      ),
                    ),
                    Positioned(
                      right: 6,
                      bottom: 6,
                      child: Container(
                        padding: const EdgeInsets.all(5),
                        decoration: const BoxDecoration(
                          color: AppColors.brandOrange,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.play_arrow, color: Colors.white, size: 14),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              game.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: context.textPrimary, fontSize: 12, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 2),
            Text(
              game.developer,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: context.textSecondary, fontSize: 10),
            ),
          ],
        ),
      ),
    );
  }
}
