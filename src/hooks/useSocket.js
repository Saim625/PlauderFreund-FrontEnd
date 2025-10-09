import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export function useSocket({ onStatus }) {
  const socketRef = useRef(null);
  const isPlayingRef = useRef(false); // Placeholder for future audio playback state

  useEffect(() => {
    // Cleanup on unmount is vital for development
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const socketUrl = import.meta.env.VITE_SOCKET_URL;

  function connect(url = socketUrl) {
    // Check this URL!
    if (socketRef.current && socketRef.current.connected) {
      console.log("Socket already connected.");
      return socketRef.current;
    }

    if (socketRef.current) {
      socketRef.current.connect();
      return socketRef.current;
    }

    console.log(`🔄 [FE] Attempting connection to: ${url}`);

    const socket = io(url, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection event listeners
    socket.on("connect", () => {
      console.log(`✅ [FE] SUCCESSFULLY CONNECTED! Socket ID: ${socket.id}`);
      onStatus?.("Connected and ready."); // Update UI status
    });

    socket.on("connect_error", (err) => {
      console.error(`❌ [FE] CONNECTION FAILED. Error: ${err.message}`);
      onStatus?.("Connection Error");
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔴 [FE] DISCONNECTED: ${reason}`);
      onStatus?.("Disconnected");
    });

    return socket;
  }

  function disconnect() {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }

  // const endAudio = () => {
  //   if (socket) {
  //     socket.emit("audio-end"); // The new explicit event
  //     console.log("🛑 [FE] Explicit 'audio-end' signal sent to server.");
  //   }
  // };
  // const endAudio = () => {
  //   const socket = socketRef.current;
  //   console.log("🟣 endAudio() called in FE"); // Add this
  //   if (!socket || !socket.connected) {
  //     console.warn("🛑 [FE] Cannot send audio-end: socket not connected.");
  //     return;
  //   }
  //   socket.emit("audio-end");
  //   console.log("🛑 [FE] Explicit 'audio-end' signal sent to server.");
  // };

  /**
   * Sends an audio chunk to the backend via the "audio-chunk" socket event.
   * @param {ArrayBuffer} data - Raw 16-bit PCM audio data
   */
  function sendChunk(data) {
    if (socketRef.current && socketRef.current.connected) {
      // Emit ONLY the raw data (ArrayBuffer)
      socketRef.current.emit("audio-chunk", data);
      // Log the transmission for testing Step 3
      console.log(`📤 [FE] Chunk sent: ${data.byteLength} bytes`);
    }
  }

  // Ensure all destructured values in App.jsx are returned
  return { connect, sendChunk, disconnect, isPlayingRef, socketRef };
}
