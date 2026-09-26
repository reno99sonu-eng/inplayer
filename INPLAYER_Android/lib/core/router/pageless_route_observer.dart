import 'package:flutter/widgets.dart';

/// Observes the root Navigator (registered on the GoRouter in app_router.dart).
///
/// [covered] is true while a route sits on top of go_router's own pages —
/// dialogs, bottom sheets, popup menus and Navigator.push()ed screens
/// (NowPlayingPage, OfflinePlayerPage, FullscreenPlayerPage...).
/// VideoMiniPlayerOverlay floats above the Navigator, so it hides while any
/// of these is up instead of covering them and stealing their taps.
///
/// It also keeps the whole route stack, so a page can ask what is above it
/// ([onlyAbove]) — WatchPage uses that to tell "only a menu/sheet over me"
/// apart from "another screen covers me" when deciding on Picture-in-Picture.
class PagelessRouteObserver extends NavigatorObserver {
  final ValueNotifier<bool> covered = ValueNotifier<bool>(false);

  /// True while the side drawer (MobileMenuDrawer) is open. A Scaffold
  /// drawer is not a route, so the Scaffolds that host it report it through
  /// onDrawerChanged; the mini window hides so it doesn't sit on top of the
  /// drawer's menu rows and take their taps.
  final ValueNotifier<bool> drawerOpen = ValueNotifier<bool>(false);

  final Set<Route<dynamic>> _routes = <Route<dynamic>>{};

  // Every route on the root Navigator, bottom to top — pages included.
  final List<Route<dynamic>> _stack = <Route<dynamic>>[];

  void _sync() => covered.value = _routes.isNotEmpty;

  /// Whether [route] is on the tracked root-Navigator stack.
  bool contains(Route<dynamic> route) => _stack.contains(route);

  /// Whether every route currently above [base] satisfies [allowed]. False
  /// when [base] isn't on the tracked stack, so callers stay conservative.
  bool onlyAbove(Route<dynamic> base, bool Function(Route<dynamic>) allowed) {
    final i = _stack.indexOf(base);
    if (i < 0) return false;
    return _stack.skip(i + 1).every(allowed);
  }

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _stack.add(route);
    if (route.settings is! Page) {
      _routes.add(route);
      _sync();
    }
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _stack.remove(route);
    if (_routes.remove(route)) _sync();
  }

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _stack.remove(route);
    if (_routes.remove(route)) _sync();
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    final i = oldRoute == null ? -1 : _stack.indexOf(oldRoute);
    if (i >= 0 && newRoute != null) {
      _stack[i] = newRoute;
    } else {
      if (oldRoute != null) _stack.remove(oldRoute);
      if (newRoute != null) _stack.add(newRoute);
    }
    if (oldRoute != null) _routes.remove(oldRoute);
    if (newRoute != null && newRoute.settings is! Page) _routes.add(newRoute);
    _sync();
  }
}

final pagelessRouteObserver = PagelessRouteObserver();
