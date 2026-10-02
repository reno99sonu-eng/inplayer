import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/theme/app_colors.dart';
import '../../../../services/video_service.dart';

/// Resolves the content type for a universal share link, then replaces the
/// resolver with the exact native player/feed route for that item.
class SharedContentLinkPage extends ConsumerStatefulWidget {
  final String videoId;

  const SharedContentLinkPage({super.key, required this.videoId});

  @override
  ConsumerState<SharedContentLinkPage> createState() =>
      _SharedContentLinkPageState();
}

class _SharedContentLinkPageState extends ConsumerState<SharedContentLinkPage> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_openSharedContent());
    });
  }

  Future<void> _openSharedContent() async {
    final encodedId = Uri.encodeComponent(widget.videoId);
    try {
      final video = await ref
          .read(videoServiceProvider)
          .getVideoById(widget.videoId);
      if (!mounted) return;

      if (video?.isShort == true) {
        // Play the exact shared item even when it is absent from the
        // audience-filtered Shorts feed. WatchPage resolves by ID and applies
        // its regular visibility checks.
        context.go('/watch/$encodedId');
        return;
      }
      if (video?.isStrictMusic == true) {
        context.go('/music?v=$encodedId');
        return;
      }

      final seriesId = video?.seriesId?.trim();
      if (video?.isFilm == true &&
          seriesId != null &&
          seriesId.isNotEmpty &&
          seriesId.toLowerCase() != 'series') {
        context.go(
          '/raftaar-films/${Uri.encodeComponent(seriesId)}/$encodedId',
        );
        return;
      }

      if (video?.isFilm == true) {
        context.go('/watch/$encodedId?direct=1');
        return;
      }

      context.go('/watch/$encodedId');
    } catch (error) {
      debugPrint('Could not resolve shared content: $error');
      if (mounted) context.go('/watch/$encodedId');
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: Color(0xFF0D0D12),
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            CircularProgressIndicator(color: AppColors.brandOrange),
            SizedBox(height: 14),
            Text(
              'Opening your InPlayer content…',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}
