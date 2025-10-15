export default function Avatar() {
  return (
    <div className="flex flex-col items-center">
      {/* Avatar image with enhanced purple aura */}
      <div className="relative">
        <img
          src="/face.png"
          alt="Avatar"
          className="w-52 h-52 rounded-full avatar-with-aura"
        />
      </div>

      <style jsx>{`
        .avatar-with-aura {
          border: none;
          box-shadow: 0 0 40px rgba(147, 112, 219, 0.6);
          animation: subtle-pulse 2.8s ease-in-out infinite;
        }

        @keyframes subtle-pulse {
          0%,
          100% {
            box-shadow: 0 0 30px rgba(147, 112, 219, 0.4);
          }
          50% {
            box-shadow: 0 0 60px rgba(147, 112, 219, 0.75);
          }
        }
      `}</style>
    </div>
  );
}
