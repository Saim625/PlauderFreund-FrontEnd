import { useEffect, useRef, useState } from "react";
import { calculateRms } from "../utils/audioUtils"; // Import the VAD helper

// --- VAD Configuration ---
const VAD_THRESHOLD = 0.003; // RMS threshold for speech detection
const SILENCE_GRACE_PERIOD_MS = 1500; // 1.5 seconds of silence allowed before ending turn

export function useMicrophone({ onChunk }) {
  // External state for UI/component rendering
  const [speaking, setSpeaking] = useState(false);

  // Internal refs for stable VAD logic across renders
  const speakingRef = useRef(false);
  const audioContextRef = useRef(null);
  const workletNodeRef = useRef(null);
  const streamRef = useRef(null);
  const isPausedRef = useRef(false);
  const silenceTimerRef = useRef(null);

  // Unified function to update both state and ref
  const setSpeakingState = (val) => {
    setSpeaking(val);
    speakingRef.current = val;
  };

  // --- VAD Logic for the Worklet ---
  const handlePcmMessage = (event) => {
    if (isPausedRef.current) return;

    const pcm16Buffer = event.data;
    const int16Array = new Int16Array(pcm16Buffer);

    const rms = calculateRms(int16Array);
    const isLoud = rms > VAD_THRESHOLD;

    // Logging for debugging
    // console.log(
    //   "🎧 RMS:",
    //   rms.toFixed(5),
    //   "| Loud:",
    //   isLoud,
    //   "| Speaking:",
    //   speakingRef.current // Use the Ref here for the log
    // );

    // CRITICAL: Always send the chunk to prevent server timeouts.
    onChunk(pcm16Buffer);

    // ------------------------------------------------------------------
    // --- VAD Turn Detection Logic ---
    // ------------------------------------------------------------------

    // 1. LOUD: Speech is detected.
    if (isLoud) {
      // Clear the silence timer if speech is detected
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }

      // Start speaking state if not already started
      // CRITICAL FIX 1: Use the REF for the condition check
      if (!speakingRef.current) {
        setSpeakingState(true);
      }
    }

    // 2. QUIET: Silence detected while in the speaking state.
    // CRITICAL FIX 2: Use the REF for the condition check
    else if (speakingRef.current) {
      // Start the timer only if it's not already running
      if (!silenceTimerRef.current) {
        console.log(
          "🤫 Quiet detected while speaking. Starting silence timer..."
        );

        silenceTimerRef.current = setTimeout(() => {
          // Timer expired, we are officially done speaking
          setSpeakingState(false);

          console.log("✅ Silence timer expired — calling onAudioEnd()");

          // if (onAudioEnd) {
          //   console.log("🛑 Silence detected, sending audio-end...");
          //   onAudioEnd();
          // }

          silenceTimerRef.current = null;
          console.log(
            `Silence confirmed. Turn ended after ${SILENCE_GRACE_PERIOD_MS}ms.`
          );
        }, SILENCE_GRACE_PERIOD_MS);
      }
    }
  };

  async function start() {
    // ... (rest of start function is unchanged)
    try {
      console.log("🔄 Attempting to start microphone...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // This path must be correct for the worklet to load
      await audioContext.audioWorklet.addModule("/pcm-processor.js");
      console.log(`✅ Worklet loaded successfully: /pcm-processor.js`);

      const source = audioContext.createMediaStreamSource(stream);
      const pcmNode = new AudioWorkletNode(audioContext, "pcm-processor");

      // We attach the message handler here
      pcmNode.port.onmessage = handlePcmMessage;

      source.connect(pcmNode).connect(audioContext.destination);
      workletNodeRef.current = pcmNode;

      // Ensure state is clean when starting
      setSpeakingState(false);
      isPausedRef.current = false;

      console.log("🎤 Mic capture started. Streaming 16kHz PCM data.");
    } catch (error) {
      console.error("❌ Error accessing microphone:", error);
      // Deny logic would go here if needed
      throw error;
    }
  }

  function stop() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    setSpeakingState(false);

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
    setSpeakingState(false);
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
