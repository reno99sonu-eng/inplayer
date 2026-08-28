import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../config/app_config.dart';
import '../theme/app_colors.dart';
import '../theme/app_theme.dart';
import '../utils/image_utils.dart';

/// A stable avatar renderer for both URL and base64 profile images.
///
/// Raftaar's player rebuilds its chrome many times per second.  Decoding a
/// data URI in [build] creates a new [MemoryImage] on each rebuild, which
/// changes the image-cache key and makes the avatar flash between the image
/// and its fallback.  Keeping the decoded bytes in State gives the image a
/// stable provider for the lifetime of the mounted avatar.
class UserAvatar extends StatefulWidget {
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

  @override
  State<UserAvatar> createState() => _UserAvatarState();
}

class _UserAvatarState extends State<UserAvatar> {
  String _dataUrl = '';
  Uint8List? _dataBytes;

  @override
  void initState() {
    super.initState();
    _syncDataImage();
  }

  @override
  void didUpdateWidget(covariant UserAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.avatarUrl != widget.avatarUrl) {
      _syncDataImage();
    }
  }

  void _syncDataImage() {
    final candidate = (widget.avatarUrl ?? '').trim();
    _dataUrl = candidate;
    _dataBytes = isDataImageUrl(candidate)
        ? decodeDataImageUrl(candidate)
        : null;
  }

  String get _initial {
    final clean = widget.name.trim();
    if (clean.isEmpty) return 'I';
    return clean[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    var url = (widget.avatarUrl ?? '').trim();
    if (url.startsWith('/')) {
      url = '${AppConfig.apiBaseUrl}$url';
    }

    final isData = isDataImageUrl(url);
    final isHttp = url.startsWith('http://') || url.startsWith('https://');

    Widget avatarContent;

    if (isData) {
      // The URL can only differ from [_dataUrl] during the one build before
      // didUpdateWidget runs.  Fall back to a one-off decode in that rare
      // case; normal playback rebuilds reuse the exact same byte list.
      final bytes = url == _dataUrl ? _dataBytes : decodeDataImageUrl(url);
      if (bytes != null) {
        avatarContent = Image.memory(
          bytes,
          width: widget.size,
          height: widget.size,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) =>
              _buildInitialFallback(context),
        );
      } else {
        avatarContent = _buildInitialFallback(context);
      }
    } else if (isHttp) {
      avatarContent = CachedNetworkImage(
        imageUrl: url,
        cacheKey: url,
        width: widget.size,
        height: widget.size,
        fit: BoxFit.cover,
        memCacheWidth: (widget.size * 2.5).round(),
        memCacheHeight: (widget.size * 2.5).round(),
        fadeInDuration: Duration.zero,
        fadeOutDuration: Duration.zero,
        useOldImageOnUrlChange: true,
        placeholder: (context, url) => _buildInitialFallback(context),
        errorWidget: (context, url, error) => _buildInitialFallback(context),
      );
    } else {
      avatarContent = _buildInitialFallback(context);
    }

    final avatar = Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: AppColors.brandOrange.withValues(alpha: 0.35),
              width: widget.size > 40 ? 2.0 : 1.5,
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
        if (widget.isVerified)
          Positioned(
            bottom: -1,
            right: -1,
            child: Container(
              padding: EdgeInsets.all(widget.size * 0.04),
              decoration: BoxDecoration(
                color: context.bgCanvas,
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.verified_rounded,
                size: (widget.size * 0.36).clamp(12.0, 22.0),
                color: AppColors.brandOrange,
              ),
            ),
          ),
      ],
    );

    if (widget.onTap != null) {
      return GestureDetector(onTap: widget.onTap, child: avatar);
    }
    return avatar;
  }

  Widget _buildInitialFallback(BuildContext context) {
    return Container(
      width: widget.size,
      height: widget.size,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF97316), Color(0xFFEA580C), Color(0xFFC2410C)],
        ),
      ),
      child: Center(
        child: Text(
          _initial,
          style: TextStyle(
            color: Colors.white,
            fontSize: widget.size * 0.44,
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
