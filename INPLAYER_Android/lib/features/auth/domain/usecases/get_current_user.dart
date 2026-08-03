import '../entities/auth_user.dart';
import '../repositories/auth_repository.dart';

class GetCurrentUser {
  final AuthRepository repository;

  const GetCurrentUser(this.repository);

  Future<AuthUser?> call() {
    return repository.getCurrentUser();
  }
}