import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../../../core/theme/app_theme.dart';
import 'injoy_games.dart';

/// Hosts the selected game inside the app instead of handing the user to an
/// external browser. The website game route supplies the actual playable
/// iframe and keeps the catalogue/backend in one place.
class InJoyGamePage extends StatefulWidget {
  final String gameId;
  const InJoyGamePage({super.key, required this.gameId});

  @override
  State<InJoyGamePage> createState() => _InJoyGamePageState();
}

class _InJoyGamePageState extends State<InJoyGamePage> {
  late final WebViewController _controller;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageFinished: (_) {
            if (mounted) setState(() => _loading = false);
          },
          onWebResourceError: (_) {
            if (mounted) setState(() => _loading = false);
          },
        ),
      )
      ..loadRequest(Uri.parse('https://inplayer.in/play/${widget.gameId}'));
  }

  @override
  Widget build(BuildContext context) {
    final matches = inJoyGames.where((g) => g.id == widget.gameId);
    final game = matches.isEmpty ? null : matches.first;
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
          game?.title ?? 'InJoy',
          style: TextStyle(
            color: context.textPrimary,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: Stack(
        children: [
          WebViewWidget(controller: _controller),
          if (_loading) const Center(child: CircularProgressIndicator()),
        ],
      ),
    );
  }
}
