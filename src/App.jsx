import { useEffect, useState } from "react";
import StartButton from "./components/StartButton";
import Avatar from "./components/Avatar";
import { useMicrophone } from "./hooks/useMicrophone";
import { useSocket } from "./hooks/useSocket";
import { playBlob } from "./utils/audioHelpers";
import { playPcmBase64Chunk } from "./utils/playPcmBase64";

export default function App() {
  const [stage, setStage] = useState("idle"); // idle | chatting | denied
  const [statusLabel, setStatusLabel] = useState("");

  // NOTE: The transcript state has been removed as we only want audio playback.

  // Simplified useSocket: it only needs the status setter and chunk sender.
  const { connect, sendChunk, endAudio, disconnect } = useSocket({
    onStatus: setStatusLabel,
  });

  // 2. Update the useMicrophone hook call
  const { start, stop, pause, resume } = useMicrophone({
    // Simplified onChunk function since it's a direct passthrough
    onChunk: sendChunk,

    // CRITICAL: Pass the new socket emitter for the VAD to use
    // onAudioEnd: endAudio,
  });

  const handleStart = async () => {
    try {
      connect(); // connect socket

      setStage("chatting");

      await playBlob(
        new Blob([await fetch("/intro.mp3").then((r) => r.arrayBuffer())], {
          type: "audio/mpeg",
        })
      );

      await start(); // start mic
      setStatusLabel("Listening...");
    } catch (err) {
      console.error("Mic denied:", err);
      setStage("denied");
    }
  };

  // const handleStop = () => {
  //   stop();
  //   disconnect();
  //   setStage("idle");
  //   setStatusLabel("");
  // };

  // useEffect(() => {
  //   const socket = connect();

  //   // 🎧 Listen for GPT’s real-time audio stream
  //   const audioContext = new AudioContext({ sampleRate: 24000 });

  //   // 🟢 Flag to know when the first chunk starts playing
  //   let startedPlayback = false;

  //   socket.on("ai-audio-chunk", async (base64Chunk) => {
  //     if (!startedPlayback) {
  //       startedPlayback = true;
  //       await new Promise((r) => setTimeout(r, 150)); // small buffer
  //     }
  //     await playPcmBase64Chunk(base64Chunk, audioContext);
  //   });

  //   socket.on("ai-audio-done", async () => {
  //     console.log("✅ [FE] AI finished speaking");
  //     startedPlayback = false; //
  //     pause();
  //     setStatusLabel("AI Speaking...");

  //     // wait a small delay then resume mic
  //     setTimeout(async () => {
  //       stop();
  //       await start();
  //       setStatusLabel("Listening...");
  //     }, 300);
  //   });

  //   socket.on("ai-response-done", () => {
  //     console.log("🧠 [FE] Model response fully complete.");
  //   });

  //   // 🧠 Error handler
  //   socket.on("ai-error", ({ message }) => {
  //     console.error("❌ ai error:", message);
  //     console.warn("🔄 Resuming mic after STT error (non-timeout).");
  //     resume();
  //   });

  //   return () => socket.disconnect();
  // }, []);

  useEffect(() => {
    const socket = connect();

    // 🎧 Audio setup with proper buffering
    const audioContext = new AudioContext({ sampleRate: 24000 });
    let audioQueue = [];
    let isPlaying = false;
    let nextStartTime = 0;
    const MIN_BUFFER_CHUNKS = 2; // Buffer 2 chunks before starting

    // 🎵 Play queued audio chunks smoothly
    const playQueuedAudio = async () => {
      if (isPlaying || audioQueue.length === 0) return;

      // Wait for minimum buffer before starting
      if (nextStartTime === 0 && audioQueue.length < MIN_BUFFER_CHUNKS) {
        return;
      }

      isPlaying = true;

      // Ensure audio context is running
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }

      // Schedule all queued chunks
      while (audioQueue.length > 0) {
        const base64Chunk = audioQueue.shift();

        try {
          // Decode the base64 PCM audio
          const binaryString = atob(base64Chunk);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Convert to Int16Array (PCM 16-bit)
          const pcmData = new Int16Array(bytes.buffer);

          // Create audio buffer
          const audioBuffer = audioContext.createBuffer(
            1, // mono
            pcmData.length,
            24000
          );

          // Fill the buffer with PCM data (normalize from int16 to float)
          const channelData = audioBuffer.getChannelData(0);
          for (let i = 0; i < pcmData.length; i++) {
            channelData[i] = pcmData[i] / 32768.0; // normalize int16 to -1.0 to 1.0
          }

          // Create source and schedule playback
          const source = audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContext.destination);

          // Schedule to play immediately after previous chunk
          if (nextStartTime === 0) {
            nextStartTime = audioContext.currentTime;
          }

          source.start(nextStartTime);

          // Update next start time to avoid gaps
          nextStartTime += audioBuffer.duration;
        } catch (error) {
          console.error("❌ Error playing audio chunk:", error);
        }
      }

      isPlaying = false;
    };

    // 🟢 Receive and queue audio chunks
    socket.on("ai-audio-chunk", async (base64Chunk) => {
      audioQueue.push(base64Chunk);
      playQueuedAudio(); // Try to start/continue playback
    });

    socket.on("ai-audio-done", async () => {
      console.log("✅ [FE] AI finished speaking");

      // Wait for all queued audio to finish
      const remainingDuration = Math.max(
        0,
        nextStartTime - audioContext.currentTime
      );

      await new Promise((r) => setTimeout(r, remainingDuration * 1000 + 300));

      // Reset audio state
      audioQueue = [];
      nextStartTime = 0;
      isPlaying = false;

      pause();
      setStatusLabel("AI Speaking...");

      // Resume mic
      setTimeout(async () => {
        stop();
        await start();
        setStatusLabel("Listening...");
      }, 300);
    });

    socket.on("ai-response-done", () => {
      console.log("🧠 [FE] Model response fully complete.");
    });

    socket.on("ai-error", ({ message }) => {
      console.error("❌ ai error:", message);
      console.warn("🔄 Resuming mic after STT error (non-timeout).");

      // Clean up audio state on error
      audioQueue = [];
      nextStartTime = 0;
      isPlaying = false;

      resume();
    });

    // Cleanup
    return () => {
      socket.disconnect();
      audioContext.close();
    };
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#fdfcf7] font-[Inter] p-4">
      {stage === "idle" && <StartButton onStart={handleStart} />}

      {stage === "chatting" && (
        <div className="flex flex-col items-center w-full max-w-md bg-white p-8 rounded-xl shadow-2xl transition-all duration-300">
          <Avatar status={statusLabel} />

          {/* This area now ONLY shows the status/prompt, no transcript */}
          <div className="mt-6 text-lg font-medium text-gray-800 text-center min-h-[4rem] flex items-center justify-center">
            {statusLabel === "Listening..." ? "Speak now..." : statusLabel}
          </div>

          <div className="mt-4 text-sm text-center text-gray-500">
            {statusLabel}
          </div>
          {/* 
          <button
            onClick={handleStop}
            className="mt-8 px-6 py-3 bg-red-600 text-white font-semibold rounded-full shadow-lg hover:bg-red-700 transition duration-150 transform hover:scale-105 active:scale-95"
            disabled={statusLabel === "AI Speaking..."}
          >
            Stop Chat
          </button> */}
        </div>
      )}

      {stage === "denied" && (
        <div className="flex flex-col items-center p-8 bg-white rounded-xl shadow-2xl">
          <p className="text-red-600 font-bold text-xl">
            Microphone Access Denied
          </p>
          <p className="text-gray-500 mt-2">
            Please enable microphone permissions in your browser settings.
          </p>
        </div>
      )}
    </div>
  );
}
