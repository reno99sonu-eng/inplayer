export function extractLocalVideoThumbnails(
  file: File,
  count = 4
): Promise<string[]> {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith("video/")) {
      resolve([]);
      return;
    }

    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;

    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;

    const thumbnails: string[] = [];

    video.onloadedmetadata = async () => {
      const duration = video.duration || 1;
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      // Standard 16:9 aspect ratio thumbnail canvas
      canvas.width = 640;
      canvas.height = 360;

      const timestamps: number[] = [];
      for (let i = 1; i <= count; i++) {
        timestamps.push((duration * i) / (count + 1));
      }

      for (const time of timestamps) {
        await new Promise<void>((resSeek) => {
          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            if (ctx) {
              try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                thumbnails.push(canvas.toDataURL("image/jpeg", 0.85));
              } catch (e) {
                console.error("Failed to capture frame snapshot:", e);
              }
            }
            resSeek();
          };
          video.addEventListener("seeked", onSeeked);
          video.currentTime = time;
        });
      }

      URL.revokeObjectURL(objectUrl);
      resolve(thumbnails);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve([]);
    };
  });
}
