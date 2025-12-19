"use client";

import { useState } from "react";
import Sidebar from "../../components/Sidebar";
import Messages from "../../components/Messages";
import InputBar from "../../components/InputBar";
import ProtectedRoute from "../../components/ProtectedRoute";
import { useAuth } from "../../context/AuthContext";
import { API_ENDPOINTS } from "../../config/api";

function ChatContent() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: "welcome",
      role: "assistant",
      content: `Hi ${user?.name || 'there'}, I'm Mobiloitte AI. I can help you with:
• Company services and offerings
• Process information and case studies
• General FAQs
${user?.role === 'employee' ? '• Your leave balance and HR queries' : ''}

What would you like to know?`,
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSend = async (text) => {
    if (!text.trim() || isLoading) return;
    
    // Add user message
    const userMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    
    try {
      // Get auth token from localStorage or context
      const token = localStorage.getItem('token');
      
      // Call the backend API
      const response = await fetch(API_ENDPOINTS.CHAT.MESSAGE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          message: text,
          sessionId: "default-session",
          authToken: token,
        }),
      });
      
      const data = await response.json();
      
      // Add AI response
      const aiMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.response,
      };
      
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error calling chat API:", error);
      
      // Fallback response in case of error
      const errorMessage = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
      };
      
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-chat-bg">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden transition-opacity duration-200"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </div>
        </>
      )}
      
      {/* Sidebar - Desktop */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar />
      </div>
      
      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-chat-bg">
        {/* Mobile Header */}
        <div className="flex items-center gap-3 border-b border-subtle bg-chat-bg px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-surface transition-colors duration-200"
            aria-label="Open sidebar"
          >
            <svg
              className="h-5 w-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <h1 className="text-[15px] font-semibold text-white">
            Mobiloitte AI
          </h1>
        </div>
        
        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="flex flex-col items-center">
            <div className="w-full max-w-chat px-4 md:px-6">
              <Messages messages={messages} isLoading={isLoading} />
            </div>
          </div>
        </div>
        
        {/* Input Bar - Premium */}
        <div className="w-full border-t border-subtle bg-chat-bg">
          <div className="flex justify-center px-4 md:px-6 py-4 md:py-5">
            <div className="w-full max-w-chat">
              <InputBar onSend={handleSend} isLoading={isLoading} />
            </div>
          </div>
          <div className="text-center px-4 md:px-6 pb-3 md:pb-4">
            <p className="text-[12px] text-chat-text-muted leading-relaxed">
              Mobiloitte AI can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatContent />
    </ProtectedRoute>
  );
}