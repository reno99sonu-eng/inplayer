import '../repositories/auth_repository.dart';

class CheckAuthStatus {
  final AuthRepository repository;

  const CheckAuthStatus(this.repository);

  Future<bool> call() {
    return repository.isSignedIn();
  }
}