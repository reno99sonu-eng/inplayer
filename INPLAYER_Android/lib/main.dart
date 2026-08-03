import 'package:flutter/material.dart';

import 'core/theme/app_theme.dart';

void main() {
  runApp(const InplayerApp());
}

class InplayerApp extends StatelessWidget {
  const InplayerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'INPLAYER',
      debugShowCheckedModeBanner: false,

      theme: AppTheme.darkTheme,

      home: const Scaffold(
        body: Center(
          child: Text(
            'INPLAYER',
          ),
        ),
      ),
    );
  }
}