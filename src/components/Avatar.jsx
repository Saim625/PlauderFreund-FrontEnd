export default function Avatar() {
  return (
    <div className="flex flex-col items-center">
      {/* Avatar image */}
      <img
        src="/face.png"
        alt="Avatar"
        className="w-52 h52 rounded-full shadow-md mb-4"
      />

      <p className="text-lg font-medium text-gray-700">Gespräch läuft...</p>
    </div>
  );
}
