import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../../models/downloaded_item.dart';

/// Local manifest of completed offline downloads — one JSON blob in
/// shared_preferences, the same "hydrate on read" pattern already used by
/// PlaybackSettingsStore/PlaybackPositionStore. This is deliberately
/// separate from the website's `InPlayer-Downloads` DynamoDB table (see
/// app/api/downloads/route.ts): that table is a cross-device *activity
/// log* ("you downloaded this at some point"), not the actual file — the
/// file only ever exists on the one device that downloaded it, so this
/// on-device manifest is the real source of truth for "can I play this
/// offline right now." DownloadManager fires a best-effort ping at the
/// server table alongside writing here, but never depends on it.
class DownloadsStore {
  DownloadsStore._();
  static const _key = 'inplayer:downloads';

  static Future<List<DownloadedItem>> getAll() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key);
    if (raw == null) return [];
    try {
      final decoded = jsonDecode(raw);
      if (decoded is List) {
        return decoded
            .whereType<Map>()
            .map((m) => DownloadedItem.fromJson(Map<String, dynamic>.from(m)))
            .toList();
      }
    } catch (_) {
      // Corrupt/unparseable blob — treat as empty rather than crash the
      // Downloads screen over a bad write.
    }
    return [];
  }

  static Future<void> saveAll(List<DownloadedItem> items) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(items.map((i) => i.toJson()).toList()));
  }

  static Future<void> upsert(DownloadedItem item) async {
    final all = await getAll();
    all.removeWhere((i) => i.videoId == item.videoId);
    all.insert(0, item);
    await saveAll(all);
  }

  static Future<void> remove(String videoId) async {
    final all = await getAll();
    all.removeWhere((i) => i.videoId == videoId);
    await saveAll(all);
  }
}
