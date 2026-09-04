import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../services/auth_service.dart';

final authStateProvider = StateNotifierProvider<AuthNotifier, AuthState>((ref) {
  return AuthNotifier(ref.read(authServiceProvider));
});

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthService _authService;
  final _logger = Logger();
  static const _cachedNameKey = 'inplayer:cached_user_name';

  AuthNotifier(this._authService) : super(const AuthState.initial()) {
    _init();
  }

  /// Keeps the startup greeting available before Cognito/profile hydration has
  /// finished on the next cold launch. Some accounts only have a handle, so
  /// never overwrite a useful cached value with an empty display name.
  Future<void> _cacheDisplayName(User user) async {
    final name = user.name.trim().isNotEmpty
        ? user.name.trim()
        : user.username.trim();
    if (name.isEmpty) return;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_cachedNameKey, name);
  }

  Future<void> _init() async {
    try {
      await _authService.configureAmplify();
      final isSignedIn = await _authService.isSignedIn();

      if (isSignedIn) {
        final user = await _authService.getCurrentUser();
        if (user != null) {
          await _cacheDisplayName(user);
          state = AuthState.authenticated(user);
        } else {
          state = const AuthState.unauthenticated();
        }
      } else {
        state = const AuthState.unauthenticated();
      }
    } catch (e) {
      _logger.e('Error initializing auth: $e');
      state = const AuthState.unauthenticated();
    }
  }

  Future<bool> signIn({required String email, required String password}) async {
    state = const AuthState.loading();

    final result = await _authService.signIn(email: email, password: password);

    if (result.success && result.user != null) {
      await _cacheDisplayName(result.user!);
      state = AuthState.authenticated(result.user!);
      return true;
    } else {
      state = AuthState.error(result.error ?? 'Sign in failed');
      return false;
    }
  }

  Future<bool> signInWithGoogle() async {
    state = const AuthState.loading();

    final result = await _authService.signInWithGoogle();

    if (result.success && result.user != null) {
      await _cacheDisplayName(result.user!);
      state = AuthState.authenticated(result.user!);
      return true;
    } else {
      state = AuthState.error(result.error ?? 'Google sign in failed');
      return false;
    }
  }

  Future<void> signUp({
    required String email,
    required String password,
    required String name,
  }) async {
    state = const AuthState.loading();

    final result = await _authService.signUp(
      email: email,
      password: password,
      name: name,
    );

    if (result.success) {
      state = AuthState.needsVerification(email);
    } else {
      state = AuthState.error(result.error ?? 'Sign up failed');
    }
  }

  /// Returns true on success; the reason for a failure is also written to
  /// [state]. ForgotPasswordModal needs the boolean because it drives a flow
  /// rather than just watching state, and verify_email_page keeps watching
  /// state as before — awaiting and discarding the result is fine.
  Future<bool> confirmSignUp({
    required String email,
    required String code,
  }) async {
    state = const AuthState.loading();

    final result = await _authService.confirmSignUp(email: email, code: code);

    if (result.success) {
      state = const AuthState.unauthenticated();
      return true;
    }
    state = AuthState.error(result.error ?? 'Verification failed');
    return false;
  }

  /// Sends a fresh sign-up confirmation code. See
  /// AuthService.resendVerificationCode for why this exists.
  Future<String?> resendVerificationCode({required String email}) async {
    try {
      return await _authService.resendVerificationCode(email: email);
    } catch (e) {
      _logger.e('Error resending verification code: $e');
      rethrow;
    }
  }

  Future<void> signOut() async {
    state = const AuthState.loading();

    try {
      await _authService.signOut();
      state = const AuthState.unauthenticated();
    } catch (e) {
      _logger.e('Error signing out: $e');
      state = AuthState.error('Sign out failed');
    }
  }

  /// For when the session has already ended by some other means (e.g.
  /// AuthService.deleteUser() during account deletion) ΓÇö just reflects
  /// that locally instead of calling _authService.signOut() again, which
  /// would fail against a session that's already gone.
  void setUnauthenticated() {
    state = const AuthState.unauthenticated();
  }

  /// Returns the masked destination Cognito reported (e.g. `r***@g***.com`),
  /// or null if it reported none.
  ///
  /// The rethrow is the point. This used to catch the error, write it into
  /// `state`, and return normally — so ForgotPasswordModal's own try/catch
  /// never fired and it advanced to "we sent you a 6-digit code" even when
  /// Cognito had rejected the request outright. The screen promised an email
  /// that was never sent, and the real reason sat in a state field nothing
  /// was listening to.
  Future<String?> resetPassword({required String email}) async {
    try {
      final destination = await _authService.resetPassword(email: email);
      state = AuthState.passwordResetSent(email);
      return destination;
    } catch (e) {
      _logger.e('Error resetting password: $e');
      state = AuthState.error('Password reset failed');
      rethrow;
    }
  }

  Future<void> confirmResetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    state = const AuthState.loading();

    try {
      await _authService.confirmResetPassword(
        email: email,
        code: code,
        newPassword: newPassword,
      );
      state = const AuthState.unauthenticated();
    } catch (e) {
      // Same swallow as resetPassword above, and worse here: a wrong or
      // expired code reported SUCCESS and bounced the person to sign-in,
      // where their old password still worked and nothing explained why.
      _logger.e('Error confirming password reset: $e');
      state = AuthState.error('Password reset confirmation failed');
      rethrow;
    }
  }

  Future<void> refreshUser() async {
    final currentState = state;
    if (currentState is AuthStateAuthenticated) {
      try {
        final user = await _authService.getCurrentUser();
        if (user != null) {
          await _cacheDisplayName(user);
          state = AuthState.authenticated(user);
        }
      } catch (e) {
        _logger.e('Error refreshing user: $e');
      }
    }
  }

  /// Applies a local edit to the signed-in user without a round trip to
  /// Cognito. Needed because fields like display name/bio/privacy are the
  /// app's own DynamoDB profile data (see app/api/profile/settings/route.ts),
  /// not Cognito user attributes ΓÇö [refreshUser] re-reads from Cognito, so
  /// it would NOT pick up a just-saved name/bio/privacy change. Call this
  /// right after a successful settings save instead.
  void updateLocalUser(User Function(User current) update) {
    final currentState = state;
    if (currentState is AuthStateAuthenticated) {
      state = AuthState.authenticated(update(currentState.user));
    }
  }
}

class AuthState {
  const AuthState();

  const factory AuthState.initial() = AuthStateInitial;
  const factory AuthState.loading() = AuthStateLoading;
  const factory AuthState.authenticated(User user) = AuthStateAuthenticated;
  const factory AuthState.unauthenticated() = AuthStateUnauthenticated;
  const factory AuthState.needsVerification(String email) =
      AuthStateNeedsVerification;
  const factory AuthState.passwordResetSent(String email) =
      AuthStatePasswordResetSent;
  const factory AuthState.error(String message) = AuthStateError;
}

class AuthStateInitial extends AuthState {
  const AuthStateInitial();
}

class AuthStateLoading extends AuthState {
  const AuthStateLoading();
}

class AuthStateAuthenticated extends AuthState {
  final User user;
  const AuthStateAuthenticated(this.user);
}

class AuthStateUnauthenticated extends AuthState {
  const AuthStateUnauthenticated();
}

class AuthStateNeedsVerification extends AuthState {
  final String email;
  const AuthStateNeedsVerification(this.email);
}

class AuthStatePasswordResetSent extends AuthState {
  final String email;
  const AuthStatePasswordResetSent(this.email);
}

class AuthStateError extends AuthState {
  final String message;
  const AuthStateError(this.message);
}
