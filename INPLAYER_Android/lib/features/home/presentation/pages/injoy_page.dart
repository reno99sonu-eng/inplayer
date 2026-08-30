import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import 'injoy_games.dart';

class InJoyPage extends StatelessWidget {
  const InJoyPage({super.key});

  @override
  Widget build(BuildContext context) {
    final games = getRotatedInJoyGames();
    return Scaffold(
      backgroundColor: context.bgCanvas,
      appBar: AppBar(
        backgroundColor: context.bgCanvas,
        elevation: 0,
        leading: IconButton(
          onPressed: () => context.pop(),
          icon: Icon(Icons.arrow_back_rounded, color: context.textPrimary),
        ),
        title: Text(
          'InJoy',
          style: TextStyle(
            color: context.textPrimary,
            fontWeight: FontWeight.w900,
            fontSize: 23,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(18, 8, 18, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [
                  Color(0xFF25105C),
                  Color(0xFF0E7490),
                  Color(0xFF10233D),
                ],
              ),
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF22D3EE).withValues(alpha: .22),
                  blurRadius: 28,
                  offset: const Offset(0, 12),
                ),
              ],
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.sports_esports_rounded,
                  color: Colors.white,
                  size: 34,
                ),
                SizedBox(height: 18),
                Text(
                  'PLAY YOUR WAY',
                  style: TextStyle(
                    color: Color(0xFF67E8F9),
                    fontSize: 11,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 2.2,
                  ),
                ),
                SizedBox(height: 7),
                Text(
                  'Your next favourite\nminute starts here.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 28,
                    height: 1.05,
                    fontWeight: FontWeight.w900,
                  ),
                ),
                SizedBox(height: 12),
                Text(
                  'Quick games, bright competition, zero waiting.',
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
              ],
            ),
          ),
          const SizedBox(height: 26),
          Row(
            children: [
              Text(
                'Featured games',
                style: TextStyle(
                  color: context.textPrimary,
                  fontSize: 19,
                  fontWeight: FontWeight.w900,
                ),
              ),
              const Spacer(),
              Text(
                'Refreshes every 2 days',
                style: TextStyle(color: context.textSecondary, fontSize: 11),
              ),
            ],
          ),
          const SizedBox(height: 12),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: games.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: .82,
            ),
            itemBuilder: (context, i) {
              return _gameCard(context, games[i]);
            },
          ),
        ],
      ),
    );
  }

  Widget _gameCard(BuildContext context, InJoyGame game) {
    return InkWell(
      borderRadius: BorderRadius.circular(22),
      onTap: () => context.push('/injoy/play/${game.id}'),
      child: Ink(
        decoration: BoxDecoration(
          color: context.bgCard,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: Colors.white.withValues(alpha: .08)),
          boxShadow: const [
            BoxShadow(
              color: Color(0x18000000),
              blurRadius: 14,
              offset: Offset(0, 6),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(child: _thumbnail(context, game)),
            Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    game.title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: context.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          game.developer,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: context.textSecondary,
                            fontSize: 10,
                          ),
                        ),
                      ),
                      const Icon(
                        Icons.play_circle_fill_rounded,
                        color: Color(0xFF06B6D4),
                        size: 20,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _thumbnail(BuildContext context, InJoyGame game) {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(top: Radius.circular(22)),
      child: SizedBox(
        width: double.infinity,
        child: CachedNetworkImage(
          imageUrl: game.thumbnail,
          fit: BoxFit.cover,
          placeholder: (_, __) => Container(
            color: context.bgCard,
            child: const Center(
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
          errorWidget: (_, __, ___) => Container(
            color: context.bgCard,
            child: Icon(
              Icons.sports_esports_rounded,
              color: context.textSecondary,
              size: 30,
            ),
          ),
        ),
      ),
    );
  }
}
