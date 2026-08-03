import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource remoteDataSource;

  const AuthRepositoryImpl({
    required this.remoteDataSource,
  });

  @override
  Future<AuthUser?> getCurrentUser() {
    return remoteDataSource.getCurrentUser();
  }

  @override
  Future<bool> isSignedIn() {
    return remoteDataSource.isSignedIn();
  }

  @override
  Future<AuthUser> signIn({
    required String email,
    required String password,
  }) {
    return remoteDataSource.signIn(
      email: email,
      password: password,
    );
  }

  @override
  Future<void> signOut() {
    return remoteDataSource.signOut();
  }
}