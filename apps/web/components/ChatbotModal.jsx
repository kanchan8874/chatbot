"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { API_ENDPOINTS } from "../config/api";

export default function ChatbotModal({ isOpen, onClose }) {
  const { user, isAuthenticated } = useAuth();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Determine user role for role-aware content
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
          text: "Learn about AI solutions and offerings",
          query: "What AI solutions and offerings does Mobiloitte have?"
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
    // Keep focus on input field after clicking topic/skill
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
          sessionId: `chatbot-modal-${Date.now()}`,
          authToken: token,
        }),
      });

      const data = await response.json();

      const aiMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: data.response,
      };

      setMessages((prev) => [...prev, aiMessage]);
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
      handleSend(inputText);
      // Keep focus on input after Enter key press
      setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
    }
  };

  // Reset messages + lock body scroll when modal opens
  useEffect(() => {
    if (isOpen) {
      setMessages([]);
      setIsMinimized(false);
      document.body.style.overflow = "hidden";
      
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen && messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
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
    : "Mobiloitte AI";

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
        className={`fixed bottom-4 right-4 z-50 w-[420px] sm:w-[460px] bg-white rounded-3xl shadow-2xl transition-all duration-300 ease-out ${
          isMinimized ? "h-20" : "h-[750px] max-h-[90vh]"
        } flex flex-col overflow-hidden`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="chatbot-title"
      >
        {/* Header - Clean design */}
        <div className="bg-gradient-to-r from-[#FFF0F0] to-[#FFE8E8] px-6 py-4 flex items-center justify-between border-b border-[#FFE5E5]">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            {/* Avatar - Larger, prominent */}
            <div className="relative flex-shrink-0">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-[#E31E24] to-[#C41E3A] flex items-center justify-center shadow-lg ring-4 ring-white">
                <svg
                  className="h-7 w-7 text-white"
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
            <div className="min-w-0 flex-1">
              <h2 id="chatbot-title" className="text-[#E31E24] font-bold text-lg leading-tight truncate">
                {assistantTitle}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-gray-500 hover:text-gray-700 hover:bg-white/60 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20"
              aria-label={isMinimized ? "Expand chatbot" : "Minimize chatbot"}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d={isMinimized ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 hover:bg-white/60 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20"
              aria-label="Close chatbot"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Content Area - Spacious */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6 bg-[#FFFBFB]">
              {/* Empty State - Welcome Screen */}
              {messages.length === 0 ? (
                <div className="space-y-6">
                  {/* Welcome Message Bubble - Image 3/4 style: Light gray bubble with avatar - Right to Left Animation */}
                  <div className="bg-[#F8F8F8] rounded-2xl p-5 shadow-sm border border-gray-100 animate-slideInFromRight">
                    <div className="flex items-start gap-4">
                      {/* Avatar - Red circle like Image 4 */}
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-[#E31E24] to-[#C41E3A] flex items-center justify-center flex-shrink-0 shadow-sm">
                        <svg
                          className="h-6 w-6 text-white"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-sm text-gray-800 leading-relaxed">
                          Hi! I'm your {assistantTitle.toLowerCase()}. How can I assist you today? whats your plan today?? . Can I help you with anything??
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
                              Sign in
                            </Link>{" "}
                            for employee features.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Popular Topics - Image 1 style: Pill-shaped buttons with icons - Staggered Animation (After Welcome Message) */}
                  <div className="flex flex-wrap gap-2.5">
                    {getPopularTopics().map((topic, index) => (
                      <button
                        key={index}
                        onClick={() => handleTopicClick(topic.query)}
                        className="group flex items-center gap-2.5 px-4 py-2.5 bg-white border border-gray-200 rounded-full hover:border-[#E31E24] hover:bg-[#FFF5F5] transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20 shadow-sm hover:shadow-md animate-fadeInUp"
                        style={{ animationDelay: `${0.7 + index * 0.08}s`, animationFillMode: 'both' }}
                        aria-label={`Ask about ${topic.label}`}
                      >
                        <span className="text-lg leading-none flex-shrink-0">{topic.icon}</span>
                        <span className="text-sm font-medium text-gray-800 group-hover:text-[#E31E24] transition-colors whitespace-nowrap">
                          {topic.label}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Skill Spotlight - Image 2 style: Card-based navigation - Staggered Animation (After Popular Topics) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-3 animate-fadeInUp" style={{ animationDelay: '1.3s', animationFillMode: 'both' }}>
                      <svg className="h-5 w-5 text-[#E31E24]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                      </svg>
                      <h4 className="text-sm font-semibold text-gray-800">Skill Spotlight</h4>
                    </div>
                    <p className="text-xs text-gray-600 mb-3 animate-fadeInUp" style={{ animationDelay: '1.35s', animationFillMode: 'both' }}>Do you know I can help you to..</p>
                    <div className="space-y-2">
                      {getSkillSpotlight().map((skill, index) => (
                        <button
                          key={index}
                          onClick={() => handleTopicClick(skill.query)}
                          className="w-full flex items-center gap-4 px-4 py-3.5 bg-white hover:bg-[#FFF5F5] rounded-xl border border-gray-200 hover:border-[#E31E24]/30 transition-all duration-200 text-left group focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20 shadow-sm hover:shadow-md cursor-pointer animate-fadeInUp"
                          style={{ animationDelay: `${1.4 + index * 0.1}s`, animationFillMode: 'both' }}
                          aria-label={`Ask about ${skill.text}`}
                        >
                          {/* Icon - Left side like Image 2 */}
                          <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gray-50 group-hover:bg-[#FFE5E5] flex items-center justify-center transition-colors">
                            <svg
                              className="h-4 w-4 text-gray-600 group-hover:text-[#E31E24] transition-colors"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth={2}
                              aria-hidden="true"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700 group-hover:text-gray-900 flex-1">{skill.text}</span>
                          <svg
                            className="h-5 w-5 text-gray-400 group-hover:text-[#E31E24] transition-colors flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Chat Messages - Image 2 style: Card-based with icons */
                <div className="space-y-3 pb-2">
                  {messages.map((msg, index) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 animate-fadeIn ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-[#E31E24] to-[#C41E3A] flex items-center justify-center shadow-sm" aria-hidden="true">
                          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                      )}
                      {/* Message Card - Image 2 style: Rounded card with border */}
                      <div
                        className={`max-w-[80%] rounded-xl px-5 py-3.5 shadow-sm ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-[#E31E24] to-[#C41E3A] text-white border-2 border-[#E31E24]"
                            : "bg-[#F8F8F8] text-gray-900 border border-gray-200"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {msg.content}
                        </p>
                      </div>
                      {msg.role === "user" && (
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center" aria-hidden="true">
                          <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                  
                  {/* Loading Indicator */}
                  {isLoading && (
                    <div className="flex justify-start gap-3 animate-fadeIn">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br from-[#E31E24] to-[#C41E3A] flex items-center justify-center shadow-sm" aria-hidden="true">
                        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <div className="bg-[#F8F8F8] rounded-xl px-5 py-3.5 border border-gray-200 shadow-sm">
                        <div className="flex gap-1.5">
                          <div className="h-2 w-2 bg-[#E31E24] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <div className="h-2 w-2 bg-[#E31E24] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <div className="h-2 w-2 bg-[#E31E24] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </div>
                      </div>
                      <span className="sr-only">Assistant is typing</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Area - Minimalist */}
            <div className="border-t border-[#FFE5E5] bg-white px-6 py-4">
              <div className="flex items-center gap-3">
                {/* Hamburger Menu Icon */}
                <button
                  className="p-2 hover:bg-gray-50 rounded-lg transition-colors text-[#E31E24] focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20"
                  aria-label="Menu"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                
                {/* Input Field */}
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your question here..."
                  className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20 focus:border-[#E31E24] transition-all duration-200 text-sm text-gray-900 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isLoading}
                  aria-label="Chat input"
                />
                
                {/* Send Button - Paper airplane */}
                <button
                  onClick={() => {
                    handleSend(inputText);
                    // Keep focus on input after button click
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 10);
                  }}
                  disabled={isLoading || !inputText.trim()}
                  className="flex-shrink-0 p-3 bg-[#E31E24] text-white rounded-full hover:bg-[#C41E3A] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20 focus:ring-offset-2 shadow-sm hover:shadow-md active:scale-95"
                  aria-label="Send message"
                  type="button"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
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
      `}</style>
    </>
  );
}
