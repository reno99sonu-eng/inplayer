import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logger/logger.dart';
import '../core/network/dio_client.dart';
import '../core/constants/api_constants.dart';
import '../models/hammart_product.dart';
import '../models/hammart_review.dart';
import '../models/hammart_cart_item.dart';

final hammartServiceProvider = Provider<HammartService>((ref) {
  return HammartService();
});

/// Hammart (InPlayer's marketplace) — browsing, cart, wishlist, and
/// reviews. Mirrors app/api/hammart/{products,cart,wishlist}/**. Checkout
/// (POST /api/hammart/checkout, real Razorpay payment flow) is
/// deliberately not wired up yet — it's a bigger, separate piece grouped
/// with the rest of the app's payments work rather than this pass.
class HammartService {
  final _dio = DioClient().dio;
  final _logger = Logger();

  Future<HammartCheckoutResult> checkout({
    required List<HammartCartItem> items,
    required String buyerPhone,
    required String deliveryAddress,
    String city = '',
    String state = '',
    String pincode = '',
  }) async {
    try {
      final response = await _dio.post(
        '/api/hammart/checkout',
        data: {
          'items': items.map((item) => {
            'productId': item.productId,
            'quantity': item.quantity,
          }).toList(),
          'buyerPhone': buyerPhone,
          'deliveryAddress': deliveryAddress,
          'city': city,
          'state': state,
          'pincode': pincode,
        },
      );
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final groups = (data['groups'] as List? ?? [])
            .whereType<Map>()
            .map((group) => HammartCheckoutGroup.fromJson(Map<String, dynamic>.from(group)))
            .toList();
        return HammartCheckoutResult(
          groups: groups,
          failedItems: (data['failedItems'] as List? ?? [])
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList(),
        );
      }
      final error = response.data is Map ? response.data['error']?.toString() : null;
      return HammartCheckoutResult(error: error ?? "Couldn't start checkout.");
    } catch (e) {
      _logger.e('Error starting Hammart checkout: $e');
      return HammartCheckoutResult(error: "Couldn't start checkout. Try again.");
    }
  }

  Future<HammartProductsResult> getProducts({String? category, String? vendorId}) async {
    try {
      final response = await _dio.get(
        ApiConstants.hammartProducts,
        queryParameters: {
          if (category != null && category.isNotEmpty) 'category': category,
          if (vendorId != null && vendorId.isNotEmpty) 'vendorId': vendorId,
        },
      );
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final products = (data['products'] as List? ?? [])
            .whereType<Map>()
            .map((j) => HammartProduct.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return HammartProductsResult(products: products, tableMissing: data['tableMissing'] == true);
      }
      return HammartProductsResult(products: []);
    } catch (e) {
      _logger.e('Error fetching Hammart products: $e');
      return HammartProductsResult(products: []);
    }
  }

  Future<HammartProduct?> getProduct(String productId) async {
    try {
      final response = await _dio.get('${ApiConstants.hammartProducts}/$productId');
      if (response.statusCode == 200 && response.data is Map) {
        final product = (response.data as Map)['product'];
        if (product is Map) return HammartProduct.fromJson(Map<String, dynamic>.from(product));
      }
      return null;
    } catch (e) {
      _logger.e('Error fetching Hammart product: $e');
      return null;
    }
  }

  Future<HammartReviewsResult> getReviews(String productId) async {
    try {
      final response = await _dio.get('${ApiConstants.hammartProducts}/$productId/reviews');
      if (response.statusCode == 200 && response.data is Map) {
        return HammartReviewsResult.fromJson(Map<String, dynamic>.from(response.data as Map));
      }
      return HammartReviewsResult(tableMissing: true);
    } catch (e) {
      _logger.e('Error fetching Hammart reviews: $e');
      return HammartReviewsResult(tableMissing: true);
    }
  }

  Future<HammartActionResult> postReview(String productId, {required int rating, required String comment}) async {
    try {
      final response = await _dio.post(
        '${ApiConstants.hammartProducts}/$productId/reviews',
        data: {'rating': rating, 'comment': comment},
      );
      if (response.statusCode == 200) return HammartActionResult(success: true);
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return HammartActionResult(success: false, error: error ?? "Couldn't post that review.");
    } catch (e) {
      _logger.e('Error posting Hammart review: $e');
      return HammartActionResult(success: false, error: "Couldn't post that review. Try again.");
    }
  }

  // ── Cart ────────────────────────────────────────────────────────────

  Future<HammartCartResult> getCart() async {
    try {
      final response = await _dio.get(ApiConstants.hammartCart);
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final items = (data['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => HammartCartItem.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return HammartCartResult(items: items, tableMissing: data['tableMissing'] == true);
      }
      return HammartCartResult(items: []);
    } catch (e) {
      _logger.e('Error fetching Hammart cart: $e');
      return HammartCartResult(items: []);
    }
  }

  Future<HammartActionResult> addToCart(String productId, {int quantity = 1}) async {
    try {
      final response = await _dio.post(ApiConstants.hammartCart, data: {'productId': productId, 'quantity': quantity});
      if (response.statusCode == 200) return HammartActionResult(success: true);
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return HammartActionResult(success: false, error: error ?? "Couldn't add that to your cart.");
    } catch (e) {
      _logger.e('Error adding to Hammart cart: $e');
      return HammartActionResult(success: false, error: "Couldn't add that to your cart. Try again.");
    }
  }

  Future<bool> setCartQuantity(String productId, int quantity) async {
    try {
      final response = await _dio.patch('${ApiConstants.hammartCart}/$productId', data: {'quantity': quantity});
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error updating Hammart cart quantity: $e');
      return false;
    }
  }

  Future<bool> removeFromCart(String productId) async {
    try {
      final response = await _dio.delete('${ApiConstants.hammartCart}/$productId');
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error removing from Hammart cart: $e');
      return false;
    }
  }

  // ── Wishlist ────────────────────────────────────────────────────────

  Future<HammartWishlistResult> getWishlist() async {
    try {
      final response = await _dio.get(ApiConstants.hammartWishlist);
      if (response.statusCode == 200 && response.data is Map) {
        final data = response.data as Map;
        final items = (data['items'] as List? ?? [])
            .whereType<Map>()
            .map((j) => HammartWishlistItem.fromJson(Map<String, dynamic>.from(j)))
            .toList();
        return HammartWishlistResult(items: items, tableMissing: data['tableMissing'] == true);
      }
      return HammartWishlistResult(items: []);
    } catch (e) {
      _logger.e('Error fetching Hammart wishlist: $e');
      return HammartWishlistResult(items: []);
    }
  }

  Future<bool> isWishlisted(String productId) async {
    try {
      final response = await _dio.get(ApiConstants.hammartWishlist, queryParameters: {'productId': productId});
      return response.statusCode == 200 && response.data is Map && (response.data as Map)['wishlisted'] == true;
    } catch (e) {
      _logger.e('Error checking Hammart wishlist status: $e');
      return false;
    }
  }

  Future<HammartActionResult> addToWishlist(String productId) async {
    try {
      final response = await _dio.post(ApiConstants.hammartWishlist, data: {'productId': productId});
      if (response.statusCode == 200) return HammartActionResult(success: true);
      final error = (response.data is Map ? response.data['error'] : null) as String?;
      return HammartActionResult(success: false, error: error ?? "Couldn't save that.");
    } catch (e) {
      _logger.e('Error adding to Hammart wishlist: $e');
      return HammartActionResult(success: false, error: "Couldn't save that. Try again.");
    }
  }

  Future<bool> removeFromWishlist(String productId) async {
    try {
      final response = await _dio.delete('${ApiConstants.hammartWishlist}/$productId');
      return response.statusCode == 200;
    } catch (e) {
      _logger.e('Error removing from Hammart wishlist: $e');
      return false;
    }
  }
}

class HammartProductsResult {
  final List<HammartProduct> products;
  final bool tableMissing;
  HammartProductsResult({required this.products, this.tableMissing = false});
}

class HammartCartResult {
  final List<HammartCartItem> items;
  final bool tableMissing;
  HammartCartResult({required this.items, this.tableMissing = false});
}

class HammartWishlistResult {
  final List<HammartWishlistItem> items;
  final bool tableMissing;
  HammartWishlistResult({required this.items, this.tableMissing = false});
}

class HammartActionResult {
  final bool success;
  final String? error;
  HammartActionResult({required this.success, this.error});
}

class HammartCheckoutGroup {
  final bool success;
  final String? paymentMethod;
  final String? razorpayOrderId;
  final String? razorpayKeyId;
  final String? upiLink;
  final int amountInr;

  const HammartCheckoutGroup({
    required this.success,
    this.paymentMethod,
    this.razorpayOrderId,
    this.razorpayKeyId,
    this.upiLink,
    this.amountInr = 0,
  });

  factory HammartCheckoutGroup.fromJson(Map<String, dynamic> json) {
    return HammartCheckoutGroup(
      success: json['success'] == true,
      paymentMethod: json['paymentMethod']?.toString(),
      razorpayOrderId: json['razorpayOrderId']?.toString(),
      razorpayKeyId: json['razorpayKeyId']?.toString(),
      upiLink: json['upiLink']?.toString(),
      amountInr: (json['amountInr'] as num?)?.toInt() ?? 0,
    );
  }
}

class HammartCheckoutResult {
  final List<HammartCheckoutGroup> groups;
  final List<Map<String, dynamic>> failedItems;
  final String? error;

  const HammartCheckoutResult({
    this.groups = const [],
    this.failedItems = const [],
    this.error,
  });

  bool get success => error == null && groups.any((group) => group.success);
}
