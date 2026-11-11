export const scannerCamera = {
  facingMode: 'environment',
};

// The reader decodes a canvas the size of the *rendered* video, not the camera frame. A badge QR is dense, so the
// preview renders the video at this width and scales it down visually; a phone-sized canvas cannot resolve it.
export const scannerSampleWidth = 1024;

// No qrbox: the reader decodes the whole frame and draws no overlay of its own; the preview draws the viewfinder.
export const scannerOptions = {
  fps: 8,
  disableFlip: true,
  videoConstraints: {
    facingMode: 'environment',
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

/** Lays the full-resolution video out so it covers the card, centred, at the sampling width. */
export function scannerVideoLayout(cardWidth: number, cardHeight: number, videoWidth: number, videoHeight: number) {
  const width = scannerSampleWidth;
  const height = Math.round(width * (videoHeight > 0 && videoWidth > 0 ? videoHeight / videoWidth : 3 / 4));
  const scale = Math.max(cardWidth / width, cardHeight / height) || 1;
  return {
    width,
    height,
    scale,
    left: (cardWidth - width * scale) / 2,
    top: (cardHeight - height * scale) / 2,
  };
}
