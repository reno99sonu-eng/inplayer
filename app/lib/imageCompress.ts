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