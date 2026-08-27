/// One row from the public "browse creators" list (GET /api/creators —
/// app/api/creators/route.ts). Deliberately thin: only what's actually
/// public for someone with a claimed @handle who hasn't gone private —
/// no email, no bio, no video list (that's the richer Channel model,
/// fetched per-creator via GET /api/users/{username} once someone taps
/// through).
class PublicCreator {
  final String userId;
  final String username;
  final String name;
  final String? avatarUrl;

  const PublicCreator({
    required this.userId,
    required this.username,
    required this.name,
    this.avatarUrl,
  });

  factory PublicCreator.fromJson(Map<String, dynamic> json) {
    return PublicCreator(
      userId: json['userId']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      name: json['name']?.toString() ?? json['username']?.toString() ?? '',
      avatarUrl: json['avatarUrl']?.toString(),
    );
  }
}

class CreatorsPage {
  final List<PublicCreator> creators;
  final String? nextCursor;

  const CreatorsPage({required this.creators, this.nextCursor});
}
