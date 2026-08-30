import 'package:flutter/material.dart';

class ChatTheme {
  final String id;
  final String name;
  final Color bgColor;
  final Color textColor;
  final Color bubbleMineBgColor;
  final Color bubbleMineTextColor;
  final Color bubbleOtherBgColor;
  final Color bubbleOtherTextColor;
  final String backgroundImageUrl;
  final bool isLight;

  const ChatTheme({
    required this.id,
    required this.name,
    required this.bgColor,
    required this.textColor,
    required this.bubbleMineBgColor,
    required this.bubbleMineTextColor,
    required this.bubbleOtherBgColor,
    required this.bubbleOtherTextColor,
    required this.backgroundImageUrl,
    required this.isLight,
  });
}

class AppChatThemes {
  static const Map<String, ChatTheme> themes = {
    'default': ChatTheme(
      id: 'default',
      name: 'Obsidian Amber Glass',
      bgColor: Color(0xFF060D17),
      textColor: Colors.white,
      bubbleMineBgColor: Color(0xFFFF9A00), // brand orange
      bubbleMineTextColor: Color(0xFF020617), // slate-950
      bubbleOtherBgColor: Color(0xFF0E1A2B),
      bubbleOtherTextColor: Color(0xFFF1F5F9), // slate-100
      backgroundImageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1920&q=80",
      isLight: false,
    ),
    'emerald': ChatTheme(
      id: 'emerald',
      name: 'Emerald Signature',
      bgColor: Color(0xFF0B141A),
      textColor: Colors.white,
      bubbleMineBgColor: Color(0xFF005C4B),
      bubbleMineTextColor: Colors.white,
      bubbleOtherBgColor: Color(0xFF202C33),
      bubbleOtherTextColor: Color(0xFFF1F5F9),
      backgroundImageUrl: "https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=1920&q=80",
      isLight: false,
    ),
    'emeraldLight': ChatTheme(
      id: 'emeraldLight',
      name: 'Light Emerald Signature',
      bgColor: Color(0xFFEFEAE2),
      textColor: Color(0xFF0F172A),
      bubbleMineBgColor: Color(0xFFD9FDD3),
      bubbleMineTextColor: Color(0xFF0F172A),
      bubbleOtherBgColor: Colors.white,
      bubbleOtherTextColor: Color(0xFF0F172A),
      backgroundImageUrl: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?auto=format&fit=crop&w=1920&q=80",
      isLight: true,
    ),
    'cyberpunk': ChatTheme(
      id: 'cyberpunk',
      name: 'Cyberpunk Neon Mesh',
      bgColor: Color(0xFF070214),
      textColor: Color(0xFFCFFAFE), // cyan-100
      bubbleMineBgColor: Color(0xFF06B6D4), // cyan-500
      bubbleMineTextColor: Colors.white,
      bubbleOtherBgColor: Color(0xFF12082A),
      bubbleOtherTextColor: Color(0xFFCFFAFE),
      backgroundImageUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1920&q=80",
      isLight: false,
    ),
    'midnight': ChatTheme(
      id: 'midnight',
      name: 'Midnight Galaxy Stars',
      bgColor: Color(0xFF0A071B),
      textColor: Color(0xFFF3E8FF), // purple-100
      bubbleMineBgColor: Color(0xFF9333EA), // purple-600
      bubbleMineTextColor: Colors.white,
      bubbleOtherBgColor: Color(0xFF150F2E),
      bubbleOtherTextColor: Color(0xFFF3E8FF),
      backgroundImageUrl: "https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&q=80",
      isLight: false,
    ),
    'sunset': ChatTheme(
      id: 'sunset',
      name: 'Warm Gold Sunset',
      bgColor: Color(0xFF160B04),
      textColor: Color(0xFFFEF3C7), // amber-100
      bubbleMineBgColor: Color(0xFFF59E0B), // amber-500
      bubbleMineTextColor: Color(0xFF020617), // slate-950
      bubbleOtherBgColor: Color(0xFF261308),
      bubbleOtherTextColor: Color(0xFFFEF3C7),
      backgroundImageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=80",
      isLight: false,
    ),
    'minimal': ChatTheme(
      id: 'minimal',
      name: 'Carbon Micro-Weave',
      bgColor: Color(0xFF0B1220),
      textColor: Color(0xFFF1F5F9), // slate-100
      bubbleMineBgColor: Color(0xFF1D4ED8), // blue-700
      bubbleMineTextColor: Colors.white,
      bubbleOtherBgColor: Color(0xFF1E293B), // slate-800
      bubbleOtherTextColor: Color(0xFFE2E8F0), // slate-200
      backgroundImageUrl: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1920&q=80",
      isLight: false,
    ),
    'blossom': ChatTheme(
      id: 'blossom',
      name: 'Soft Blossom',
      bgColor: Color(0xFFFDF2F8), // pink-50
      textColor: Color(0xFF0F172A),
      bubbleMineBgColor: Color(0xFFFBCFE8), // pink-200
      bubbleMineTextColor: Color(0xFF0F172A),
      bubbleOtherBgColor: Colors.white,
      bubbleOtherTextColor: Color(0xFF0F172A),
      backgroundImageUrl: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=1920&q=80",
      isLight: true,
    ),
    'ocean': ChatTheme(
      id: 'ocean',
      name: 'Ocean Breeze',
      bgColor: Color(0xFFF0F9FF), // sky-50
      textColor: Color(0xFF0F172A),
      bubbleMineBgColor: Color(0xFFBAE6FD), // sky-200
      bubbleMineTextColor: Color(0xFF0F172A),
      bubbleOtherBgColor: Colors.white,
      bubbleOtherTextColor: Color(0xFF0F172A),
      backgroundImageUrl: "https://images.unsplash.com/photo-1495954484750-af469f2f9be5?auto=format&fit=crop&w=1920&q=80",
      isLight: true,
    ),
    'pearl': ChatTheme(
      id: 'pearl',
      name: 'Pearl White',
      bgColor: Color(0xFFF8FAFC), // slate-50
      textColor: Color(0xFF0F172A),
      bubbleMineBgColor: Color(0xFFE2E8F0), // slate-200
      bubbleMineTextColor: Color(0xFF0F172A),
      bubbleOtherBgColor: Colors.white,
      bubbleOtherTextColor: Color(0xFF0F172A),
      backgroundImageUrl: "https://images.unsplash.com/photo-1518640467707-6811f4a4ab75?auto=format&fit=crop&w=1920&q=80",
      isLight: true,
    ),
    'lavender': ChatTheme(
      id: 'lavender',
      name: 'Lavender Mist',
      bgColor: Color(0xFFFDF4FF), // fuchsia-50
      textColor: Color(0xFF0F172A),
      bubbleMineBgColor: Color(0xFFF5D0FE), // fuchsia-200
      bubbleMineTextColor: Color(0xFF0F172A),
      bubbleOtherBgColor: Colors.white,
      bubbleOtherTextColor: Color(0xFF0F172A),
      backgroundImageUrl: "https://images.unsplash.com/photo-1519750157634-b6d493a0f77c?auto=format&fit=crop&w=1920&q=80",
      isLight: true,
    ),
  };
}
