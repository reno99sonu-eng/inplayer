import 'dart:convert';
import 'dart:typed_data';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// In-memory cache for decoded base64 data URIs so that rebuilding widgets
/// (such as list tiles, now playing progress, or heroes) does not re-decode
/// 100KB+ strings on every frame.
final Map<String, Uint8List> _dataImageCache = {};

/// Returns true if [value] is an inline base64 `data:image/...` URI rather
/// than a normal http(s) URL. The InPlayer backend returns thumbnails this
/// way for some custom-uploaded thumbnails/avatars — plain [NetworkImage]
/// or [CachedNetworkImageProvider] can't handle that and throw
/// "Invalid argument(s): No host specified in URI".
bool isDataImageUrl(String value) {
  return value.trim().toLowerCase().startsWith('data:image/');
}

Uint8List? decodeDataImageUrl(String value) {
  try {
    final trimmed = value.trim();
    final commaIndex = trimmed.indexOf(',');
    if (commaIndex == -1) return null;

    final prefixLen = trimmed.length - commaIndex - 1;
    final snippetLen = prefixLen > 32 ? 32 : prefixLen;
    final cacheKey = '${trimmed.length}_${trimmed.substring(commaIndex + 1, commaIndex + 1 + snippetLen)}';
    final cached = _dataImageCache[cacheKey];
    if (cached != null) return cached;

    final b64 = trimmed.substring(commaIndex + 1).replaceAll(RegExp(r'\s+'), '');
    final bytes = base64Decode(b64);
    if (_dataImageCache.length > 50) {
      _dataImageCache.clear();
    }
    _dataImageCache[cacheKey] = bytes;
    return bytes;
  } catch (_) {
    return null;
  }
}

/// An [ImageProvider] that transparently handles both normal http(s) image
/// URLs and inline `data:image/...;base64,...` URIs, returning null for
/// anything unusable so callers can fall back to a placeholder instead of
/// crashing the image stream. Use this anywhere a thumbnail/avatar URL from
/// the API is rendered — see VideoCard's `_buildThumbnail`/`_buildAvatar`
/// for the pattern this generalizes.
ImageProvider? smartImageProvider(String url) {
  final trimmed = url.trim();
  if (trimmed.isEmpty) return null;

  if (trimmed.startsWith('mux:')) {
    final playbackId = trimmed.substring(4).trim();
    if (playbackId.isNotEmpty) {
      return CachedNetworkImageProvider('https://image.mux.com/$playbackId/thumbnail.jpg');
    }
  }

  if (isDataImageUrl(trimmed)) {
    final bytes = decodeDataImageUrl(trimmed);
    return bytes != null ? MemoryImage(bytes) : null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return CachedNetworkImageProvider(trimmed);
  }

  return null;
}

/// A safe, universal image widget for InPlayer that transparently handles:
/// 1. `data:image/...;base64,...` URIs (used by custom music artwork & avatar uploads)
/// 2. `mux:` playback IDs (converted to https://image.mux.com/...)
/// 3. Standard `http://` and `https://` URLs cached via [CachedNetworkImage]
/// 4. Graceful fallback when empty, decoding fails, or network errors occur.
class SafeAppImage extends StatelessWidget {
  final String imageUrl;
  final BoxFit fit;
  final double? width;
  final double? height;
  final Alignment alignment;
  final Widget Function(BuildContext, String, dynamic)? errorWidget;
  final Widget Function(BuildContext, String)? placeholder;

  const SafeAppImage({
    super.key,
    required this.imageUrl,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.alignment = Alignment.center,
    this.errorWidget,
    this.placeholder,
  });

  @override
  Widget build(BuildContext context) {
    final trimmed = imageUrl.trim();
    if (trimmed.isEmpty) {
      return errorWidget?.call(context, imageUrl, 'Empty URL') ??
          placeholder?.call(context, imageUrl) ??
          const SizedBox.shrink();
    }

    if (isDataImageUrl(trimmed)) {
      final bytes = decodeDataImageUrl(trimmed);
      if (bytes != null && bytes.isNotEmpty) {
        return Image.memory(
          bytes,
          width: width,
          height: height,
          fit: fit,
          alignment: alignment,
          errorBuilder: (ctx, err, stack) =>
              errorWidget?.call(ctx, imageUrl, err) ?? const SizedBox.shrink(),
        );
      }
      return errorWidget?.call(context, imageUrl, 'Invalid base64') ??
          const SizedBox.shrink();
    }

    String finalUrl = trimmed;
    if (trimmed.startsWith('mux:')) {
      final playbackId = trimmed.substring(4).trim();
      finalUrl = 'https://image.mux.com/$playbackId/thumbnail.jpg';
    }

    return CachedNetworkImage(
      imageUrl: finalUrl,
      width: width,
      height: height,
      fit: fit,
      alignment: alignment,
      placeholder: placeholder,
      errorWidget: errorWidget != null
          ? (ctx, url, err) => errorWidget!(ctx, url, err)
          : null,
    );
  }
}

/// Picks an image from the gallery and returns it as a `data:image/...`
/// URI, downscaled/compressed client-side via [ImagePicker]'s own
/// maxWidth/maxHeight/imageQuality (no separate image-processing package
/// needed). Used by every admin screen that uploads a creative image
/// straight into a DynamoDB row (ad creatives, navbar theme) — those rows
/// have a hard per-item size budget on the backend (e.g. 150,000 /
/// 350,000 base64 chars), so [maxChars] is checked here too and returns
/// null with nothing silently truncated if the encoded result is still
/// too large after compression.
///
/// Returns null if the user cancelled the picker, or if the resulting
/// data URI would still exceed [maxChars].
Future<String?> pickImageAsDataUrl({
  int maxDimension = 1200,
  int quality = 75,
  int maxChars = 150000,
}) async {
  final picker = ImagePicker();
  final file = await picker.pickImage(
    source: ImageSource.gallery,
    maxWidth: maxDimension.toDouble(),
    maxHeight: maxDimension.toDouble(),
    imageQuality: quality,
  );
  if (file == null) return null;

  final bytes = await file.readAsBytes();
  final ext = file.path.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
  final dataUrl = 'data:image/$ext;base64,${base64Encode(bytes)}';
  if (dataUrl.length > maxChars) return null;
  return dataUrl;
}
