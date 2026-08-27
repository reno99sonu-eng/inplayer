import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../models/video.dart';
import '../../../home/presentation/widgets/video_card.dart';

class VideoListPage extends ConsumerStatefulWidget {
  final String title;
  final IconData emptyIcon;
  final String emptyMessage;
  final Future<List<Video>> Function(WidgetRef ref) loader;

  const VideoListPage({
    super.key,
    required this.title,
    required this.emptyIcon,
    required this.emptyMessage,
    required this.loader,
  });

  @override
  ConsumerState<VideoListPage> createState() => _VideoListPageState();
}

class _VideoListPageState extends ConsumerState<VideoListPage> {
  bool _loading = true;
  List<Video> _videos = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final videos = await widget.loader(ref);
    if (!mounted) return;
    setState(() {
      _videos = videos;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return PatternBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(
          backgroundColor: context.bgCanvas.withValues(alpha: 0.95),
          elevation: 0,
          iconTheme: IconThemeData(color: context.textPrimary),
          title: Text(
            widget.title,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
        ),
        body: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.brandOrange),
              )
            : RefreshIndicator(
                color: AppColors.brandOrange,
                backgroundColor: context.bgCard,
                onRefresh: _load,
                child: _videos.isEmpty
                    ? ListView(
                        children: [
                          SizedBox(
                            height: MediaQuery.of(context).size.height * 0.6,
                            child: Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(widget.emptyIcon,
                                      size: 48, color: context.textDim),
                                  const SizedBox(height: 16),
                                  Text(
                                    widget.emptyMessage,
                                    style: TextStyle(
                                        color: context.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _videos.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 24),
                        itemBuilder: (context, index) => VideoCard(video: _videos[index]),
                      ),
              ),
      ),
    );
  }
}
