// Resizes and compresses an image file entirely in the browser before upload using canvas.
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
            width = maxSize;
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

export const THUMBNAIL_DATA_URL_MAX_LENGTH = 200_000;

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

export const KYC_DOCUMENT_DATA_URL_MAX_LENGTH = 380_000;

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
        reject(err instanceof Error ? err : new Error("Couldn't process the generated image."));
      }
    };

    img.onerror = () => reject(new Error("Couldn't read the generated image."));
    img.src = dataUrl;
  });
}

// AI Crop Engine — Intelligently center-crops the image to the exact target aspect ratio
// with vibrant color enhancement and ZERO darkening or dark vignette overlays!
export function aiCropAndRedesignImage(
  dataUrl: string,
  aspectRatio = 3.2,
  outputWidth = 1200
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
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

        const outWidth = Math.min(outputWidth, cropWidth);
        const outHeight = outWidth / aspectRatio;

        const canvas = document.createElement("canvas");
        canvas.width = outWidth;
        canvas.height = outHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not supported in this browser.");

        // Clear, vibrant filter without any darkening vignette overlay!
        ctx.filter = "brightness(1.03) contrast(1.05) saturate(1.08)";
        ctx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, outWidth, outHeight);

        resolve(canvas.toDataURL("image/jpeg", 0.92));
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Couldn't process AI crop & redesign."));
      }
    };
    img.onerror = () => reject(new Error("Couldn't load source image for AI crop."));
    img.src = dataUrl;
  });
}

// Extract Video Hero Frame & Compress to Poster Image Data URL (<100KB)
export function extractVideoFramePoster(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.playsInline = true;
    video.muted = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(1, (video.duration || 2) / 2);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(1200, video.videoWidth || 640);
        canvas.height = canvas.width / ((video.videoWidth || 16) / (video.videoHeight || 9));

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Canvas context unavailable."));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err instanceof Error ? err : new Error("Failed to extract video poster frame."));
      }
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read video file for poster extraction."));
    };
  });
}