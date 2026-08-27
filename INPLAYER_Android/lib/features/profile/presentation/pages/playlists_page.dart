import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../core/theme/pattern_background.dart';
import '../../../../services/playlist_service.dart';
import '../../../../models/playlist.dart';

class PlaylistsPage extends ConsumerStatefulWidget {
  const PlaylistsPage({super.key});

  @override
  ConsumerState<PlaylistsPage> createState() => _PlaylistsPageState();
}

class _PlaylistsPageState extends ConsumerState<PlaylistsPage> {
  bool _loading = true;
  List<Playlist> _playlists = [];
  bool _creating = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final playlists = await ref.read(playlistServiceProvider).getPlaylists();
    if (!mounted) return;
    setState(() {
      _playlists = playlists;
      _loading = false;
    });
  }

  Future<void> _createPlaylist() async {
    final controller = TextEditingController();
    final name = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: context.bgModal,
        title: Text('New playlist', style: TextStyle(color: context.textPrimary, fontWeight: FontWeight.bold)),
        content: TextField(
          controller: controller,
          autofocus: true,
          style: TextStyle(color: context.textPrimary),
          decoration: InputDecoration(
            hintText: 'Playlist name',
            hintStyle: TextStyle(color: context.textDim),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text('Create', style: TextStyle(color: AppColors.brandOrange)),
          ),
        ],
      ),
    );

    if (name == null || name.isEmpty || _creating) return;

    setState(() => _creating = true);
    final playlistId = await ref.read(playlistServiceProvider).createPlaylist(name);
    if (!mounted) return;
    setState(() => _creating = false);

    if (playlistId != null) {
      await _load();
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text("Couldn't create that playlist."),
          backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
        ),
      );
    }
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
            'Playlists',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: context.textPrimary,
              letterSpacing: -0.5,
            ),
          ),
        ),
        floatingActionButton: FloatingActionButton(
          backgroundColor: AppColors.brandOrange,
          onPressed: _creating ? null : _createPlaylist,
          child: _creating
              ? const SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    valueColor: AlwaysStoppedAnimation(Colors.white),
                  ),
                )
              : const Icon(Icons.add, color: Colors.white),
        ),
        body: _loading
            ? const Center(
                child: CircularProgressIndicator(color: AppColors.brandOrange))
            : RefreshIndicator(
                color: AppColors.brandOrange,
                backgroundColor: context.bgCard,
                onRefresh: _load,
                child: _playlists.isEmpty
                    ? ListView(
                        children: [
                          SizedBox(
                            height: MediaQuery.of(context).size.height * 0.6,
                            child: Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.playlist_play,
                                      size: 48, color: context.textDim),
                                  const SizedBox(height: 16),
                                  Text('No playlists yet',
                                      style:
                                          TextStyle(color: context.textSecondary)),
                                ],
                              ),
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        itemCount: _playlists.length,
                        separatorBuilder: (context, index) =>
                            Divider(height: 1, color: context.borderSubtle),
                        itemBuilder: (context, index) {
                          final p = _playlists[index];
                          return ListTile(
                            leading: CircleAvatar(
                              radius: 20,
                              backgroundColor: context.isDark ? AppColors.surfaceDark : AppColors.surfaceLight,
                              child: Icon(
                                p.reserved ? Icons.bookmark : Icons.playlist_play,
                                color: AppColors.brandOrange,
                              ),
                            ),
                            title: Text(
                              p.reserved ? 'Saved' : p.name,
                              style: TextStyle(
                                color: context.textPrimary,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            subtitle: Text(
                              '${p.videoIds.length} video${p.videoIds.length == 1 ? '' : 's'}',
                              style:
                                  TextStyle(color: context.textSecondary, fontSize: 12),
                            ),
                            trailing: Icon(Icons.chevron_right,
                                color: context.textDim),
                            onTap: () => context.push(
                              '/playlists/${p.playlistId}',
                              extra: p.reserved ? 'Saved' : p.name,
                            ),
                          );
                        },
                      ),
              ),
      ),
    );
  }
}
