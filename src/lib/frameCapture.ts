/**
 * Grab a frame from a video source at the given time as a JPEG blob.
 * Used to give exported clips a meaningful thumbnail (the source frame
 * where the clip starts) since the output video itself is black.
 * Returns null for audio sources or when capture fails.
 */
export async function captureSourceFrame(
  sourceUrl: string,
  time: number
): Promise<Blob | null> {
  if (typeof document === "undefined") {
    return null;
  }

  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = sourceUrl;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not read the video."));
      video.load();
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Could not seek the video."));
      video.currentTime = Math.min(
        Math.max(0, time),
        Math.max(0, duration - 0.05)
      );
    });

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 480 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      return null;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) =>
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8)
    );
  } catch {
    return null;
  } finally {
    video.removeAttribute("src");
  }
}
