/// GET/POST /api/hammart/products/{id}/reviews — mirrors
/// app/lib/hammartReviews.ts's HammartReview exactly.
class HammartReview {
  final String reviewId;
  final String productId;
  final String userId;
  final String userName;
  final String? userAvatar;
  final int rating;
  final String comment;
  final String createdAt;

  HammartReview({
    required this.reviewId,
    required this.productId,
    required this.userId,
    required this.userName,
    this.userAvatar,
    required this.rating,
    required this.comment,
    required this.createdAt,
  });

  factory HammartReview.fromJson(Map<String, dynamic> json) {
    return HammartReview(
      reviewId: json['reviewId']?.toString() ?? '',
      productId: json['productId']?.toString() ?? '',
      userId: json['userId']?.toString() ?? '',
      userName: json['userName']?.toString() ?? 'Verified Customer',
      userAvatar: json['userAvatar'] as String?,
      rating: (json['rating'] as num?)?.toInt() ?? 0,
      comment: json['comment']?.toString() ?? '',
      createdAt: json['createdAt']?.toString() ?? '',
    );
  }
}

class HammartReviewsResult {
  final List<HammartReview> reviews;
  final double averageRating;
  final int totalReviews;
  final bool tableMissing;

  HammartReviewsResult({
    this.reviews = const [],
    this.averageRating = 0,
    this.totalReviews = 0,
    this.tableMissing = false,
  });

  factory HammartReviewsResult.fromJson(Map<String, dynamic> json) {
    return HammartReviewsResult(
      reviews: ((json['reviews'] as List?) ?? [])
          .whereType<Map>()
          .map((j) => HammartReview.fromJson(Map<String, dynamic>.from(j)))
          .toList(),
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0,
      totalReviews: (json['totalReviews'] as num?)?.toInt() ?? 0,
      tableMissing: json['tableMissing'] == true,
    );
  }
}
