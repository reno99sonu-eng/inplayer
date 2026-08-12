import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

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
    final commaIndex = value.indexOf(',');
    if (commaIndex == -1) return null;
    return base64Decode(value.substring(commaIndex + 1));
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

  if (isDataImageUrl(trimmed)) {
    final bytes = decodeDataImageUrl(trimmed);
    return bytes != null ? MemoryImage(bytes) : null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return NetworkImage(trimmed);
  }

  return null;
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
