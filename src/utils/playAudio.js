export function playAudio(src) {
  const audio = new Audio(src);
  audio.play().catch((err) => {
    console.error("Audio play failed:", err);
  });
}
