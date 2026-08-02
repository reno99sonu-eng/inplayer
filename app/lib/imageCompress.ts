// Resizes and compresses an image file entirely in the browser before
// upload, using a canvas. Keeps avatars small enough to store directly
// in a DynamoDB item (400KB item limit) without needing separate file
// storage like S3.
export function compressImage(
    file: File,
    maxSize = 200,
    quality = 0.85
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
  
      reader.onload = (e) => {
        const img = new Image();
  
        img.onload = () => {
          let { width, height } = img;
  
          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }
  
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
  
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas is not supported in this browser."));
            return;
          }
  
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
  
        img.onerror = () => reject(new Error("Couldn't read that image file."));
        img.src = e.target?.result as string;
      };
  
      reader.onerror = () => reject(new Error("Couldn't read that file."));
      reader.readAsDataURL(file);
    });
  }

// Data-URL length guard for thumbnails accepted by the upload and edit
// APIs. compressImageToThumbnail() below produces JPEGs comfortably under
// this at its default settings; this exists as a defensive cap so a single
// thumbnail can never come close to DynamoDB's 400KB item limit on its
// own, leaving headroom for the video item's other fields (tags,
// translated captions, etc).
export const THUMBNAIL_DATA_URL_MAX_LENGTH = 200_000;

// Center-crops an image to a fixed aspect ratio (default 16:9, matching
// every thumbnail slot across the app — video cards, the watch page, the
// My Channel list, etc.) before compressing it, so a custom thumbnail
// looks consistently framed everywhere it's shown via object-cover,
// regardless of the screen size or container shape it's displayed in, and
// regardless of the original photo's own aspect ratio. Returns a JPEG data
// URL small enough to store directly on the video's DynamoDB item.
export function compressImageToThumbnail(
  file: File,
  aspectRatio = 16 / 9,
  maxWidth = 640,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const srcRatio = img.width / img.height;

        // Largest centered box of the target ratio that fits inside the
        // source image.
        let cropWidth = img.width;
        let cropHeight = img.height;
        if (srcRatio > aspectRatio) {
          cropWidth = img.height * aspectRatio;
        } else {
          cropHeight = img.width / aspectRatio;
        }
        const cropX = (img.width - cropWidth) / 2;
        const cropY = (img.height - cropHeight) / 2;

        const outWidth = Math.min(maxWidth, cropWidth);
        const outHeight = outWidth / aspectRatio;

        const canvas = document.createElement("canvas");
        canvas.width = outWidth;
        canvas.height = outHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas is not supported in this browser."));
          return;
        }

        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          outWidth,
          outHeight
        );
        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.onerror = () => reject(new Error("Couldn't read that image file."));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

// Data-URL length guard for KYC documents (see app/api/creator/kyc) — each
// document lives in its OWN DynamoDB item (InPlayer-KYC-Documents, one row
// per userId+docType) rather than sharing an item with other fields like
// the thumbnail budget above does, so this gets a much bigger slice of the
// 400KB hard item limit while still leaving comfortable headroom for the
// item's other small attributes (userId, docType, uploadedAt).
export const KYC_DOCUMENT_DATA_URL_MAX_LENGTH = 380_000;

// Compresses an identity/bank document photo (PAN card, Aadhaar, a
// cancelled cheque, a selfie) for KYC review. Deliberately higher
// resolution and quality than compressImageToThumbnail — an admin has to
// actually read the printed text on this image to approve someone for
// real money, so over-compressing it defeats the entire point. No forced
// crop/aspect-ratio (unlike thumbnails/banners): documents come in
// whatever shape the source photo is, and cropping one could cut off part
// of the ID. Same progressive width/quality search as
// cropAndCompressToBanner, just with a far larger target budget and
// starting resolution.
export function compressImageToDocument(
  file: File,
  targetMaxLength = KYC_DOCUMENT_DATA_URL_MAX_LENGTH
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const renderAt = (maxWidth: number, quality: number): string => {
          const scale = Math.min(1, maxWidth / img.width);
          const outWidth = Math.round(img.width * scale);
          const outHeight = Math.round(img.height * scale);

          const canvas = document.createElement("canvas");
          canvas.width = outWidth;
          canvas.height = outHeight;

          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas is not supported in this browser.");

          ctx.drawImage(img, 0, 0, outWidth, outHeight);
          return canvas.toDataURL("image/jpeg", quality);
        };

        try {
          const widths = [1600, 1280, 1000, 720];
          const qualities = [0.85, 0.75, 0.6, 0.45];

          let best = renderAt(widths[0], qualities[0]);
          outer: for (const width of widths) {
            for (const quality of qualities) {
              const candidate = renderAt(width, quality);
              best = candidate;
              if (candidate.length <= targetMaxLength) {
                best = candidate;
                break outer;
              }
            }
          }
          resolve(best);
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Couldn't process that image."));
        }
      };

      img.onerror = () => reject(new Error("Couldn't read that image file."));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

// Compresses a channel cover/banner photo down to a byte budget far
// tighter than a video thumbnail's — this data URL is stored on the SAME
// InPlayer-Users DynamoDB item as the avatar (see COVER_PHOTO_MAX_LENGTH
// in app/api/profile/cover/route.ts), and that item already has up to
// 350KB spoken for by avatarUrl alone against DynamoDB's hard 400KB
// item-size limit. Rather than picking one fixed size/quality and hoping
// it lands under budget (which would make some perfectly normal photos
// fail the server's size check with no way for the person to know why),
// this tries progressively smaller width+quality combinations and stops
// at the first one that fits — so an upload only ever fails if even the
// smallest, lowest-quality attempt is still too big, which in practice
// doesn't happen for a JPEG at these sizes.
// Shared crop+iterative-compress core for the banner budget — used by
// both compressImageToBanner (a File picked from disk) and
// compressDataUrlToBanner (an already-generated image, e.g. from the
// "Generate with AI" flow, which never touches disk at all).
function cropAndCompressToBanner(
  img: HTMLImageElement,
  targetMaxLength: number,
  aspectRatio: number
): string {
  const srcRatio = img.width / img.height;
  let cropWidth = img.width;
  let cropHeight = img.height;
  if (srcRatio > aspectRatio) {
    cropWidth = img.height * aspectRatio;
  } else {
    cropHeight = img.width / aspectRatio;
  }
  const cropX = (img.width - cropWidth) / 2;
  const cropY = (img.height - cropHeight) / 2;

  const renderAt = (maxWidth: number, quality: number): string => {
    const outWidth = Math.min(maxWidth, cropWidth);
    const outHeight = outWidth / aspectRatio;

    const canvas = document.createElement("canvas");
    canvas.width = outWidth;
    canvas.height = outHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser.");

    ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, outWidth, outHeight);
    return canvas.toDataURL("image/jpeg", quality);
  };

  const widths = [1440, 1280, 1024, 768];
  const qualities = [0.85, 0.75, 0.65, 0.5];

  let best = renderAt(widths[0], qualities[0]);
  for (const width of widths) {
    for (const quality of qualities) {
      const candidate = renderAt(width, quality);
      best = candidate;
      if (candidate.length <= targetMaxLength) return candidate;
    }
  }

  // Smallest/lowest-quality attempt still exceeded budget (would only
  // happen for an unusually complex/noisy image) — hand back the best
  // effort and let the server's own size check make the final call
  // rather than silently pretending it fit.
  return best;
}

export function compressImageToBanner(
  file: File,
  targetMaxLength = 140_000,
  aspectRatio = 3.2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          resolve(cropAndCompressToBanner(img, targetMaxLength, aspectRatio));
        } catch (err) {
          reject(err instanceof Error ? err : new Error("Couldn't process that image."));
        }
      };

      img.onerror = () => reject(new Error("Couldn't read that image file."));
      img.src = e.target?.result as string;
    };

    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });
}

// Same crop/compress pipeline as compressImageToBanner, but for an image
// that already exists as a data URL in memory (the AI-generated cover
// photo comes back from the server this way) — no File/FileReader step
// needed since there's nothing on disk to read.
export function compressDataUrlToBanner(
  dataUrl: string,
  targetMaxLength = 140_000,
  aspectRatio = 3.2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      try {
        resolve(cropAndCompressToBanner(img, targetMaxLength, aspectRatio));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Couldn't process that image."));
      }
    };

    img.onerror = () => reject(new Error("Couldn't read the generated image."));
    img.src = dataUrl;
  });
}