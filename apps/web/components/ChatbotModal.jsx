"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { API_ENDPOINTS } from "../config/api";
import TypingMessage from "./TypingMessage";


export default function ChatbotModal({ isOpen, onClose }) {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState(new Set()); // Track expanded "Show more" messages
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US'); // Default language
  const sessionIdRef = useRef(null); // Stable session ID for context persistence
  const userRole = isAuthenticated ? user?.role || "client" : "client";
  const isEmployee = userRole === "employee";
  const isAdmin = userRole === "admin";


  // Role-based popular topics
  const getPopularTopics = () => {
    if (isAdmin) {
      return [
        { icon: "📊", label: "Analytics & Reports", query: "How can I view chatbot usage analytics and user reports?" },
        { icon: "📝", label: "Knowledge Management", query: "How do I manage and update the chatbot knowledge base?" },
        { icon: "👥", label: "User Management", query: "How can I manage users, roles, and permissions?" },
        { icon: "🔧", label: "System Configuration", query: "What system settings and configurations can I manage?" },
        { icon: "📈", label: "Performance Metrics", query: "What performance metrics and KPIs are available for the chatbot?" },
        { icon: "🛡️", label: "Security & Access", query: "How do I manage security settings and access controls?" },
      ];
    } else if (isEmployee) {
      return [
        { icon: "📅", label: "Leave Policy", query: "Explain Mobiloitte's leave policy for employees." },
        { icon: "🏖️", label: "Leave Types", query: "What types of leaves are available (casual, sick, earned)?" },
        { icon: "⏱️", label: "Attendance & Shift", query: "What are the standard working hours and attendance rules?" },
        { icon: "💰", label: "Payroll & Salary", query: "How does payroll processing and salary credit work?" },
        { icon: "📆", label: "Holiday Calendar", query: "Share the official holiday and weekly-off policy." },
        { icon: "☎️", label: "HR Helpdesk", query: "How can I contact HR for support?" },
      ];
    } else {
      return [
        { icon: "🤖", label: "AI Services", query: "What AI services does Mobiloitte provide?" },
        { icon: "💡", label: "Solutions", query: "What solutions does Mobiloitte offer?" },
        { icon: "📚", label: "Company Info", query: "Tell me about Mobiloitte" },
        { icon: "📞", label: "Contact", query: "How can I contact Mobiloitte?" },
        { icon: "❓", label: "FAQs", query: "What are the frequently asked questions?" },
        { icon: "🌐", label: "Website", query: "What is Mobiloitte's website?" },
      ];
    }
  };

  // Role-based skill spotlight
  const getSkillSpotlight = () => {
    if (isEmployee) {
      return [
        {
          text: "Get quick answers on leave, holidays and HR policies",
          query: "What is Mobiloitte's leave policy and holiday calendar? How can I contact HR for policy questions?"
        },
        {
          text: "Understand payroll timelines, reimbursement and salary structure basics",
          query: "How does payroll processing work? What are the salary structure and reimbursement timelines?"
        },
        {
          text: "Learn about attendance rules, shift timings and work-from-home policy",
          query: "What are the standard working hours, attendance rules, and work-from-home policy?"
        },
      ];
    } else {
      return [
        {
          text: "Get instant answers about Mobiloitte's services",
          query: "What services does Mobiloitte provide?"
        },
        {
          text: "Find contact information and company details",
          query: "How can I contact Mobiloitte? What is the company information?"
        },
      ];
    }
  };

  const handleTopicClick = async (query) => {
    setInputText(query);
    await handleSend(query);
    // Keep focus
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleSend = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      const token = localStorage.getItem("token");

      const response = await fetch(API_ENDPOINTS.CHAT.MESSAGE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          message: text,
          sessionId: sessionIdRef.current || `fallback-${Date.now()}`,
          authToken: token,
          language: selectedLanguage,
        }),
      });

      const data = await response.json();

      // Handle formatted responses (Unified into ONE bubble)
      if (data.formatted && data.chunks && Array.isArray(data.chunks)) {
        const unifiedMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.response || "",
          chunks: data.chunks,
        };

        setMessages((prev) => [...prev, unifiedMessage]);
      } else {
        // Fallback: Single message (backward compatibility)
        const aiMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.response,
        };
        setMessages((prev) => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error("Error calling chat API:", error);

      const errorMessage = {
        id: `e-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error processing your request. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      // Ensure focus is maintained after response is received
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(inputText); // Text mode
      // Keep focus on input after Enter key press
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  };

  // Initialize voiceUtils and reset messages + lock body scroll when modal opens
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setIsMinimized(false);

      if (!sessionIdRef.current) {
        sessionIdRef.current = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      }

      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      // Small timeout to ensure DOM is fully rendered
      const timeoutId = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, isOpen, isLoading]);

  // Maintain focus on input after loading completes
  useEffect(() => {
    if (isOpen && !isLoading && messages.length > 0) {
      // Refocus input after response is received
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isLoading, isOpen, messages.length]);

  if (!isOpen) return null;

  const assistantTitle = isAdmin
    ? "Mobiloitte Admin Assistant"
    : isEmployee
      ? "Mobiloitte HR Assistant"
      : " AI Assistant  ";

  return (
    <>
      {/* Backdrop - Soft blur */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-md z-50 transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container - World-class design */}
      <div
        className={`fixed bottom-4 right-4 z-50 w-[420px] sm:w-[460px] bg-white rounded-xl shadow-3xl transition-all duration-300 ease-out ${isMinimized ? "h-20" : "h-[760px] max-h-[78vh]"
          } flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chatbot-title"
      >
        {/* Header - Clean design */}
        <div className="bg-gradient-to-r from-[#FFF0F0] to-[#FFE8E8] px-6 py-4 flex items-center justify-between border-b border-[#FFE5E5]">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Logo - Using logo1.png */}
            <div className="relative flex-shrink-0">
              <div className="h-16 w-16 flex items-center justify-center   overflow-hidden" style={{ borderRadius: '0' }}>
                <img
                  src="/assets/logo1.png"
                  alt="Mobiloitte AI Logo"
                  className="h-full w-full object-contain object-center p-2"
                  style={{ maxWidth: '100%', height: 'auto' }}
                  onError={(e) => {
                    e.target.style.display = "none";
                    const fallback = e.target.parentElement?.querySelector(".logo-fallback");
                    if (fallback) {
                      fallback.style.display = "flex";
                    }
                  }}
                />
                {/* Fallback SVG if logo fails to load */}
                <div className="logo-fallback hidden absolute inset-0 h-16 w-16 bg-gradient-to-br from-[#E31E24] to-[#C41E3A] items-center justify-center" style={{ display: "none", borderRadius: '0' }}>
                  <svg
                    className="h-8 w-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
              </div>
            </div>
            {/* Title Section - Enhanced */}
            <div className="min-w-0 flex-1">
              <h2 id="chatbot-title" className="text-[#E31E24] font-bold text-lg leading-tight truncate">
                {assistantTitle}
              </h2>
            </div>
          </div>
          {/* Control Buttons - Enhanced */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-gray-600 hover:text-[#E31E24] hover:bg-white/80 p-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#E31E24]/30 active:scale-95"
              aria-label={isMinimized ? "Expand chatbot" : "Minimize chatbot"}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-gray-600 hover:text-[#E31E24] hover:bg-white/80 p-2.5 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#E31E24]/30 active:scale-95"
              aria-label="Close chatbot"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Content Area - Persistent Scrollable Flow */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6 bg-[#FFFBFB] scrollbar-hide">
              <div className="space-y-6">
                {/* Welcome Message Bubble - Always at top */}
                <div className="bg-white rounded-2xl rounded-tr-sm p-4 shadow-md border border-gray-200/50 animate-slideInFromRight relative">
                  <div
                    className="absolute -left-1.5 top-0 w-0 h-0"
                    style={{
                      borderRight: '8px solid white',
                      borderTop: '8px solid white',
                      borderBottom: '8px solid transparent',
                      borderLeft: '8px solid transparent',
                    }}
                  />
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full overflow-hidden shadow-lg ring-2 ring-white/50 flex-shrink-0">
                      <img
                        src="/assets/chatbot-avatar.png"
                        alt="Chatbot Assistant"
                        className="w-full h-full object-cover"
                      />0
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-800 leading-relaxed">
                        Hi! I'm your <b>Mobiloitte</b> {assistantTitle}. <br /> What would you like to do today? <br /> I'm here to help! 😊
                      </p>
                      {!isAuthenticated && (
                        <p className="text-xs text-gray-500 mt-2">
                          <Link
                            href="/login"
                            className="text-[#E31E24] hover:underline font-medium"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose();
                            }}
                          >
                            Sign in.
                          </Link>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Popular Topics - Persistent but scrollable with content */}
                <div className="flex flex-wrap gap-2">
                  {getPopularTopics().map((topic, index) => (
                    <button
                      key={index}
                      onClick={() => handleTopicClick(topic.query)}
                      className="group flex items-center gap-2 px-4 py-1.5 bg-white border border-gray-300/60 rounded-full hover:border-[#E31E24]/30 hover:bg-[#FFF8F8] transition-all duration-300 text-left focus:outline-none focus:ring-2 focus:ring-[#E31E24]/10 shadow-[0_4px_12px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.08)] hover:scale-[1.03] active:scale-95 animate-fadeInUp"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <span className="text-base group-hover:scale-110 transition-transform duration-300">{topic.icon}</span>
                      <span className="text-[13px] font-medium text-gray-700 group-hover:text-[#E31E24] transition-colors duration-300">
                        {topic.label}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Chat Messages */}
                {messages.length > 0 && (
                  <div className="space-y-3 pb-2 pt-2 border-t border-gray-100">
                    {messages.map((msg, index) => (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2.5 animate-fadeIn ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        {msg.role === "assistant" && (
                          <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden shadow-lg ring-2 ring-white/50">
                            <img
                              src="/assets/chatbot-avatar.png"
                              alt="Chatbot Assistant"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        <div
                          className={`max-w-[85%] px-5 py-4 shadow-md relative ${msg.role === "user"
                            ? "bg-gradient-to-br from-[#E31E24] to-[#C41E3A] text-white rounded-2xl rounded-tl-sm"
                            : "bg-white text-gray-900 rounded-2xl rounded-tr-sm border border-gray-200/50"
                            }`}
                        >
                          {msg.role === "user" ? (
                            <div
                              className="absolute -left-1.5 top-0 w-0 h-0"
                              style={{
                                borderRight: '8px solid #E31E24',
                                borderTop: '8px solid #E31E24',
                                borderBottom: '8px solid transparent',
                                borderLeft: '8px solid transparent',
                              }}
                            />
                          ) : (
                            <div
                              className="absolute -left-1.5 top-0 w-0 h-0"
                              style={{
                                borderRight: '8px solid white',
                                borderTop: '8px solid white',
                                borderBottom: '8px solid transparent',
                                borderLeft: '8px solid transparent',
                              }}
                            />
                          )}

                          {/* Message Content */}
                          {msg.chunks ? (
                            <div className="space-y-4">
                              {msg.chunks.map((chunk, cIndex) => (
                                <div key={cIndex} className="animate-fadeIn" style={{ animationDelay: `${cIndex * 0.1}s` }}>
                                  {chunk.type === 'structured' ? (
                                    <div className="space-y-2">
                                      {chunk.greeting && <p className="text-sm leading-relaxed text-gray-700">{chunk.greeting}</p>}
                                      {chunk.title && <h4 className="text-sm font-semibold text-gray-900">{chunk.title}</h4>}
                                    </div>
                                  ) : chunk.type === 'bullets' ? (
                                    <ul className="space-y-2 list-none pl-0 mt-1">
                                      {chunk.items.map((item, iIndex) => (
                                        <li key={iIndex} className="text-sm leading-relaxed flex items-start gap-2.5 text-gray-800">
                                          <span className="mt-1 flex-shrink-0 font-bold text-[#E31E24]">•</span>
                                          <span className="flex-1">{item}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-800">
                                      {msg.role === "assistant" && index === messages.length - 1 && cIndex === msg.chunks.length - 1
                                        ? <TypingMessage text={chunk.content} typingSpeed={15} />
                                        : chunk.content}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {msg.role === "assistant" && index === messages.length - 1
                                ? <TypingMessage text={msg.content} typingSpeed={15} />
                                : msg.content}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Loading Indicator */}
                {isLoading && (
                  <div className="flex items-start justify-start gap-2.5 animate-fadeIn">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden shadow-lg ring-2 ring-white/50">
                      <img
                        src="/assets/chatbot-avatar.png"
                        alt="Chatbot Assistant"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="bg-white rounded-2xl rounded-tr-sm px-4 py-2.5 border border-gray-200/50 shadow-md relative">
                      <div
                        className="absolute -left-1.5 top-0 w-0 h-0"
                        style={{
                          borderRight: '8px solid white',
                          borderTop: '8px solid white',
                          borderBottom: '8px solid transparent',
                          borderLeft: '8px solid transparent',
                        }}
                      />
                      <div className="flex gap-1.5">
                        <div className="h-2 w-2 bg-[#E31E24] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-2 w-2 bg-[#E31E24] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-2 w-2 bg-[#E31E24] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Scroll Sentry - Moved to absolute bottom to include loading indicator */}
                <div ref={messagesEndRef} className="h-4" aria-hidden="true" />

                {/* Safe Bottom Padding - Extra space to clear input area */}
                <div className="h-20" aria-hidden="true" />
              </div>
            </div>

            {/* Input Area - Attractive Style (Image 3 style) */}
            <div className="border-t border-[#FFE5E5] bg-gradient-to-b from-white to-[#FFFBFB] px-2 py-4">
              <div className="flex items-center gap-3">


                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Type your question here....."
                  className="flex-1 min-w-0 py-3 px-6 bg-white border border-gray-300 rounded-[12px] focus:outline-none focus:ring-1 focus:ring-[#E31E24]/80 transition-all duration-200 text-[14px] text-gray-900 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed resize-none max-h-32 overflow-y-auto scrollbar-hide shadow-sm"
                  rows="1"
                  disabled={isLoading}
                  aria-label="Chat input"
                />

                {/* Send Button - Attractive circular style */}
                <button
                  onClick={() => {
                    handleSend(inputText); // Explicitly disable voice mode
                    // Keep focus on input after button click
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 10);
                  }}
                  disabled={isLoading || !inputText.trim()}
                  className="flex-shrink-0 h-11 w-11 flex items-center justify-center bg-gradient-to-br from-[#E31E24] to-[#C41E3A] text-white rounded-full hover:from-[#C41E3A] hover:to-[#A01A2E] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#E31E24]/30 focus:ring-offset-2 shadow-lg hover:shadow-xl active:scale-95 "
                  aria-label="Send message"
                  type="button"
                >
                  <svg
                    className="h-5 w-5 translate-x-[1px]"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M2 21l21-9L2 3v7l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        /* Welcome Message - Right to Left Slide Animation */
        @keyframes slideInFromRight {
          from {
            opacity: 0;
            transform: translateX(100px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        /* Fade In Up Animation for Staggered Content */
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        /* Simple Fade In for Chat Messages */
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slideInFromRight {
          animation: slideInFromRight 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        
        .animate-fadeInUp {
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }

        /* Hide scrollbar for Chrome, Safari and Opera */
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }

        /* Hide scrollbar for IE, Edge and Firefox */
        .scrollbar-hide {
          -ms-overflow-style: none;  /* IE and Edge */
          scrollbar-width: none;  /* Firefox */
        }
      `}</style>
    </>
  );
}