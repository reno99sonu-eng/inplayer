import 'dart:convert';

import 'package:amplify_flutter/amplify_flutter.dart';
import 'package:amplify_auth_cognito/amplify_auth_cognito.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';

import '../core/config/app_config.dart';
import '../models/user.dart' show User;

final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

class AuthService {
  final Logger _logger = Logger();

  bool _isConfigured = false;

  Future<void> configureAmplify() async {
    if (_isConfigured) return;

    try {
      await Amplify.addPlugin(AmplifyAuthCognito());

      final config = AmplifyConfig(
        auth: AuthConfig.cognito(
          userPoolConfig: CognitoUserPoolConfig(
            poolId: AppConfig.cognitoUserPoolId,
            appClientId: AppConfig.cognitoUserPoolClientId,
            region: AppConfig.cognitoRegion,
          ),
        ),
      );

      await Amplify.configure(jsonEncode(config.toJson()));

      _isConfigured = true;
      _logger.i('Amplify configured successfully');
    } on AmplifyAlreadyConfiguredException {
      _isConfigured = true;
      _logger.i('Amplify was already configured');
    } catch (e, stackTrace) {
      _logger.e(
        'Error configuring Amplify',
        error: e,
        stackTrace: stackTrace,
      );
      rethrow;
    }
  }

  Future<bool> isSignedIn() async {
    try {
      final result = await Amplify.Auth.fetchAuthSession();
      return result.isSignedIn;
    } catch (e) {
      _logger.e('Error checking auth status: $e');
      return false;
    }
  }

  Future<User?> getCurrentUser() async {
    try {
      final result = await Amplify.Auth.fetchUserAttributes();

      final Map<String, String> attributes = {};

      for (final attribute in result) {
        attributes[attribute.userAttributeKey.key] = attribute.value;
      }

      final userId = attributes['sub'] ?? '';
      final username = attributes['email'] ?? '';
      final email = attributes['email'] ?? '';
      final name =
          attributes['name'] ??
          attributes['given_name'] ??
          '';

      return User(
        userId: userId,
        username: username,
        name: name,
        email: email,
      );
    } catch (e) {
      _logger.e('Error fetching current user: $e');
      return null;
    }
  }

  Future<SignInResult> signIn({
    required String email,
    required String password,
  }) async {
    try {
      final result = await Amplify.Auth.signIn(
        username: email,
        password: password,
      );

      if (result.isSignedIn) {
        final user = await getCurrentUser();

        return SignInResult(
          success: true,
          user: user,
        );
      }

      return SignInResult(
        success: false,
        error: 'Sign in failed',
      );
    } on AuthException catch (e) {
      _logger.e('Sign in error: ${e.message}');

      return SignInResult(
        success: false,
        error: e.message,
      );
    } catch (e) {
      _logger.e('Unexpected sign in error: $e');

      return SignInResult(
        success: false,
        error: 'An unexpected error occurred',
      );
    }
  }

  Future<SignUpResult> signUp({
    required String email,
    required String password,
    required String name,
  }) async {
    try {
      final result = await Amplify.Auth.signUp(
        username: email,
        password: password,
        options: SignUpOptions(
          userAttributes: {
            AuthUserAttributeKey.email: email,
            AuthUserAttributeKey.name: name,
          },
        ),
      );

      return SignUpResult(
        success: true,
        isSignUpComplete: result.isSignUpComplete,
      );
    } on AuthException catch (e) {
      _logger.e('Sign up error: ${e.message}');

      return SignUpResult(
        success: false,
        isSignUpComplete: false,
        error: e.message,
      );
    } catch (e) {
      _logger.e('Unexpected sign up error: $e');

      return SignUpResult(
        success: false,
        isSignUpComplete: false,
        error: 'An unexpected error occurred',
      );
    }
  }

  Future<ConfirmSignUpResult> confirmSignUp({
    required String email,
    required String code,
  }) async {
    try {
      final result = await Amplify.Auth.confirmSignUp(
        username: email,
        confirmationCode: code,
      );

      return ConfirmSignUpResult(
        success: true,
        isSignUpComplete: result.isSignUpComplete,
      );
    } on AuthException catch (e) {
      _logger.e('Confirm sign up error: ${e.message}');

      return ConfirmSignUpResult(
        success: false,
        isSignUpComplete: false,
        error: e.message,
      );
    } catch (e) {
      _logger.e('Unexpected confirm sign up error: $e');

      return ConfirmSignUpResult(
        success: false,
        isSignUpComplete: false,
        error: 'An unexpected error occurred',
      );
    }
  }

  Future<void> signOut() async {
    try {
      await Amplify.Auth.signOut();
      _logger.i('User signed out successfully');
    } catch (e) {
      _logger.e('Sign out error: $e');
      rethrow;
    }
  }

  /// Change password while signed in (Settings -> Change Password) — not
  /// the same as [resetPassword], which is the signed-out "forgot
  /// password" flow.
  Future<AccountActionResult> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    try {
      await Amplify.Auth.updatePassword(
        oldPassword: oldPassword,
        newPassword: newPassword,
      );
      return AccountActionResult(success: true);
    } on AuthException catch (e) {
      _logger.e('Change password error: ${e.message}');
      return AccountActionResult(success: false, error: e.message);
    } catch (e) {
      _logger.e('Unexpected change password error: $e');
      return AccountActionResult(success: false, error: 'An unexpected error occurred');
    }
  }

  /// Step 1 of changing the account email — requests the change and
  /// returns whether Cognito needs a verification code before it takes
  /// effect (it always does for email, per Cognito's default settings).
  Future<AccountActionResult> requestEmailChange(String newEmail) async {
    try {
      final result = await Amplify.Auth.updateUserAttribute(
        userAttributeKey: AuthUserAttributeKey.email,
        value: newEmail,
      );
      final needsConfirmation = result.nextStep.updateAttributeStep ==
          AuthUpdateAttributeStep.confirmAttributeWithCode;
      return AccountActionResult(success: true, needsConfirmation: needsConfirmation);
    } on AuthException catch (e) {
      _logger.e('Request email change error: ${e.message}');
      return AccountActionResult(success: false, error: e.message);
    } catch (e) {
      _logger.e('Unexpected request email change error: $e');
      return AccountActionResult(success: false, error: 'An unexpected error occurred');
    }
  }

  /// Step 2 — confirms the new email with the code Cognito sent to it.
  Future<AccountActionResult> confirmEmailChange(String code) async {
    try {
      await Amplify.Auth.confirmUserAttribute(
        userAttributeKey: AuthUserAttributeKey.email,
        confirmationCode: code,
      );
      return AccountActionResult(success: true);
    } on AuthException catch (e) {
      _logger.e('Confirm email change error: ${e.message}');
      return AccountActionResult(success: false, error: e.message);
    } catch (e) {
      _logger.e('Unexpected confirm email change error: $e');
      return AccountActionResult(success: false, error: 'An unexpected error occurred');
    }
  }

  /// Deletes the actual Cognito login. Must be called AFTER the backend's
  /// own DELETE /api/account/delete has finished cleaning up server-side
  /// data (see settings_service.dart) — once the Cognito account is gone,
  /// this session can no longer authenticate that cleanup call. Ends the
  /// session as a side effect, same as the website's own delete-account
  /// flow (aws-amplify/auth's deleteUser()).
  Future<AccountActionResult> deleteUser() async {
    try {
      await Amplify.Auth.deleteUser();
      return AccountActionResult(success: true);
    } on AuthException catch (e) {
      _logger.e('Delete user error: ${e.message}');
      return AccountActionResult(success: false, error: e.message);
    } catch (e) {
      _logger.e('Unexpected delete user error: $e');
      return AccountActionResult(success: false, error: 'An unexpected error occurred');
    }
  }

  Future<void> resetPassword({
    required String email,
  }) async {
    try {
      await Amplify.Auth.resetPassword(
        username: email,
      );

      _logger.i(
        'Password reset initiated for $email',
      );
    } on AuthException catch (e) {
      _logger.e(
        'Reset password error: ${e.message}',
      );
      rethrow;
    } catch (e) {
      _logger.e(
        'Unexpected reset password error: $e',
      );
      rethrow;
    }
  }

  Future<void> confirmResetPassword({
    required String email,
    required String code,
    required String newPassword,
  }) async {
    try {
      await Amplify.Auth.confirmResetPassword(
        username: email,
        confirmationCode: code,
        newPassword: newPassword,
      );

      _logger.i(
        'Password reset confirmed for $email',
      );
    } on AuthException catch (e) {
      _logger.e(
        'Confirm reset password error: ${e.message}',
      );
      rethrow;
    } catch (e) {
      _logger.e(
        'Unexpected confirm reset password error: $e',
      );
      rethrow;
    }
  }
}

class SignInResult {
  final bool success;
  final User? user;
  final String? error;

  SignInResult({
    required this.success,
    this.user,
    this.error,
  });
}

class SignUpResult {
  final bool success;
  final bool isSignUpComplete;
  final String? error;

  SignUpResult({
    required this.success,
    required this.isSignUpComplete,
    this.error,
  });
}

class ConfirmSignUpResult {
  final bool success;
  final bool isSignUpComplete;
  final String? error;

  ConfirmSignUpResult({
    required this.success,
    required this.isSignUpComplete,
    this.error,
  });
}

class AccountActionResult {
  final bool success;
  final bool needsConfirmation;
  final String? error;

  AccountActionResult({
    required this.success,
    this.needsConfirmation = false,
    this.error,
  });
}