// src/utils/pcm-processor.js
// export class PCMProcessor extends AudioWorkletProcessor {
//   constructor() {
//     super();
//     this.buffer = [];
//   }

//   process(inputs) {
//     const input = inputs[0];
//     if (input.length > 0) {
//       const channelData = input[0]; // take first channel (mono)
//       const pcm16 = new Int16Array(channelData.length);
//       for (let i = 0; i < channelData.length; i++) {
//         let s = Math.max(-1, Math.min(1, channelData[i]));
//         pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff; // float → int16
//       }

//       // Send chunk to main thread
//       this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
//     }
//     return true;
//   }
// }

// registerProcessor("pcm-processor", PCMProcessor);

// This code runs in a separate thread (the AudioWorklet)

/**
 * Converts 32-bit floating-point audio data (Float32Array, which is standard
 * for Web Audio) into 16-bit signed integer PCM data (Int16Array, which is
 * required by APIs like Google STT).
 */
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 16-bit little-endian is standard for STT
    this.buffer = new Int16Array(128);
  }

  process(inputs, outputs, parameters) {
    // Get the audio data from the first input and the first channel (mono)
    const input = inputs[0];
    if (input.length > 0) {
      const channel = input[0];
      const length = channel.length;

      // Since the input length might vary, we process it dynamically.
      // We will create the 16-bit output buffer based on the input length.
      const output = new Int16Array(length);

      // Convert each float sample to a 16-bit integer sample
      for (let i = 0; i < length; i++) {
        // Float32 values range from -1.0 to 1.0.
        // We multiply by 32767 (2^15 - 1) to scale it to the Int16 range.
        let sample = channel[i] * 32767.5;

        // Clamp the value to ensure it fits within the signed 16-bit integer range
        output[i] = Math.min(32767, Math.max(-32768, sample));
      }

      // Send the 16-bit PCM data chunk back to the main thread (useMicrophone.js)
      this.port.postMessage(output.buffer, [output.buffer]);
    }

    // Keep the processor running
    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
