import '../../domain/entities/auth_user.dart';

class AuthUserModel extends AuthUser {
  const AuthUserModel({
    required super.userId,
    required super.email,
    super.name,
    super.username,
    super.profileImage,
    super.isCreator,
  });

  factory AuthUserModel.fromJson(Map<String, dynamic> json) {
    return AuthUserModel(
      userId: json['userId'] as String,
      email: json['email'] as String,
      name: json['name'] as String?,
      username: json['username'] as String?,
      profileImage: json['profileImage'] as String?,
      isCreator: json['isCreator'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'email': email,
      'name': name,
      'username': username,
      'profileImage': profileImage,
      'isCreator': isCreator,
    };
  }
}