/**
 * Converts a Base64 string to a Blob.
 * @param {string} base64 The base64-encoded string.
 * @param {string} mime The MIME type of the audio (default 'audio/mpeg').
 * @returns {Blob} The resulting Blob object.
 */
export function base64ToBlob(base64, mime = "audio/mpeg") {
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}

/**
 * Plays an audio Blob and returns a Promise that resolves ONLY when the audio finishes.
 * This robust version uses addEventListener for reliable playback tracking.
 * @param {Blob} blob The audio data as a Blob.
 * @returns {Promise<void>} A Promise that resolves on playback 'ended'.
 */
export function playBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      // Remove listeners to prevent memory leaks
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("stalled", onError);
    };

    const onEnded = () => {
      cleanup();
      resolve();
    };

    const onError = (e) => {
      // Reject with a detailed error object instead of just the event
      cleanup();
      reject(
        e instanceof Error
          ? e
          : new Error(`Audio playback failed. Code: ${e.type}`)
      );
    };

    // Use addEventListener for robust, non-overwritable event handling
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    // Add a safety check for network/decoding issues
    audio.addEventListener("stalled", onError);

    // Start playback
    // The .catch here handles cases where play() is denied (e.g., autoplay block)
    audio.play().catch(onError);
  });
}
