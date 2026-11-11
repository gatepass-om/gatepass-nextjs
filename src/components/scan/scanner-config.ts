export const scannerCamera = {
  facingMode: 'environment',
};

// No qrbox: the reader decodes the whole camera frame and draws no overlay of its own. Its shaded box is sized
// from the raw video, which never matches the cropped preview on a phone, so the preview draws the viewfinder.
export const scannerOptions = {
  fps: 12,
  disableFlip: true,
};
