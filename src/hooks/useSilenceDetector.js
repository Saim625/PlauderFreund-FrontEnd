import { useEffect, useRef, useState } from "react";

export default function useSilenceDetector(
  stream,
  onSpeakingChange,
  threshold = 0.01
) {
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const speakingRef = useRef(false);

  useEffect(() => {
    if (!stream) return;

    audioContextRef.current = new AudioContext();
    const source = audioContextRef.current.createMediaStreamSource(stream);
    analyserRef.current = audioContextRef.current.createAnalyser();
    analyserRef.current.fftSize = 512;

    source.connect(analyserRef.current);
    dataArrayRef.current = new Uint8Array(
      analyserRef.current.frequencyBinCount
    );

    const checkVolume = () => {
      analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
      let sum = 0;
      for (let i = 0; i < dataArrayRef.current.length; i++) {
        const value = (dataArrayRef.current[i] - 128) / 128;
        sum += value * value;
      }
      const rms = Math.sqrt(sum / dataArrayRef.current.length);

      //   // 🔍 Debug log volume
      //   console.log("📊 Volume level:", rms.toFixed(4));

      const isSpeaking = rms > threshold;
      if (isSpeaking !== speakingRef.current) {
        speakingRef.current = isSpeaking;
        onSpeakingChange(isSpeaking);
        // console.log(
        //   isSpeaking ? "🎤 Speaking detected" : "🤫 Silence detected"
        // );
      }
      requestAnimationFrame(checkVolume);
    };

    checkVolume();

    return () => {
      audioContextRef.current?.close();
    };
  }, [stream, threshold, onSpeakingChange]);
}
