class AppConfig {
  AppConfig._();

  static const String appName = 'INPLAYER';

  static const bool isProduction = true;

  // This will be updated after we inspect the production backend.
  static const String apiBaseUrl = '';

  static const Duration connectTimeout = Duration(seconds: 30);

  static const Duration receiveTimeout = Duration(seconds: 30);
}