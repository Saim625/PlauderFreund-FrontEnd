import { useEffect, useRef, useState } from "react";
import { calculateRms } from "../utils/audioUtils"; // Import the VAD helper

// --- VAD Configuration ---
const VAD_THRESHOLD = 0.003; // RMS threshold for speech detection (adjust if needed)
const SILENCE_GRACE_PERIOD_MS = 1000; // Time (ms) to keep sending after silence starts

export function useMicrophone({ onChunk }) {
  const [speaking, setSpeaking] = useState(false);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);
  const isPausedRef = useRef(false); // New ref to handle pause/resume
  const silenceTimerRef = useRef(null); // Timer for the silence grace period

  // --- VAD Logic for the Worklet ---
  const handlePcmMessage = (event) => {
    if (isPausedRef.current) return;

    const pcm16Buffer = event.data;
    const int16Array = new Int16Array(pcm16Buffer);

    // >>> CRITICAL FIX: ALWAYS SEND THE CHUNK TO PREVENT GOOGLE TIMEOUT <<<
    // If the mic is active and not paused, we must stream data continuously (silence included).
    onChunk(pcm16Buffer);
    // >>> END CRITICAL FIX <<<

    // --- VAD Logic (Only for managing the state and sending 'null') ---
    const rms = calculateRms(int16Array);
    const isLoud = rms > VAD_THRESHOLD;

    // 1. If loud, we are speaking
    if (isLoud) {
      // Clear the silence timer if speech is detected
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // Start speaking state if not already started
      if (!speaking) {
        setSpeaking(true);
      }
    }
    // 2. If quiet but currently in the 'speaking' state, manage the grace period
    else if (speaking) {
      // If we were speaking but are now quiet, start the grace timer
      if (!silenceTimerRef.current) {
        // Start the timer to wait for true silence
        silenceTimerRef.current = setTimeout(() => {
          // Timer expired, we are officially done speaking
          setSpeaking(false);
          onChunk(null); // Send a null chunk to signal to the BE that speech has ended (Crucial)
          silenceTimerRef.current = null;
        }, SILENCE_GRACE_PERIOD_MS);
      }
      // If within the grace period, we do nothing: the timer is running and chunks are
      // already being sent by the unconditional onChunk call above.
    }
    // If not speaking and not loud, we do nothing with the state.
  };

  async function start() {
    try {
      console.log("🔄 Attempting to start microphone...");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      await audioContext.audioWorklet.addModule("/pcm-processor.js");
      console.log(`✅ Worklet loaded successfully: /pcm-processor.js`);

      const source = audioContext.createMediaStreamSource(stream);
      const pcmNode = new AudioWorkletNode(audioContext, "pcm-processor");

      pcmNode.port.onmessage = handlePcmMessage;

      source.connect(pcmNode).connect(audioContext.destination);
      workletNodeRef.current = pcmNode;

      // Ensure state is clean when starting
      setSpeaking(false);
      isPausedRef.current = false;

      console.log("🎤 Mic capture started. Streaming 16kHz PCM data.");
    } catch (error) {
      console.error("❌ Error accessing microphone:", error);
      throw error;
    }
  }

  function stop() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setSpeaking(false);

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    isPausedRef.current = false;
    console.log("🛑 Microphone stopped.");
  }

  function pause() {
    isPausedRef.current = true;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setSpeaking(false);
    console.log("⏸️ Microphone paused by application.");
  }

  function resume() {
    isPausedRef.current = false;
    console.log("▶️ Microphone resumed by application.");
  }

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  return { start, stop, pause, resume, speaking };
}
