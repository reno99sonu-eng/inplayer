import crypto from "crypto";
import { ExternalFingerprintProvider, ExternalFingerprintMatch } from "./musicCopyright";

function buildStringToSign(
  method: string,
  uri: string,
  accessKey: string,
  dataType: string,
  signatureVersion: string,
  timestamp: string
) {
  return [method, uri, accessKey, dataType, signatureVersion, timestamp].join("\n");
}

function sign(signString: string, accessSecret: string) {
  return crypto.createHmac("sha1", accessSecret).update(Buffer.from(signString, "utf-8")).digest("base64");
}

export const acrCloudProvider: ExternalFingerprintProvider = {
  name: "ACRCloud",
  async identify(audioUrl: string): Promise<ExternalFingerprintMatch | null> {
    const host = process.env.ACRCLOUD_HOST;
    const accessKey = process.env.ACRCLOUD_ACCESS_KEY;
    const accessSecret = process.env.ACRCLOUD_SECRET_KEY;
    if (!host || !accessKey || !accessSecret) return null;

    // Fetch the first 2MB of audio with fallback URLs and retry
    const urlsToTry = [
      audioUrl,
      audioUrl.replace("/audio.m4a", "/low.mp4"),
      audioUrl.replace("/audio.m4a", "/medium.mp4"),
      audioUrl.replace("/audio.m4a", "/high.mp4"),
    ];

    let audioBuffer: ArrayBuffer | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      for (const url of urlsToTry) {
        try {
          const res = await fetch(url, {
            headers: { Range: "bytes=0-2097152" }
          });
          if (res.ok || res.status === 206 || res.status === 200) {
            const buf = await res.arrayBuffer();
            if (buf.byteLength > 1000) {
              audioBuffer = buf;
              break;
            }
          }
        } catch {
          // try next URL
        }
      }
      if (audioBuffer) break;
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!audioBuffer) {
      console.warn("ACRCloud identify: could not fetch audio stream from Mux for:", audioUrl);
      return null;
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureVersion = "1";
    const dataType = "audio";
    const reqUri = "/v1/identify";
    const httpMethod = "POST";

    const stringToSign = buildStringToSign(
      httpMethod,
      reqUri,
      accessKey,
      dataType,
      signatureVersion,
      timestamp
    );
    const signature = sign(stringToSign, accessSecret);

    const formData = new FormData();
    formData.append("sample", new Blob([audioBuffer]), "sample.m4a");
    formData.append("access_key", accessKey);
    formData.append("data_type", dataType);
    formData.append("signature_version", signatureVersion);
    formData.append("signature", signature);
    formData.append("sample_bytes", audioBuffer.byteLength.toString());
    formData.append("timestamp", timestamp);

    const apiRes = await fetch(`https://${host}${reqUri}`, {
      method: "POST",
      body: formData as any,
    });
    const data = await apiRes.json();
    
    if (data.status?.code === 0 && data.metadata?.music?.length > 0) {
      const match = data.metadata.music[0];
      return {
        title: match.title,
        artist: match.artists?.map((a: any) => a.name).join(", ") || "Unknown Artist",
        label: match.label || match.album?.name,
        confidence: (match.score || 0) / 100
      };
    }
    return null;
  }
};

