import '../../domain/entities/auth_user.dart';

abstract class AuthRemoteDataSource {
  /// Returns the currently authenticated user, or null if no user is signed in.
  Future<AuthUser?> getCurrentUser();

  /// Returns true if a valid authenticated session exists.
  Future<bool> isSignedIn();

  /// Signs the user in and returns the authenticated user.
  Future<AuthUser> signIn({
    required String email,
    required String password,
  });

  /// Signs the current user out.
  Future<void> signOut();
}