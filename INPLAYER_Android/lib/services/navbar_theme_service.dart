import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/constants/api_constants.dart';
import '../core/network/dio_client.dart';
import '../models/admin_navbar_theme.dart';

/// Reads the site-wide occasion navbar theme (e.g. a Diwali/Independence
/// Day graphic next to the logo) an admin turned on from the admin panel —
/// GET /api/navbar-theme, the exact same PUBLIC, unauthenticated endpoint
/// the website's own Navbar.tsx already polls on every page load.
///
/// This is a genuinely separate concern from AdminService.getNavbarTheme(),
/// which hits the ADMIN-only `/api/admin/navbar-theme` endpoint used by the
/// in-app admin panel's own editor screen — that one needs an admin
/// session; this one works for every signed-in or signed-out visitor,
/// which is what a regular user's home screen needs to show the theme at
/// all. Before this file existed, the app had the admin editor (so an
/// admin COULD set a theme from their phone) but nothing that ever
/// displayed it to a normal user — an occasion theme an admin turned on
/// would show on the website but never appear in the app.
class NavbarThemeService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  /// Fails open to null (no theme shown) on any error — the same rule
  /// PlatformSettingsService.fetch() follows for the same reason: this
  /// data only ever adds a decorative element, so a timeout or a 500 must
  /// never be able to break the home screen's app bar.
  Future<AdminNavbarTheme?> fetch() async {
    try {
      final response = await _dio.get(ApiConstants.navbarTheme);
      if (response.statusCode == 200 && response.data is Map) {
        final theme = AdminNavbarTheme.fromPublicJson(
          Map<String, dynamic>.from(response.data as Map),
        );
        if (theme.active && theme.imageUrl.isNotEmpty) return theme;
      }
      return null;
    } catch (e) {
      _logger.w('Could not read navbar theme: $e');
      return null;
    }
  }
}

final navbarThemeServiceProvider = Provider<NavbarThemeService>(
  (ref) => NavbarThemeService(),
);

/// Current occasion navbar theme, or null if none is active. Mirrors
/// [publicPlatformSettingsProvider]'s shape: a FutureProvider re-read on
/// launch (and wherever HomePage already invalidates
/// publicPlatformSettingsProvider on foreground) rather than a stream —
/// this changes only when an admin manually turns a theme on or off, so
/// polling on a timer would be pure waste.
final publicNavbarThemeProvider = FutureProvider<AdminNavbarTheme?>((
  ref,
) async {
  return ref.read(navbarThemeServiceProvider).fetch();
});
