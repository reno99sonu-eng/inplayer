import 'dart:convert';
import 'dart:io';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:image/image.dart' as img;

/// The server's hard cap on a `thumbnailDataUrl`, copied from the website's
/// `THUMBNAIL_DATA_URL_MAX_LENGTH` (app/lib/imageCompress.ts). Anything
/// longer is rejected outright by POST /api/upload/create and by
/// PATCH /api/my-videos/[videoId] with "That thumbnail image is too large or
/// invalid", which fails the whole request.
const int kThumbnailDataUrlMaxLength = 200000;

const double _aspectRatio = 16 / 9;
const int _maxWidth = 640;

/// Quality ladder. 82 is the website's value and is what virtually every
/// image will use; the lower rungs exist only so a pathological source
/// (heavy noise, a photo of a screen) still lands under the cap rather than
/// failing outright.
const List<int> _qualityLadder = [82, 70, 60, 50, 40];

/// Turns a picked image file into a `data:image/jpeg;base64,...` URI small
/// enough for the API to accept.
///
/// A direct port of the website's `compressImageToThumbnail()`: centre-crop
/// to 16:9, scale the crop to at most 640px wide, encode as JPEG at quality
/// 0.82. The app previously skipped this entirely and base64-encoded the
/// picked file as-is, which is why uploads with a custom thumbnail were
/// rejected — see the note at the call site in upload_page.dart.
///
/// Returns null if the file can't be read or decoded, or if even the lowest
/// quality still exceeds the cap. Callers decide whether that is fatal: it
/// is for music (the server requires a thumbnail, because audio has no
/// video frame to make one from) and not for video (Mux generates one).
Future<String?> compressImageToThumbnailDataUrl(String path) async {
  try {
    final bytes = await File(path).readAsBytes();
    if (bytes.isEmpty) return null;
    // Decoding and re-encoding a multi-megapixel photo in pure Dart takes
    // long enough to drop frames, and this runs while the publish button is
    // already showing a spinner — so it goes to a background isolate.
    //
    // Isolate.run rather than Flutter's compute() deliberately: compute
    // would drag package:flutter/foundation.dart into an otherwise
    // Flutter-free utility purely for one helper.
    return await Isolate.run(() => _encodeThumbnail(bytes));
  } catch (_) {
    return null;
  }
}

String? _encodeThumbnail(Uint8List bytes) {
  final decoded = img.decodeImage(bytes);
  if (decoded == null) return null;

  // Phone cameras record rotation in EXIF rather than rotating the pixels.
  // Without baking it in first, a portrait photo gets cropped along its
  // unrotated axis and the thumbnail comes out sideways.
  final oriented = img.bakeOrientation(decoded);

  final srcRatio = oriented.width / oriented.height;
  var cropWidth = oriented.width;
  var cropHeight = oriented.height;
  if (srcRatio > _aspectRatio) {
    cropWidth = (oriented.height * _aspectRatio).round();
  } else {
    cropHeight = (oriented.width / _aspectRatio).round();
  }
  if (cropWidth < 1 || cropHeight < 1) return null;

  final cropX = ((oriented.width - cropWidth) / 2).round();
  final cropY = ((oriented.height - cropHeight) / 2).round();
  final cropped = img.copyCrop(
    oriented,
    x: cropX,
    y: cropY,
    width: cropWidth,
    height: cropHeight,
  );

  final outWidth = cropWidth < _maxWidth ? cropWidth : _maxWidth;
  final rawHeight = (outWidth / _aspectRatio).round();
  final resized = img.copyResize(
    cropped,
    width: outWidth,
    height: rawHeight > 1 ? rawHeight : 1,
    interpolation: img.Interpolation.average,
  );

  for (final quality in _qualityLadder) {
    final jpg = img.encodeJpg(resized, quality: quality);
    final dataUrl = 'data:image/jpeg;base64,${base64Encode(jpg)}';
    if (dataUrl.length <= kThumbnailDataUrlMaxLength) return dataUrl;
  }
  return null;
}
