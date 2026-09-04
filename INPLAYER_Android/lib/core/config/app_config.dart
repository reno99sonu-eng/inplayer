class AppConfig {
  AppConfig._();

  static const String appName = 'INPLAYER';

  static const bool isProduction = true;

  // Production API base URL - update this with your actual backend URL
  static const String apiBaseUrl = 'https://inplayer.in';

  static const Duration connectTimeout = Duration(seconds: 30);

  static const Duration receiveTimeout = Duration(seconds: 30);

  // AWS Cognito Configuration
  static const String cognitoUserPoolId = 'ap-south-1_OrIhWadFN';
  static const String cognitoUserPoolClientId = '1ckejhd5mp3oohgsfuqseeda5t';
  static const String cognitoRegion = 'ap-south-1';

  // OAuth domain for Google sign-in / Hosted UI
  static const String cognitoDomain =
      'ap-south-1orihwadfn.auth.ap-south-1.amazoncognito.com';

  /// Where Cognito sends the browser back to after Hosted UI sign-in.
  ///
  /// Three places have to agree on this or Google sign-in fails silently
  /// after the browser closes:
  ///   1. here, passed to CognitoOAuthConfig in AuthService.configureAmplify
  ///   2. the intent-filter in android/app/src/main/AndroidManifest.xml,
  ///      which must declare [oauthScheme]
  ///   3. the Cognito app client's Allowed callback / sign-out URLs, which
  ///      must list these two strings verbatim, trailing slash included
  static const String oauthScheme = 'inplayer';
  // 'auth', not 'callback': this must match the Allowed callback URL that
  // already exists on the Cognito app client character for character.
  static const String oauthRedirectSignIn = '$oauthScheme://auth/';
  static const String oauthRedirectSignOut = '$oauthScheme://signout/';

  // Existing AppSync GraphQL endpoint. Keep this out of source control when
  // building different environments; pass it with
  // --dart-define=APPSYNC_GRAPHQL_ENDPOINT=https://.../graphql.
  static const String appSyncGraphqlEndpoint = String.fromEnvironment(
    'APPSYNC_GRAPHQL_ENDPOINT',
    defaultValue: '',
  );
}
