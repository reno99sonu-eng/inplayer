import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../core/utils/image_utils.dart';
import '../../../../core/utils/time_utils.dart';
import '../../../../services/hammart_service.dart';
import '../../../../models/hammart_product.dart';
import '../../../../models/hammart_review.dart';

class ProductDetailPage extends ConsumerStatefulWidget {
  final String productId;
  const ProductDetailPage({super.key, required this.productId});

  @override
  ConsumerState<ProductDetailPage> createState() => _ProductDetailPageState();
}

class _ProductDetailPageState extends ConsumerState<ProductDetailPage> {
  bool _loading = true;
  HammartProduct? _product;
  HammartReviewsResult _reviews = HammartReviewsResult();
  bool _wishlisted = false;
  int _quantity = 1;
  bool _addingToCart = false;
  final PageController _imageController = PageController();
  int _imageIndex = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _imageController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final service = ref.read(hammartServiceProvider);
    final results = await Future.wait([
      service.getProduct(widget.productId),
      service.getReviews(widget.productId),
      service.isWishlisted(widget.productId),
    ]);
    if (!mounted) return;
    setState(() {
      _product = results[0] as HammartProduct?;
      _reviews = results[1] as HammartReviewsResult;
      _wishlisted = results[2] as bool;
      _loading = false;
    });
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: AppColors.surfaceDark),
    );
  }

  Future<void> _toggleWishlist() async {
    final wasWishlisted = _wishlisted;
    setState(() => _wishlisted = !wasWishlisted);
    final service = ref.read(hammartServiceProvider);
    final ok = wasWishlisted
        ? await service.removeFromWishlist(widget.productId)
        : (await service.addToWishlist(widget.productId)).success;
    if (!mounted) return;
    if (!ok) {
      setState(() => _wishlisted = wasWishlisted);
      _showSnack("Couldn't do that. Try again.");
    }
  }

  Future<void> _addToCart() async {
    setState(() => _addingToCart = true);
    final result = await ref.read(hammartServiceProvider).addToCart(widget.productId, quantity: _quantity);
    if (!mounted) return;
    setState(() => _addingToCart = false);
    _showSnack(result.success ? 'Added to cart.' : (result.error ?? "Couldn't add that to your cart."));
  }

  Future<void> _writeReview() async {
    int rating = 5;
    final commentController = TextEditingController();
    final submitted = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: AppColors.cardDark,
          title: const Text('Write a review', style: TextStyle(color: AppColors.textPrimaryDark)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: List.generate(5, (i) {
                  final filled = i < rating;
                  return IconButton(
                    icon: Icon(filled ? Icons.star : Icons.star_border, color: AppColors.brandGold),
                    onPressed: () => setDialogState(() => rating = i + 1),
                  );
                }),
              ),
              TextField(
                controller: commentController,
                maxLines: 3,
                style: const TextStyle(color: AppColors.textPrimaryDark),
                decoration: const InputDecoration(hintText: 'Share your experience...', hintStyle: TextStyle(color: AppColors.textSecondaryDark)),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
            TextButton(
              onPressed: () => Navigator.of(context).pop(true),
              style: TextButton.styleFrom(foregroundColor: AppColors.brandOrange),
              child: const Text('Post'),
            ),
          ],
        ),
      ),
    );
    if (submitted != true || commentController.text.trim().isEmpty) return;

    final result = await ref.read(hammartServiceProvider).postReview(widget.productId, rating: rating, comment: commentController.text.trim());
    if (!mounted) return;
    if (result.success) {
      _showSnack('Review posted.');
      _load();
    } else {
      _showSnack(result.error ?? "Couldn't post that review.");
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        backgroundColor: AppColors.backgroundDark,
        body: Center(child: CircularProgressIndicator(color: AppColors.brandOrange)),
      );
    }
    final product = _product;
    if (product == null) {
      return Scaffold(
        backgroundColor: AppColors.backgroundDark,
        appBar: AppBar(backgroundColor: AppColors.backgroundDark, elevation: 0),
        body: const Center(child: Text("Listing not found", style: TextStyle(color: AppColors.textSecondaryDark))),
      );
    }
    final images = product.gallery;

    return Scaffold(
      backgroundColor: AppColors.backgroundDark,
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            backgroundColor: AppColors.backgroundDark,
            pinned: true,
            expandedHeight: 340,
            flexibleSpace: FlexibleSpaceBar(
              background: images.isEmpty
                  ? Container(color: AppColors.surfaceDark, child: const Icon(Icons.shopping_bag_outlined, size: 48, color: AppColors.textSecondaryDark))
                  : Stack(
                      children: [
                        PageView.builder(
                          controller: _imageController,
                          itemCount: images.length,
                          onPageChanged: (i) => setState(() => _imageIndex = i),
                          itemBuilder: (context, index) {
                            final img = smartImageProvider(images[index]);
                            return img != null
                                ? Image(image: img, fit: BoxFit.cover, width: double.infinity)
                                : Container(color: AppColors.surfaceDark);
                          },
                        ),
                        if (images.length > 1)
                          Positioned(
                            bottom: 12,
                            left: 0,
                            right: 0,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: List.generate(
                                images.length,
                                (i) => Container(
                                  margin: const EdgeInsets.symmetric(horizontal: 3),
                                  width: 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: i == _imageIndex ? AppColors.brandOrange : Colors.white.withOpacity(0.4),
                                  ),
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
            ),
            actions: [
              IconButton(
                icon: Icon(_wishlisted ? Icons.favorite : Icons.favorite_border, color: _wishlisted ? AppColors.error : Colors.white),
                onPressed: _toggleWishlist,
              ),
            ],
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(product.title, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Text('₹${product.priceInr}', style: const TextStyle(color: AppColors.brandOrange, fontSize: 22, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Text('by @${product.vendorId}', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 13)),
                      const SizedBox(width: 10),
                      if (_reviews.totalReviews > 0) ...[
                        const Icon(Icons.star, color: AppColors.brandGold, size: 14),
                        const SizedBox(width: 2),
                        Text('${_reviews.averageRating} (${_reviews.totalReviews})', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 13)),
                      ] else
                        const Text('No ratings yet', style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 13)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (product.description.isNotEmpty) ...[
                    const Text('Description', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Text(product.description, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 13)),
                    const SizedBox(height: 16),
                  ],
                  if (product.details.isNotEmpty) ...[
                    const Text('Details', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Text(product.details, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 13)),
                    const SizedBox(height: 16),
                  ],
                  Wrap(
                    spacing: 16,
                    runSpacing: 4,
                    children: [
                      Text('Category: ${product.category}', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
                      Text('Origin: ${product.countryOfOrigin}', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
                      if (product.hsCode.isNotEmpty) Text('HS Code: ${product.hsCode}', style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Reviews', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
                      TextButton(onPressed: _writeReview, child: const Text('Write a review')),
                    ],
                  ),
                  if (_reviews.tableMissing)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text('Reviews aren\'t set up yet.', style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
                    )
                  else if (_reviews.reviews.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text('No reviews yet — be the first!', style: TextStyle(color: AppColors.textSecondaryDark, fontSize: 12)),
                    )
                  else
                    ..._reviews.reviews.map((r) => Padding(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(r.userName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13)),
                                  const SizedBox(width: 8),
                                  ...List.generate(5, (i) => Icon(i < r.rating ? Icons.star : Icons.star_border, color: AppColors.brandGold, size: 12)),
                                ],
                              ),
                              const SizedBox(height: 4),
                              Text(r.comment, style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 13)),
                              const SizedBox(height: 2),
                              Text(formatTimeAgo(r.createdAt), style: const TextStyle(color: AppColors.textSecondaryDark, fontSize: 11)),
                            ],
                          ),
                        )),
                  const SizedBox(height: 100),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                decoration: BoxDecoration(color: AppColors.cardDark, borderRadius: BorderRadius.circular(12)),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.remove, color: Colors.white, size: 18),
                      onPressed: _quantity > 1 ? () => setState(() => _quantity--) : null,
                    ),
                    Text('$_quantity', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                    IconButton(
                      icon: const Icon(Icons.add, color: Colors.white, size: 18),
                      onPressed: _quantity < 20 ? () => setState(() => _quantity++) : null,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _addingToCart ? null : _addToCart,
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.brandOrange, minimumSize: const Size.fromHeight(48)),
                  child: _addingToCart
                      ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Add to Cart', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
