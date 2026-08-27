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
  static const String? cognitoDomain = 'ap-south-1orihwadfn.auth.ap-south-1.amazoncognito.com';
}
