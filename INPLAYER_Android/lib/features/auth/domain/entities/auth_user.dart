import 'package:equatable/equatable.dart';

class AuthUser extends Equatable {
  final String userId;
  final String email;
  final String? name;
  final String? username;
  final String? profileImage;
  final bool isCreator;

  const AuthUser({
    required this.userId,
    required this.email,
    this.name,
    this.username,
    this.profileImage,
    this.isCreator = false,
  });

  @override
  List<Object?> get props => [
        userId,
        email,
        name,
        username,
        profileImage,
        isCreator,
      ];
}