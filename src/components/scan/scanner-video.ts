export async function waitForScannerVideo(
  video: EventTarget,
  isReady: () => boolean,
  signal: AbortSignal,
  timeoutMs = 15000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      video.removeEventListener('playing', onPlaying);
      signal.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Camera startup cancelled', 'AbortError'));
    };
    const onPlaying = () => {
      if (!isReady()) return;
      cleanup();
      resolve();
    };
    if (signal.aborted) { onAbort(); return; }
    if (isReady()) { resolve(); return; }
    video.addEventListener('playing', onPlaying);
    signal.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      cleanup();
      reject(new Error('Camera video did not become ready. Retry the camera.'));
    }, timeoutMs);
  });
}
