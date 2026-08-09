class Channel {
  final String creatorId;
  final String username;
  final String name;
  final String? avatarUrl;
  final String? bio;
  final int? subscribers;
  final int? videoCount;
  final bool isSubscribed;
  final bool notifyEnabled;

  Channel({
    required this.creatorId,
    required this.username,
    required this.name,
    this.avatarUrl,
    this.bio,
    this.subscribers,
    this.videoCount,
    this.isSubscribed = false,
    this.notifyEnabled = false,
  });

  factory Channel.fromJson(Map<String, dynamic> json) {
    return Channel(
      creatorId: json['creatorId'] ?? json['uploaderId'] ?? '',
      username: json['username'] ?? json['uploaderUsername'] ?? '',
      name: json['name'] ?? json['uploaderName'] ?? 'Unknown',
      avatarUrl: json['avatarUrl'] ?? json['uploaderAvatarUrl'],
      bio: json['bio'] ?? json['description'],
      subscribers: json['subscribers'],
      videoCount: json['videoCount'],
      isSubscribed: json['isSubscribed'] ?? false,
      notifyEnabled: json['notifyEnabled'] ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'creatorId': creatorId,
      'username': username,
      'name': name,
      'avatarUrl': avatarUrl,
      'bio': bio,
      'subscribers': subscribers,
      'videoCount': videoCount,
      'isSubscribed': isSubscribed,
      'notifyEnabled': notifyEnabled,
    };
  }

  Channel copyWith({
    String? creatorId,
    String? username,
    String? name,
    String? avatarUrl,
    String? bio,
    int? subscribers,
    int? videoCount,
    bool? isSubscribed,
    bool? notifyEnabled,
  }) {
    return Channel(
      creatorId: creatorId ?? this.creatorId,
      username: username ?? this.username,
      name: name ?? this.name,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      bio: bio ?? this.bio,
      subscribers: subscribers ?? this.subscribers,
      videoCount: videoCount ?? this.videoCount,
      isSubscribed: isSubscribed ?? this.isSubscribed,
      notifyEnabled: notifyEnabled ?? this.notifyEnabled,
    );
  }
}