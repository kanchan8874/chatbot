"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function ChatbotAvatar({ onOpen }) {
  const { isAuthenticated, user } = useAuth();
  const [isHovered, setIsHovered] = useState(false);

  // Show chatbot avatar for all authenticated users (client, employee, admin)
  // Admin has access to admin-specific chatbot features

  return (
    <div
      className="fixed bottom-6 right-6 z-50 cursor-pointer group"
      onClick={onOpen}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Avatar Circle */}
      <div className="relative">
        {/* Green Status Dot */}
        <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white shadow-lg z-10 animate-pulse" />
        
        {/* Avatar Circle */}
        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-[#E31E24] to-[#C41E3A] flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-[#E31E24]/50">
          {/* Chatbot Icon */}
          <svg
            className="h-8 w-8 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </div>

        {/* Tooltip on Hover */}
        {isHovered && (
          <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg shadow-lg whitespace-nowrap animate-fadeIn">
            Chat with Mobiloitte AI
            <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
          </div>
        )}
      </div>
    </div>
  );
}
