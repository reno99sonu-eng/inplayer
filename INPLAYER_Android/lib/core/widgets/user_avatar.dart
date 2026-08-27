import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../config/app_config.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../utils/image_utils.dart';

class UserAvatar extends StatelessWidget {
  final String? avatarUrl;
  final String name;
  final double size;
  final bool isVerified;
  final VoidCallback? onTap;

  const UserAvatar({
    super.key,
    required this.avatarUrl,
    required this.name,
    this.size = 36,
    this.isVerified = false,
    this.onTap,
  });

  String get _initial {
    final clean = name.trim();
    if (clean.isEmpty) return 'I';
    return clean[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    var url = (avatarUrl ?? '').trim();
    if (url.startsWith('/')) {
      url = '${AppConfig.apiBaseUrl}$url';
    }

    final isData = isDataImageUrl(url);
    final isHttp = url.startsWith('http://') || url.startsWith('https://');

    Widget avatarContent;

    if (isData) {
      final bytes = decodeDataImageUrl(url);
      if (bytes != null) {
        avatarContent = Image.memory(
          bytes,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) => _buildInitialFallback(context),
        );
      } else {
        avatarContent = _buildInitialFallback(context);
      }
    } else if (isHttp) {
      avatarContent = CachedNetworkImage(
        imageUrl: url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        fadeInDuration: const Duration(milliseconds: 150),
        placeholder: (context, url) => Container(
          color: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
          child: Center(
            child: SizedBox(
              width: size * 0.4,
              height: size * 0.4,
              child: const CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.brandOrange),
            ),
          ),
        ),
        errorWidget: (context, url, error) => _buildInitialFallback(context),
      );
    } else {
      avatarContent = _buildInitialFallback(context);
    }

    final avatar = Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: size,
          height: size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: AppColors.brandOrange.withValues(alpha: 0.35),
              width: size > 40 ? 2.0 : 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.brandOrange.withValues(alpha: 0.20),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: ClipOval(child: avatarContent),
        ),
        if (isVerified)
          Positioned(
            bottom: -1,
            right: -1,
            child: Container(
              padding: EdgeInsets.all(size * 0.04),
              decoration: BoxDecoration(
                color: context.bgCanvas,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.verified_rounded,
                size: (size * 0.36).clamp(12.0, 22.0),
                color: AppColors.brandOrange,
              ),
            ),
          ),
      ],
    );

    if (onTap != null) {
      return GestureDetector(onTap: onTap, child: avatar);
    }
    return avatar;
  }

  Widget _buildInitialFallback(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Color(0xFFF97316),
            Color(0xFFEA580C),
            Color(0xFFC2410C),
          ],
        ),
      ),
      child: Center(
        child: Text(
          _initial,
          style: TextStyle(
            color: Colors.white,
            fontSize: size * 0.44,
            fontWeight: FontWeight.w900,
            shadows: [
              Shadow(
                color: Colors.black.withValues(alpha: 0.4),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
