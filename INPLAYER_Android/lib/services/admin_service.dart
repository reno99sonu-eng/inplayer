import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/admin_user.dart';
import '../models/admin_dashboard_stats.dart';
import '../models/moderation_item.dart';
import '../models/admin_analytics.dart';
import '../models/admin_revenue.dart';
import '../models/admin_video_row.dart';
import '../models/admin_creator_kyc.dart';
import '../models/admin_copyright_report.dart';
import '../models/admin_ai_moderation.dart';
import '../models/admin_hammart.dart';
import '../models/admin_ad_creative.dart';
import '../models/admin_navbar_theme.dart';
import '../models/admin_platform_settings.dart';
import '../models/admin_audit_log.dart';
import '../models/admin_error_log.dart';
import '../models/admin_bug_report.dart';
import '../models/admin_support_ticket.dart';
import '../models/admin_hammart_order.dart';
import '../models/admin_sponsorship.dart';

final adminServiceProvider = Provider<AdminService>((ref) {
  return AdminService();
});

/// Full admin API surface — extended across several rounds. Round 7 covered
/// Dashboard/Users/Moderation; this round ("finish whole admin panel")
/// wires up everything else read from the website's app/api/admin/* routes:
/// Analytics, Revenue, Videos browser, Creator payout KYC, Copyright
/// strikes, AI Moderation observability, Hammart Products/Vendors,
/// Advertising (ads/midroll/navbar theme), Platform Settings,
/// Notifications broadcast, Audit/Error Logs, Bug Reports, and maintenance
/// tools. Every method follows the same fail-soft pattern already
/// established below: never throw out to the UI, log and return an honest
/// empty/failed result instead.
class AdminService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  // ── Access gate / Dashboard (Round 7) ────────────────────────────────

  /// GET /api/admin/me — the ONLY way a client can find out whether the
  /// signed-in account is an admin (the real admin allowlist is a
  /// server-only env var). Never reveals the allowlist itself, only
  /// whether the caller is on it.
  Future<bool> checkIsAdmin() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/me');
      return response.statusCode == 200 && response.data is Map && response.data['isAdmin'] == true;
    } catch (e) {
      _logger.e('Error checking admin status: $e');
      return false;
    }
  }

  Future<AdminDashboardStats?> getDashboardStats() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/dashboard-stats');
      if (response.statusCode == 200 && response.data is Map) {
        return AdminDashboardStats.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return null;
    } catch (e) {
      _logger.e('Error fetching admin dashboard stats: $e');
      return null;
    }
  }

  // ── Users (Round 7) ───────────────────────────────────────────────────

  Future<AdminUsersResult> getUsers({String? query, String? cursor}) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.admin}/users',
        queryParameters: {
          if (query != null && query.isNotEmpty) 'query': query,
          if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
        },
      );
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final users = (data['users'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminUser.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return AdminUsersResult(users: users, nextCursor: data['nextCursor'] as String?);
      }
      return AdminUsersResult(users: []);
    } catch (e) {
      _logger.e('Error fetching admin users: $e');
      return AdminUsersResult(users: []);
    }
  }

  Future<bool> setSuspended(String userId, bool isSuspended) async {
    try {
      final response = await _dio.patch(
        '${ApiConstants.admin}/users/$userId',
        data: {'isSuspended': isSuspended},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error setting suspended state: $e');
      return false;
    }
  }

  Future<AdminActionResult> deleteUser(String userId) async {
    try {
      final response = await _dio.delete('${ApiConstants.admin}/users/$userId');
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        return AdminActionResult(
          success: data['success'] == true,
          warnings: (data['warnings'] as List?)?.whereType<String>().toList() ?? [],
        );
      }
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return AdminActionResult(success: false, error: error ?? "Couldn't delete that user.");
    } catch (e) {
      _logger.e('Error deleting user: $e');
      return AdminActionResult(success: false, error: "Couldn't delete that user.");
    }
  }

  // ── Moderation (Round 7) ─────────────────────────────────────────────

  Future<AdminModerationReportsResult> getReports() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/moderation', queryParameters: {'tab': 'reports'});
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final items = (data['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminReport.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return AdminModerationReportsResult(items: items, tableMissing: data['tableMissing'] == true);
      }
      return AdminModerationReportsResult(items: []);
    } catch (e) {
      _logger.e('Error fetching reports: $e');
      return AdminModerationReportsResult(items: []);
    }
  }

  Future<List<AdminFlaggedItem>> getAutoFlagged() async {
    try {
      final response =
          await _dio.get('${ApiConstants.admin}/moderation', queryParameters: {'tab': 'autoflagged'});
      if (response.statusCode == 200 && response.data is Map) {
        return ((response.data as Map)['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminFlaggedItem.fromJson(Map<String, dynamic>.from(j)))
            .toList();
      }
      return [];
    } catch (e) {
      _logger.e('Error fetching auto-flagged content: $e');
      return [];
    }
  }

  Future<List<AdminStrikeUser>> getStrikes() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/moderation', queryParameters: {'tab': 'strikes'});
      if (response.statusCode == 200 && response.data is Map) {
        return ((response.data as Map)['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminStrikeUser.fromJson(Map<String, dynamic>.from(j)))
            .toList();
      }
      return [];
    } catch (e) {
      _logger.e('Error fetching strike queue: $e');
      return [];
    }
  }

  Future<bool> banAction(String userId, String action) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.admin}/moderation',
        data: {'userId': userId, 'action': action},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error applying ban action "$action": $e');
      return false;
    }
  }

  Future<bool> resolveReport(String reportId, {bool resolved = true}) async {
    try {
      final response = await _dio.patch(
        '${ApiConstants.admin}/reports/$reportId',
        data: {'status': resolved ? 'resolved' : 'open'},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error resolving report: $e');
      return false;
    }
  }

  Future<bool> restoreComment(String videoId, String commentId) => _actOnComment('PATCH', videoId, commentId);
  Future<bool> deleteComment(String videoId, String commentId) => _actOnComment('DELETE', videoId, commentId);

  Future<bool> _actOnComment(String method, String videoId, String commentId) async {
    try {
      final path = '${ApiConstants.admin}/comments/$videoId/$commentId';
      final response = method == 'PATCH' ? await _dio.patch(path) : await _dio.delete(path);
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error acting on comment: $e');
      return false;
    }
  }

  Future<bool> restoreMessage(String conversationId, String messageId) =>
      _actOnMessage('PATCH', conversationId, messageId);
  Future<bool> deleteMessageContent(String conversationId, String messageId) =>
      _actOnMessage('DELETE', conversationId, messageId);

  Future<bool> _actOnMessage(String method, String conversationId, String messageId) async {
    try {
      final path = '${ApiConstants.admin}/messages/$conversationId/$messageId';
      final response = method == 'PATCH' ? await _dio.patch(path) : await _dio.delete(path);
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error acting on message: $e');
      return false;
    }
  }

  Future<bool> restoreVideo(String videoId) => _actOnVideo('PATCH', videoId);
  Future<bool> deleteVideo(String videoId) => _actOnVideo('DELETE', videoId);

  Future<bool> _actOnVideo(String method, String videoId) async {
    try {
      final path = '${ApiConstants.admin}/videos/$videoId';
      final response = method == 'PATCH' ? await _dio.patch(path) : await _dio.delete(path);
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error acting on video: $e');
      return false;
    }
  }

  // ── Analytics ─────────────────────────────────────────────────────────

  Future<AdminAnalytics?> getAnalytics() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/analytics');
      if (response.statusCode == 200 && response.data is Map) {
        return AdminAnalytics.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return null;
    } catch (e) {
      _logger.e('Error fetching analytics: $e');
      return null;
    }
  }

  // ── Revenue ───────────────────────────────────────────────────────────

  Future<AdminRevenueResult> getRevenue() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/revenue');
      if (response.statusCode == 200 && response.data is Map) {
        return AdminRevenueResult.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return AdminRevenueResult(tableMissing: true);
    } catch (e) {
      _logger.e('Error fetching revenue: $e');
      return AdminRevenueResult(tableMissing: true);
    }
  }

  // ── Content browser (Videos) ─────────────────────────────────────────

  /// The admin content browser.
  ///
  /// [type] is 'video' | 'short' | 'music' (null = all three). Music is its
  /// own content kind server-side, not a flavour of video — see the
  /// TYPE_VALUES comment in app/api/admin/videos/route.ts — so it gets its
  /// own tab here exactly as it does on the website.
  ///
  /// [status] is 'live' | 'processing' | 'ready' | 'error'. Note 'ready'
  /// also matches rows with no status attribute at all, i.e. everything
  /// uploaded before that field existed.
  ///
  /// [includeCounts] asks for the per-status totals behind the filter
  /// badges. The route computes those with a second full-table scan and
  /// skips it whenever a search query is active, so only ask on a first,
  /// unsearched page — which is exactly when the numbers mean anything.
  Future<AdminVideosResult> getAdminVideos({
    String? type,
    String? status,
    String? query,
    String? cursor,
    bool includeCounts = false,
  }) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.admin}/videos',
        queryParameters: {
          if (type != null && type.isNotEmpty) 'type': type,
          if (status != null && status.isNotEmpty) 'status': status,
          if (query != null && query.isNotEmpty) 'query': query,
          if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
          if (includeCounts) 'counts': '1',
        },
      );
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final videos = (data['videos'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminVideoRow.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        final rawCounts = data['counts'];
        final counts = <String, int>{};
        if (rawCounts is Map) {
          rawCounts.forEach((k, v) {
            final n = v is num ? v.toInt() : int.tryParse(v.toString());
            if (n != null) counts[k.toString()] = n;
          });
        }
        return AdminVideosResult(
          videos: videos,
          nextCursor: data['nextCursor'] as String?,
          counts: counts,
        );
      }
      return AdminVideosResult();
    } catch (e) {
      _logger.e('Error fetching admin video browser: $e');
      return AdminVideosResult();
    }
  }

  // ── Creator payout KYC ───────────────────────────────────────────────

  Future<AdminCreatorsResult> getCreatorsKyc({String tab = 'pending_review'}) async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/creators', queryParameters: {'tab': tab});
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final items = (data['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminCreatorKyc.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return AdminCreatorsResult(items: items, tableMissing: data['tableMissing'] == true);
      }
      return AdminCreatorsResult(items: []);
    } catch (e) {
      _logger.e('Error fetching creator KYC queue: $e');
      return AdminCreatorsResult(items: []);
    }
  }

  Future<AdminActionResult> creatorKycAction(String userId, String action, {String? reason}) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.admin}/creators',
        data: {
          'userId': userId,
          'action': action,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      );
      if (response.statusCode == 200) return AdminActionResult(success: true);
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return AdminActionResult(success: false, error: error ?? "Couldn't do that.");
    } catch (e) {
      _logger.e('Error applying creator KYC action "$action": $e');
      return AdminActionResult(success: false, error: "Couldn't do that. Try again.");
    }
  }

  // ── Copyright strikes ────────────────────────────────────────────────

  Future<AdminCopyrightResult> getCopyrightReports() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/copyright');
      if (response.statusCode == 200 && response.data is Map) {
        return AdminCopyrightResult.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return AdminCopyrightResult(tableMissing: true);
    } catch (e) {
      _logger.e('Error fetching copyright queue: $e');
      return AdminCopyrightResult(tableMissing: true);
    }
  }

  Future<AdminActionResult> copyrightAction(String reportId, String action, {bool removeVideo = false}) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.admin}/copyright',
        data: {'reportId': reportId, 'action': action, if (action == 'strike') 'removeVideo': removeVideo},
      );
      if (response.statusCode == 200) return AdminActionResult(success: true);
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return AdminActionResult(success: false, error: error ?? "Couldn't do that.");
    } catch (e) {
      _logger.e('Error applying copyright action "$action": $e');
      return AdminActionResult(success: false, error: "Couldn't do that. Try again.");
    }
  }

  // ── AI Moderation observability ──────────────────────────────────────

  Future<AdminAiModerationOverview?> getAiModerationOverview() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/ai-moderation');
      if (response.statusCode == 200 && response.data is Map) {
        return AdminAiModerationOverview.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return null;
    } catch (e) {
      _logger.e('Error fetching AI moderation overview: $e');
      return null;
    }
  }

  // ── Platform Settings ────────────────────────────────────────────────

  Future<AdminPlatformSettings?> getPlatformSettings() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/settings');
      if (response.statusCode == 200 && response.data is Map) {
        final settings = (response.data as Map)['settings'];
        if (settings is Map) return AdminPlatformSettings.fromJson(Map<String, dynamic>.from(settings));
      }
      return null;
    } catch (e) {
      _logger.e('Error fetching platform settings: $e');
      return null;
    }
  }

  Future<AdminPlatformSettings?> updatePlatformSettings(Map<String, dynamic> partial) async {
    try {
      final response = await _dio.patch('${ApiConstants.admin}/settings', data: partial);
      if (response.statusCode == 200 && response.data is Map) {
        final settings = (response.data as Map)['settings'];
        if (settings is Map) return AdminPlatformSettings.fromJson(Map<String, dynamic>.from(settings));
      }
      return null;
    } catch (e) {
      _logger.e('Error updating platform settings: $e');
      return null;
    }
  }

  // ── Notifications broadcast ──────────────────────────────────────────

  Future<AdminBroadcastResult> sendBroadcast({required String target, required String message, String? username}) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.admin}/notifications',
        data: {
          'target': target,
          'message': message,
          if (username != null && username.isNotEmpty) 'username': username,
        },
      );
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        return AdminBroadcastResult(success: true, sentCount: (data['sentCount'] as num?)?.toInt() ?? 0);
      }
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return AdminBroadcastResult(success: false, error: error ?? "Couldn't send that.");
    } catch (e) {
      _logger.e('Error sending broadcast notification: $e');
      return AdminBroadcastResult(success: false, error: "Couldn't send that. Try again.");
    }
  }

  // ── Navbar Theme ──────────────────────────────────────────────────────

  Future<AdminNavbarTheme?> getNavbarTheme() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/navbar-theme');
      if (response.statusCode == 200 && response.data is Map) {
        final theme = (response.data as Map)['theme'];
        if (theme is Map) return AdminNavbarTheme.fromJson(Map<String, dynamic>.from(theme));
      }
      return null;
    } catch (e) {
      _logger.e('Error fetching navbar theme: $e');
      return null;
    }
  }

  Future<AdminActionResult> setNavbarTheme({
    required String imageUrl,
    String? occasionId,
    String? occasionName,
    String? title,
    bool active = true,
  }) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.admin}/navbar-theme',
        data: {
          'imageUrl': imageUrl,
          if (occasionId != null && occasionId.isNotEmpty) 'occasionId': occasionId,
          if (occasionName != null && occasionName.isNotEmpty) 'occasionName': occasionName,
          if (title != null && title.isNotEmpty) 'title': title,
          'active': active,
        },
      );
      if (response.statusCode == 200) return AdminActionResult(success: true);
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return AdminActionResult(success: false, error: error ?? "Couldn't save that theme.");
    } catch (e) {
      _logger.e('Error saving navbar theme: $e');
      return AdminActionResult(success: false, error: "Couldn't save that theme. Try again.");
    }
  }

  Future<bool> deleteNavbarTheme() async {
    try {
      final response = await _dio.delete('${ApiConstants.admin}/navbar-theme');
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error deleting navbar theme: $e');
      return false;
    }
  }

  // ── Hammart Products ──────────────────────────────────────────────────

  Future<AdminHammartProductsResult> getHammartProducts({String tab = 'flagged'}) async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/hammart-products', queryParameters: {'tab': tab});
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final items = (data['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminHammartProduct.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return AdminHammartProductsResult(items: items, tableMissing: data['tableMissing'] == true);
      }
      return AdminHammartProductsResult(items: []);
    } catch (e) {
      _logger.e('Error fetching Hammart product queue: $e');
      return AdminHammartProductsResult(items: []);
    }
  }

  Future<bool> hammartProductAction(String productId, String action) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.admin}/hammart-products',
        data: {'productId': productId, 'action': action},
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error applying Hammart product action "$action": $e');
      return false;
    }
  }

  // ── Hammart Vendors ───────────────────────────────────────────────────

  Future<AdminHammartVendorsResult> getHammartVendors({String tab = 'pending_review'}) async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/hammart-vendors', queryParameters: {'tab': tab});
      if (response.statusCode == 200 && response.data is Map) {
        return AdminHammartVendorsResult.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return AdminHammartVendorsResult(tableMissing: true);
    } catch (e) {
      _logger.e('Error fetching Hammart vendor queue: $e');
      return AdminHammartVendorsResult(tableMissing: true);
    }
  }

  Future<AdminActionResult> hammartVendorAction(String userId, String action, {String? reason}) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.admin}/hammart-vendors',
        data: {
          'userId': userId,
          'action': action,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      );
      if (response.statusCode == 200) return AdminActionResult(success: true);
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return AdminActionResult(success: false, error: error ?? "Couldn't do that.");
    } catch (e) {
      _logger.e('Error applying Hammart vendor action "$action": $e');
      return AdminActionResult(success: false, error: "Couldn't do that. Try again.");
    }
  }

  // ── Advertising: static placements (homepage/watch/weekly_featured) ──

  Future<AdminAdsResult> getAds() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/ads');
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final items = (data['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminAdCreative.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return AdminAdsResult(items: items, tableMissing: data['tableMissing'] == true);
      }
      return AdminAdsResult(items: []);
    } catch (e) {
      _logger.e('Error fetching ad creatives: $e');
      return AdminAdsResult(items: []);
    }
  }

  Future<AdminActionResult> createAd({
    required String placement,
    required String imageUrl,
    String? imageUrlDesktop,
    required String linkUrl,
    required String title,
  }) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.admin}/ads',
        data: {
          'placement': placement,
          'imageUrl': imageUrl,
          if (imageUrlDesktop != null && imageUrlDesktop.isNotEmpty) 'imageUrlDesktop': imageUrlDesktop,
          'linkUrl': linkUrl,
          'title': title,
        },
      );
      if (response.statusCode == 200) return AdminActionResult(success: true);
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return AdminActionResult(success: false, error: error ?? "Couldn't create that ad.");
    } catch (e) {
      _logger.e('Error creating ad creative: $e');
      return AdminActionResult(success: false, error: "Couldn't create that ad. Try again.");
    }
  }

  Future<bool> updateAd(String adId, Map<String, dynamic> partial) async {
    try {
      final response = await _dio.patch('${ApiConstants.admin}/ads/$adId', data: partial);
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error updating ad creative: $e');
      return false;
    }
  }

  Future<bool> deleteAd(String adId) async {
    try {
      final response = await _dio.delete('${ApiConstants.admin}/ads/$adId');
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error deleting ad creative: $e');
      return false;
    }
  }

  // ── Advertising: mid-roll ─────────────────────────────────────────────

  Future<AdminMidrollAdsResult> getMidrollAds() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/midroll-ads');
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final items = (data['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminMidrollAdCreative.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return AdminMidrollAdsResult(items: items, tableMissing: data['tableMissing'] == true);
      }
      return AdminMidrollAdsResult(items: []);
    } catch (e) {
      _logger.e('Error fetching mid-roll ad creatives: $e');
      return AdminMidrollAdsResult(items: []);
    }
  }

  /// Creates an IMAGE mid-roll ad only. Video mid-roll ads go through a
  /// separate Mux direct-upload flow (POST create-upload -> PUT to Mux ->
  /// webhook) that this build deliberately doesn't include — see the
  /// Round 8 project doc note.
  Future<AdminActionResult> createMidrollAd({required String imageUrl, required String linkUrl, required String title}) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.admin}/midroll-ads',
        data: {'imageUrl': imageUrl, 'linkUrl': linkUrl, 'title': title},
      );
      if (response.statusCode == 200) return AdminActionResult(success: true);
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return AdminActionResult(success: false, error: error ?? "Couldn't create that ad.");
    } catch (e) {
      _logger.e('Error creating mid-roll ad creative: $e');
      return AdminActionResult(success: false, error: "Couldn't create that ad. Try again.");
    }
  }

  Future<bool> updateMidrollAd(String adId, Map<String, dynamic> partial) async {
    try {
      final response = await _dio.patch('${ApiConstants.admin}/midroll-ads/$adId', data: partial);
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error updating mid-roll ad creative: $e');
      return false;
    }
  }

  Future<bool> deleteMidrollAd(String adId) async {
    try {
      final response = await _dio.delete('${ApiConstants.admin}/midroll-ads/$adId');
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error deleting mid-roll ad creative: $e');
      return false;
    }
  }

  // ── Audit Logs ────────────────────────────────────────────────────────

  Future<AdminAuditLogResult> getAuditLogs() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/audit-logs');
      if (response.statusCode == 200 && response.data is Map) {
        return AdminAuditLogResult.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return AdminAuditLogResult(tableMissing: true);
    } catch (e) {
      _logger.e('Error fetching audit logs: $e');
      return AdminAuditLogResult(tableMissing: true);
    }
  }

  // ── Error Logs ────────────────────────────────────────────────────────

  Future<AdminErrorLogsResult> getErrorLogs() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/error-logs');
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final logs = (data['logs'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminErrorLog.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return AdminErrorLogsResult(logs: logs, tableMissing: data['tableMissing'] == true);
      }
      return AdminErrorLogsResult(logs: []);
    } catch (e) {
      _logger.e('Error fetching error logs: $e');
      return AdminErrorLogsResult(logs: []);
    }
  }

  Future<bool> deleteErrorLog(String errorId) async {
    try {
      final response = await _dio.delete('${ApiConstants.admin}/error-logs', queryParameters: {'id': errorId});
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error deleting error log: $e');
      return false;
    }
  }

  Future<bool> clearErrorLogs() async {
    try {
      final response = await _dio.delete('${ApiConstants.admin}/error-logs');
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error clearing error logs: $e');
      return false;
    }
  }

  // ── Bug Reports ───────────────────────────────────────────────────────

  Future<AdminBugReportsResult> getBugReports({String? status}) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.admin}/bug-reports',
        queryParameters: {
          if (status != null && status.isNotEmpty) 'status': status,
        },
      );
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final reports = (data['reports'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminBugReport.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return AdminBugReportsResult(reports: reports, tableMissing: data['tableMissing'] == true);
      }
      return AdminBugReportsResult(reports: []);
    } catch (e) {
      _logger.e('Error fetching bug reports: $e');
      return AdminBugReportsResult(reports: []);
    }
  }

  Future<bool> updateBugReportStatus(String reportId, String status, {String? adminNotes}) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.admin}/bug-reports',
        data: {
          'reportId': reportId,
          'status': status,
          if (adminNotes != null && adminNotes.isNotEmpty) 'adminNotes': adminNotes,
        },
      );
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error updating bug report status: $e');
      return false;
    }
  }

  // ── Maintenance tools ─────────────────────────────────────────────────

  /// One call = one time-boxed pass (see app/api/admin/recaption/route.ts's
  /// 90s TIME_BUDGET_MS). `done: false` means there's more to do — call
  /// again to resume; the UI loops this until `done` is true.
  Future<RecaptionRunResult?> repairCaptions() async {
    try {
      final response = await _dio.post('${ApiConstants.admin}/recaption', options: _longTimeout);
      if (response.statusCode == 200 && response.data is Map) {
        return RecaptionRunResult.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return null;
    } catch (e) {
      _logger.e('Error running caption repair: $e');
      return null;
    }
  }

  Future<SelfHealRunResult?> selfHealVideos() async {
    try {
      final response = await _dio.post('${ApiConstants.admin}/self-heal-videos', options: _longTimeout);
      if (response.statusCode == 200 && response.data is Map) {
        return SelfHealRunResult.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return null;
    } catch (e) {
      _logger.e('Error running self-heal videos: $e');
      return null;
    }
  }

  Future<BackfillThumbnailsRunResult?> backfillShortThumbnails() async {
    try {
      final response = await _dio.post('${ApiConstants.admin}/backfill-short-thumbnails', options: _longTimeout);
      if (response.statusCode == 200 && response.data is Map) {
        return BackfillThumbnailsRunResult.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return null;
    } catch (e) {
      _logger.e('Error running Shorts thumbnail backfill: $e');
      return null;
    }
  }

  // ── Support Desk ───────────────────────────────────────────────────────

  Future<AdminSupportResult> getSupportTickets({String domain = 'inplayer', String? status}) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.admin}/support',
        queryParameters: {
          'domain': domain,
          if (status != null && status.isNotEmpty && status != 'all') 'status': status,
        },
      );
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final tickets = (data['tickets'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminSupportTicket.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        final rawCounts = data['counts'] as Map? ?? {};
        final counts = <String, int>{};
        for (final entry in rawCounts.entries) {
          counts[entry.key.toString()] = (entry.value as num?)?.toInt() ?? 0;
        }
        return AdminSupportResult(
          tickets: tickets,
          counts: counts,
          tableMissing: data['tableMissing'] == true,
        );
      }
      return AdminSupportResult(tickets: []);
    } catch (e) {
      _logger.e('Error fetching admin support tickets: $e');
      return AdminSupportResult(tickets: []);
    }
  }

  Future<bool> updateSupportTicketStatus(String ticketId, String status, {String? adminNotes}) async {
    try {
      final response = await _dio.patch(
        '${ApiConstants.admin}/support',
        data: {
          'ticketId': ticketId,
          'status': status,
          // ignore: use_null_aware_elements
          if (adminNotes != null) 'adminNotes': adminNotes,
        },
      );
      return response.statusCode == 200 && response.data is Map && response.data['success'] == true;
    } catch (e) {
      _logger.e('Error updating support ticket status: $e');
      return false;
    }
  }

  // ── Hammart Orders ─────────────────────────────────────────────────────

  Future<AdminHammartOrdersResult> getHammartOrders({String tab = 'all'}) async {
    try {
      final response = await _dio.get(
        '${ApiConstants.admin}/hammart-orders',
        queryParameters: {'tab': tab},
      );
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final items = (data['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminHammartOrder.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        final rawCounts = data['counts'] as Map? ?? {};
        final counts = <String, int>{};
        for (final entry in rawCounts.entries) {
          counts[entry.key.toString()] = (entry.value as num?)?.toInt() ?? 0;
        }
        return AdminHammartOrdersResult(
          items: items,
          counts: counts,
          tableMissing: data['tableMissing'] == true,
        );
      }
      return AdminHammartOrdersResult(items: []);
    } catch (e) {
      _logger.e('Error fetching admin hammart orders: $e');
      return AdminHammartOrdersResult(items: []);
    }
  }

  // ── Sponsorships ───────────────────────────────────────────────────────

  Future<AdminSponsorshipsResult> getSponsorships() async {
    try {
      final response = await _dio.get('${ApiConstants.admin}/sponsorships');
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final items = (data['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => AdminSponsorship.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return AdminSponsorshipsResult(
          items: items,
          tableMissing: data['tableMissing'] == true,
        );
      }
      return AdminSponsorshipsResult(items: []);
    } catch (e) {
      _logger.e('Error fetching admin sponsorships: $e');
      return AdminSponsorshipsResult(items: []);
    }
  }
}

// Maintenance calls can legitimately take close to the backend's own
// ~90s-300s budget (see recaption/route.ts's maxDuration/TIME_BUDGET_MS) —
// give them real headroom instead of hitting DioClient's normal short
// request timeout.
final Options _longTimeout = Options(
  sendTimeout: const Duration(seconds: 100),
  receiveTimeout: const Duration(seconds: 100),
);

// ── Lightweight result wrappers (kept alongside the service, same
// convention as AdminUsersResult/AdminActionResult from Round 7) ─────────

class AdminUsersResult {
  final List<AdminUser> users;
  final String? nextCursor;
  AdminUsersResult({required this.users, this.nextCursor});
}

class AdminActionResult {
  final bool success;
  final List<String> warnings;
  final String? error;
  AdminActionResult({required this.success, this.warnings = const [], this.error});
}

class AdminModerationReportsResult {
  final List<AdminReport> items;
  final bool tableMissing;
  AdminModerationReportsResult({required this.items, this.tableMissing = false});
}

class AdminCreatorsResult {
  final List<AdminCreatorKyc> items;
  final bool tableMissing;
  AdminCreatorsResult({required this.items, this.tableMissing = false});
}

class AdminBroadcastResult {
  final bool success;
  final int sentCount;
  final String? error;
  AdminBroadcastResult({required this.success, this.sentCount = 0, this.error});
}

class AdminHammartProductsResult {
  final List<AdminHammartProduct> items;
  final bool tableMissing;
  AdminHammartProductsResult({required this.items, this.tableMissing = false});
}

class AdminAdsResult {
  final List<AdminAdCreative> items;
  final bool tableMissing;
  AdminAdsResult({required this.items, this.tableMissing = false});
}

class AdminMidrollAdsResult {
  final List<AdminMidrollAdCreative> items;
  final bool tableMissing;
  AdminMidrollAdsResult({required this.items, this.tableMissing = false});
}

class AdminErrorLogsResult {
  final List<AdminErrorLog> logs;
  final bool tableMissing;
  AdminErrorLogsResult({required this.logs, this.tableMissing = false});
}

class AdminBugReportsResult {
  final List<AdminBugReport> reports;
  final bool tableMissing;
  AdminBugReportsResult({required this.reports, this.tableMissing = false});
}

class RecaptionRunResult {
  final bool done;
  final int remainingVideos;
  final int shortsProcessed;
  final int videosProcessed;
  final List<String> errors;

  RecaptionRunResult({
    required this.done,
    this.remainingVideos = 0,
    this.shortsProcessed = 0,
    this.videosProcessed = 0,
    this.errors = const [],
  });

  factory RecaptionRunResult.fromJson(Map<String, dynamic> json) {
    final shorts = (json['shorts'] as Map?) ?? {};
    final videos = (json['videos'] as Map?) ?? {};
    final errors = <String>[
      ...(shorts['errors'] as List? ?? []).map((e) => e.toString()),
      ...(videos['errors'] as List? ?? []).map((e) => e.toString()),
    ];
    return RecaptionRunResult(
      done: json['done'] == true,
      remainingVideos: (json['remainingVideos'] as num?)?.toInt() ?? 0,
      shortsProcessed: (shorts['processed'] as num?)?.toInt() ?? 0,
      videosProcessed: (videos['processed'] as num?)?.toInt() ?? 0,
      errors: errors,
    );
  }
}

class SelfHealRunResult {
  final int totalStuck;
  final int healedToReady;
  final int healedToError;
  final int stillProcessing;
  final List<String> errors;

  SelfHealRunResult({
    this.totalStuck = 0,
    this.healedToReady = 0,
    this.healedToError = 0,
    this.stillProcessing = 0,
    this.errors = const [],
  });

  factory SelfHealRunResult.fromJson(Map<String, dynamic> json) {
    return SelfHealRunResult(
      totalStuck: (json['totalStuck'] as num?)?.toInt() ?? 0,
      healedToReady: (json['healedToReady'] as num?)?.toInt() ?? 0,
      healedToError: (json['healedToError'] as num?)?.toInt() ?? 0,
      stillProcessing: (json['stillProcessing'] as num?)?.toInt() ?? 0,
      errors: (json['errors'] as List? ?? []).map((e) => e.toString()).toList(),
    );
  }
}

class BackfillThumbnailsRunResult {
  final int processed;
  final int skippedCustomThumbnail;
  final int skippedNoPlaybackId;
  final List<String> errors;

  BackfillThumbnailsRunResult({
    this.processed = 0,
    this.skippedCustomThumbnail = 0,
    this.skippedNoPlaybackId = 0,
    this.errors = const [],
  });

  factory BackfillThumbnailsRunResult.fromJson(Map<String, dynamic> json) {
    return BackfillThumbnailsRunResult(
      processed: (json['processed'] as num?)?.toInt() ?? 0,
      skippedCustomThumbnail: (json['skippedCustomThumbnail'] as num?)?.toInt() ?? 0,
      skippedNoPlaybackId: (json['skippedNoPlaybackId'] as num?)?.toInt() ?? 0,
      errors: (json['errors'] as List? ?? []).map((e) => e.toString()).toList(),
    );
  }
}
