/// One row from GET /api/admin/users (app/api/admin/users/route.ts).
class AdminUser {
  final String userId;
  final String? username;
  final String? name;
  final String? avatarUrl;
  final String? createdAt;
  final bool isSuspended;
  final String? email;

  AdminUser({
    required this.userId,
    this.username,
    this.name,
    this.avatarUrl,
    this.createdAt,
    this.isSuspended = false,
    this.email,
  });

  factory AdminUser.fromJson(Map<String, dynamic> json) {
    return AdminUser(
      userId: json['userId']?.toString() ?? '',
      username: json['username'] as String?,
      name: json['name'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      createdAt: json['createdAt'] as String?,
      isSuspended: json['isSuspended'] == true,
      email: json['email'] as String?,
    );
  }

  AdminUser copyWith({bool? isSuspended}) {
    return AdminUser(
      userId: userId,
      username: username,
      name: name,
      avatarUrl: avatarUrl,
      createdAt: createdAt,
      isSuspended: isSuspended ?? this.isSuspended,
      email: email,
    );
  }
}
