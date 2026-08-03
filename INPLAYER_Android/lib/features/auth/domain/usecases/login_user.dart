import '../entities/auth_user.dart';
import '../repositories/auth_repository.dart';

class LoginUser {
  final AuthRepository repository;

  const LoginUser(this.repository);

  Future<AuthUser> call({
    required String email,
    required String password,
  }) {
    return repository.signIn(
      email: email,
      password: password,
    );
  }
}