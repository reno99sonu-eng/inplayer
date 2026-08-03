import '../repositories/auth_repository.dart';

class LogoutUser {
  final AuthRepository repository;

  const LogoutUser(this.repository);

  Future<void> call() {
    return repository.signOut();
  }
}