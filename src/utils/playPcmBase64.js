// utils/playPcmBase64.js
let nextStartTime = 0; // keeps track of when next buffer should start

export async function playPcmBase64Chunk(
  base64,
  audioCtx,
  outputSampleRate = 24000
) {
  if (!base64) return;

  // Decode base64 → binary
  const binary = atob(base64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);

  // Convert bytes → Int16 → Float32
  const dataView = new DataView(buffer);
  const float32 = new Float32Array(buffer.byteLength / 2);
  for (let i = 0; i < float32.length; i++) {
    const int16 = dataView.getInt16(i * 2, true);
    float32[i] = int16 / 32768;
  }

  // Create audio buffer (mono)
  const audioBuffer = audioCtx.createBuffer(
    1,
    float32.length,
    outputSampleRate
  );
  audioBuffer.copyToChannel(float32, 0);

  // Schedule playback precisely
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(audioCtx.destination);

  // Initialize nextStartTime on first chunk
  if (nextStartTime < audioCtx.currentTime) {
    nextStartTime = audioCtx.currentTime;
  }

  // Start at queued time
  src.start(nextStartTime);

  // Queue next buffer immediately after this one
  nextStartTime += audioBuffer.duration;

  // Cleanup after playing (optional)
  src.onended = () => src.disconnect();
}
