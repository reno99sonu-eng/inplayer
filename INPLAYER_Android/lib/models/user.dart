class User {
  final String userId;
  final String username;
  final String name;
  final String email;
  final String? avatarUrl;
  final String? coverPhotoUrl;
  final String? handle;
  final String usernamePrivacy;
  final String bio;
  final Map<String, String> socialLinks;
  final List<Map<String, String>> otherLinks;
  final int? age;
  final bool termsAccepted;

  User({
    required this.userId,
    required this.username,
    required this.name,
    required this.email,
    this.avatarUrl,
    this.coverPhotoUrl,
    this.handle,
    this.usernamePrivacy = 'public',
    this.bio = '',
    Map<String, String>? socialLinks,
    List<Map<String, String>>? otherLinks,
    this.age,
    this.termsAccepted = false,
  })  : socialLinks = socialLinks ?? {},
        otherLinks = otherLinks ?? [];

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      userId: json['userId'] ?? '',
      username: json['username'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      avatarUrl: json['avatarUrl'],
      coverPhotoUrl: json['coverPhotoUrl'],
      handle: json['handle'],
      usernamePrivacy: json['usernamePrivacy'] ?? 'public',
      bio: json['bio'] ?? json['description'] ?? '',
      socialLinks: Map<String, String>.from(json['socialLinks'] ?? {}),
      otherLinks: List<Map<String, String>>.from(
        json['otherLinks']?.map((e) => Map<String, String>.from(e)) ?? [],
      ),
      age: json['age'],
      termsAccepted: json['termsAccepted'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'username': username,
      'name': name,
      'email': email,
      'avatarUrl': avatarUrl,
      'coverPhotoUrl': coverPhotoUrl,
      'handle': handle,
      'usernamePrivacy': usernamePrivacy,
      'bio': bio,
      'socialLinks': socialLinks,
      'otherLinks': otherLinks,
      'age': age,
      'termsAccepted': termsAccepted,
    };
  }

  User copyWith({
    String? userId,
    String? username,
    String? name,
    String? email,
    String? avatarUrl,
    String? coverPhotoUrl,
    String? handle,
    String? usernamePrivacy,
    String? bio,
    Map<String, String>? socialLinks,
    List<Map<String, String>>? otherLinks,
    int? age,
    bool? termsAccepted,
  }) {
    return User(
      userId: userId ?? this.userId,
      username: username ?? this.username,
      name: name ?? this.name,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      coverPhotoUrl: coverPhotoUrl ?? this.coverPhotoUrl,
      handle: handle ?? this.handle,
      usernamePrivacy: usernamePrivacy ?? this.usernamePrivacy,
      bio: bio ?? this.bio,
      socialLinks: socialLinks ?? this.socialLinks,
      otherLinks: otherLinks ?? this.otherLinks,
      age: age ?? this.age,
      termsAccepted: termsAccepted ?? this.termsAccepted,
    );
  }
}