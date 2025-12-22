"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import ProtectedRoute from "../../components/ProtectedRoute";

// Redirect /chat to homepage - ChatGPT UI removed, using chatbot modal instead
function ChatRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Set flag to auto-open chatbot modal on homepage
    sessionStorage.setItem("fromChat", "true");
    // Redirect to homepage where chatbot modal is available
    router.replace("/");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to homepage...</p>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatRedirect />
    </ProtectedRoute>
  );
}