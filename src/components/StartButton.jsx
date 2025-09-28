export default function StartButton({ onStart }) {
  return (
    <button
      onClick={onStart}
      className="px-8 py-4 text-xl font-bold rounded-full shadow-lg bg-blue-600 text-white hover:bg-blue-700 transition"
    >
      Starten
    </button>
  );
}
