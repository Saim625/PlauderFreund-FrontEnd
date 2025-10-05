import { useEffect, useState } from "react";
import StartButton from "./components/StartButton";
import Avatar from "./components/Avatar";
import { useMicrophone } from "./hooks/useMicrophone";
import { useSocket } from "./hooks/useSocket";
import { playBlob } from "./utils/audioHelpers";

export default function App() {
  const [stage, setStage] = useState("idle"); // idle | chatting | denied
  const [statusLabel, setStatusLabel] = useState("");

  // NOTE: The transcript state has been removed as we only want audio playback.

  // Get necessary controls from useMicrophone (start/stop/pause/resume)
  const { start, stop, pause, resume } = useMicrophone({
    onChunk: (pcmBuffer) => {
      // The VAD inside useMicrophone now ensures chunks are only sent when speaking.
      sendChunk(pcmBuffer);
    },
  });

  // Simplified useSocket: it only needs the status setter and chunk sender.
  const { connect, sendChunk, disconnect } = useSocket({
    onStatus: setStatusLabel,
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

  useEffect(() => {
    const socket = connect();

    // Listener for the final audio and text reply from the BE
    socket.on("audio-reply", async ({ audio, text }) => {
      console.log(
        `🔊 [FE] Received audio reply from server: "${text}". Playing...`
      );

      // 1️⃣ Pause mic to avoid echo / interference
      pause();
      setStatusLabel("AI Speaking...");

      const audioBlob = new Blob([audio], { type: "audio/mp3" });

      try {
        // 2️⃣ Play AI audio and wait until it's fully finished
        await playBlob(audioBlob);
        console.log("✅ Playback finished.");

        // Optional short delay to avoid cutting too close
        setTimeout(async () => {
          console.log("🎤 Resuming mic after playback delay...");
          stop(); // stop existing audio graph completely
          await start(); // start a fresh one
          setStatusLabel("Listening...");
        }, 500);
      } catch (e) {
        console.error("❌ Error during audio playback:", e);

        // If playback fails, still recover mic after short delay
        setTimeout(async () => {
          stop();
          await start();
          setStatusLabel("Listening...");
        }, 500);
      }
    });

    socket.on("stt-error", ({ message }) => {
      console.error("❌ STT Error from server:", message);
      // setStatusLabel(`STT Error: ${message.substring(0, 40)}...`);

      // 🔎 Check if it's the ignorable timeout
      if (message.includes("Audio Timeout Error")) {
        console.warn("⚠️ Ignoring STT timeout — not resuming mic.");
        return;
      }

      // Otherwise, it's a real error, safe to resume
      console.warn("🔄 Resuming mic after STT error (non-timeout).");
      resume();
    });

    return () => socket.disconnect();
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
