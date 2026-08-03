import '../entities/auth_user.dart';

abstract class AuthRepository {
  /// Returns the currently signed-in user.
  Future<AuthUser?> getCurrentUser();

  /// Returns true if a valid authenticated session exists.
  Future<bool> isSignedIn();

  /// Sign in using email and password.
  Future<AuthUser> signIn({
    required String email,
    required String password,
  });

  /// Sign out the current user.
  Future<void> signOut();
}