export const scannerCamera = {
  facingMode: 'environment',
};

export const scannerOptions = {
  fps: 12,
  qrbox: (width: number, height: number) => {
    const side = Math.floor(Math.min(280, Math.min(width, height) * 0.8));
    return { width: side, height: side };
  },
  disableFlip: true,
};
