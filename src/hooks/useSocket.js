import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export function useSocket({ onStatus }) {
  const socketRef = useRef(null);
  const socketUrl = import.meta.env.VITE_SOCKET_URL;

  useEffect(() => {
    return () => {
      if (socketRef.current) {
        console.log("🧹 Cleaning up socket on unmount");
        socketRef.current.off(); // remove all listeners
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  function connect(url = socketUrl) {
    // Prevent duplicates
    if (socketRef.current && socketRef.current.connected) {
      console.log("⚙️ Reusing existing socket connection");
      return socketRef.current;
    }

    console.log(`🔄 [FE] Connecting to Socket: ${url}`);
    const socket = io(url, {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // ✅ Basic connection logs
    socket.on("connect", () => {
      console.log(`✅ Connected to server (id: ${socket.id})`);
      onStatus?.("Connected");
    });

    socket.on("disconnect", (reason) => {
      console.log(`🔴 Disconnected: ${reason}`);
      onStatus?.("Disconnected");
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
      onStatus?.("Connection Error");
    });

    return socket;
  }

  function disconnect() {
    if (socketRef.current) {
      console.log("⚠️ Manually closing socket");
      socketRef.current.off();
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }

  function sendChunk(data) {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("audio-chunk", data);
    }
  }

  return { connect, disconnect, sendChunk, socketRef };
}
