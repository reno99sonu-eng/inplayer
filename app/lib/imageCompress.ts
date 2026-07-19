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