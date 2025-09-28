import { useState } from "react";
import StartButton from "./components/StartButton";
import Avatar from "./components/Avatar";
import { playAudio } from "./utils/playAudio";

export default function App() {
  const [stage, setStage] = useState("idle");
  // idle | chatting | denied

  const handleStart = async () => {
    try {
      // 1. Request mic permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // ✅ Granted → show Avatar + Play welcome intro
      playAudio("/intro.mp3");
      setStage("chatting");
    } catch (err) {
      // ❌ Denied → play rejection audio + show message
      playAudio("/Zugangsverweigerung.mp3");
      setStage("denied");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-cream">
      {stage === "idle" && <StartButton onStart={handleStart} />}

      {stage === "chatting" && <Avatar />}

      {stage === "denied" && (
        <p className="text-red-600 font-semibold text-xl">
          Microphone access denied
        </p>
      )}
    </div>
  );
}
