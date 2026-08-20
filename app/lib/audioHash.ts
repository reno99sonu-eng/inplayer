// A SHA-256 of the uploaded audio, computed in the BROWSER before the file
// is sent anywhere.
//
// This is the cheapest half of copyright enforcement and the only half that
// is ever certain: two files with the same hash are the same recording,
// byte for byte, full stop. The server stores it on the track and scans for
// an existing match, which catches a re-upload of anything already on
// InPlayer — someone else's track lifted from another creator's page, or a
// creator quietly publishing the same song twice under different titles.
//
// What it CANNOT catch, and nothing about it should be oversold: a
// re-encode, a trim of half a second, a different bitrate, or a recording
// of a recording. One changed byte changes the hash completely. For real
// coverage against commercial catalogues you need audio fingerprinting —
// see the ExternalFingerprintProvider seam in app/lib/musicCopyright.ts.
//
// Computed client-side deliberately: the audio itself goes straight to Mux
// via a direct upload URL and never passes through our own server, so the
// browser is the only place that ever holds the bytes.

/**
 * Hex SHA-256 of a file's contents, or null when the browser can't do it.
 *
 * `crypto.subtle` only exists in a secure context (https, or localhost in
 * development). Returning null rather than throwing is deliberate: a
 * missing hash must degrade to "duplicate detection didn't run", never to
 * "the upload failed".
 */
export async function sha256HexOfFile(file: File): Promise<string | null> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return null;

    const buffer = await file.arrayBuffer();
    const digest = await subtle.digest("SHA-256", buffer);

    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch (err) {
    console.error("Couldn't hash the audio file:", err);
    return null;
  }
}
