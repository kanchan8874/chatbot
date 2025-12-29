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
  const [expandedMessages, setExpandedMessages] = useState(new Set()); // Track expanded "Show more" messages
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

      // Handle formatted responses (Kenyt AI style)
      if (data.formatted && data.chunks && Array.isArray(data.chunks)) {
        // Create multiple message bubbles from chunks
        const chunkMessages = data.chunks.map((chunk, index) => ({
          id: `a-${Date.now()}-${index}`,
          role: "assistant",
          content: chunk.content || '',
          chunkType: chunk.type || 'text',
          chunkData: chunk, // Store full chunk data for structured rendering
        }));
        
        setMessages((prev) => [...prev, ...chunkMessages]);
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
        className={`fixed bottom-4 right-4 z-50 w-[420px] sm:w-[460px] bg-white rounded-xl shadow-3xl transition-all duration-300 ease-out ${
          isMinimized ? "h-20" : "h-[760px] max-h-[90vh]"
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
            {/* Content Area - Spacious */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6 bg-[#FFFBFB]">
              {/* Empty State - Welcome Screen */}
              {messages.length === 0 ? (
                <div className="space-y-6">
                  {/* Welcome Message Bubble - With Avatar (Image 2 style) */}
                  <div className="bg-white rounded-2xl rounded-tr-sm p-4 shadow-md border border-gray-200/50 animate-slideInFromRight relative">
                    {/* Speech Bubble Tail - Left Top */}
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
                      {/* Avatar - Using provided image (Image 3) */}
                      <div className="h-10 w-10 rounded-full overflow-hidden shadow-lg ring-2 ring-white/50 flex-shrink-0">
                        <img
                          src="/assets/chatbot-avatar.png"
                          alt="Chatbot Assistant"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800 leading-relaxed">
                          Hi! I'm your <b>Mobiloitte</b>  {assistantTitle}. <br /> What would you like to do today? <br /> I'm here to help! 😊 
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
                            </Link>{" "}
                            
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
                        className="group flex items-center gap-2.5 px-4 py-2.5  bg-white border border-gray-200 rounded-full hover:border-[#E31E24] hover:bg-[#FFF5F5] transition-all duration-200 text-left focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20 shadow-sm hover:shadow-md animate-fadeInUp"
                        style={{ animationDelay: `${0.7 + index * 0.08}s`, animationFillMode: 'both' }}
                        aria-label={`Ask about ${topic.label}`}
                      >
                        <span className="text-lg leading-none flex-shrink-0">{topic.icon}</span>
                        <span className="text-sm font-medium text-gray-800 group-hover:text-[#E31E24]  transition-colors whitespace-nowrap">
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
                      <h4 className="text-sm font-semibold text-gray-800">Skill Spotlight...</h4>
                    </div>
                    <p className="text-xs text-gray-600 mb-3 animate-fadeInUp" style={{ animationDelay: '1.35s', animationFillMode: 'both' }}></p>
                    <div className="space-y-2">
                      {getSkillSpotlight().map((skill, index) => (
                        <button
                          key={index}
                          onClick={() => handleTopicClick(skill.query)}
                          className="w-full flex items-center gap-4 px-4 py-3.5 bg-white mt-5 hover:bg-[#FFF5F5] rounded-xl border border-gray-200 hover:border-[#E31E24]/30 transition-all duration-200 text-left group focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20 shadow-sm hover:shadow-md cursor-pointer animate-fadeInUp"
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
                /* Chat Messages - WhatsApp Style */
                <div className="space-y-3 pb-2">
                  {messages.map((msg, index) => (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 animate-fadeIn ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      {/* Bot Avatar - Using provided image (Image 3) */}
                      {msg.role === "assistant" && (
                        <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden shadow-lg ring-2 ring-white/50" aria-hidden="true">
                          <img
                            src="/assets/chatbot-avatar.png"
                            alt="Chatbot Assistant"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      {/* Message Card - WhatsApp Style Speech Bubble */}
                      <div
                        className={`max-w-[85%] px-4 py-3 shadow-md relative ${
                          msg.role === "user"
                            ? "bg-gradient-to-br from-[#E31E24] to-[#C41E3A] text-white rounded-2xl rounded-tl-sm"
                            : "bg-white text-gray-900 rounded-2xl rounded-tr-sm border border-gray-200/50"
                        }`}
                        style={{
                          position: 'relative',
                        }}
                      >
                        {/* WhatsApp Style Tail - Left Top Corner (Image 4 style) */}
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
                        {/* Render structured content */}
                        {msg.chunkType === 'structured' && msg.chunkData ? (
                          <div className="space-y-2.5">
                            {msg.chunkData.greeting && (
                              <p className={`text-sm leading-relaxed mb-2 ${msg.role === "user" ? "text-white/90" : "text-gray-700"}`}>
                                {msg.chunkData.greeting}
                              </p>
                            )}
                            {msg.chunkData.title && (
                              <h4 className={`text-sm font-semibold mb-2 ${msg.role === "user" ? "text-white" : "text-gray-900"}`}>
                                {msg.chunkData.title}
                              </h4>
                            )}
                          </div>
                        ) : msg.chunkType === 'bullets' && msg.chunkData?.items ? (
                          <ul className="space-y-2 list-none pl-0">
                            {msg.chunkData.items.map((item, idx) => (
                              <li key={idx} className={`text-sm leading-relaxed flex items-start gap-2.5 ${msg.role === "user" ? "text-white" : "text-gray-800"}`}>
                                <span className={`mt-1 flex-shrink-0 font-bold ${msg.role === "user" ? "text-white" : "text-[#E31E24]"}`}>•</span>
                                <span className="flex-1">{item}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                            {msg.content}
                          </p>
                        )}
                      </div>
                      {/* User Avatar - REMOVED as per user request (Image shows only message bubble, no avatar) */}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                  
                  {/* Loading Indicator - WhatsApp Style */}
                  {isLoading && (
                    <div className="flex items-start justify-start gap-2.5 animate-fadeIn">
                      <div className="flex-shrink-0 h-10 w-10 rounded-full overflow-hidden shadow-lg ring-2 ring-white/50" aria-hidden="true">
                        <img
                          src="/assets/chatbot-avatar.png"
                          alt="Chatbot Assistant"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="bg-white rounded-2xl rounded-tr-sm px-4 py-2.5 border border-gray-200/50 shadow-md relative">
                        {/* Speech Bubble Tail - Left Top */}
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
                      <span className="sr-only">Assistant is typing</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input Area - Attractive Style (Image 3 style) */}
            <div className="border-t border-[#FFE5E5] bg-gradient-to-b from-white to-[#FFFBFB] px-6 py-4">
              <div className="flex items-center gap-3">
                {/* Hamburger Menu Icon */}
                <button
                  className="p-2 hover:bg-[#FFE5E5] rounded-xl transition-all duration-200 text-[#E31E24] focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20 active:scale-95"
                  aria-label="Menu"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                
                {/* Input Field - Attractive rounded style */}
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Type your question here..."
                  className="flex-1 px-5 py-3.5 bg-white border-2 border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#E31E24]/30 focus:border-[#E31E24] transition-all duration-200 text-sm text-gray-900 placeholder-gray-400 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                  disabled={isLoading}
                  aria-label="Chat input"
                />
                
                {/* Send Button - Attractive circular style */}
                <button
                  onClick={() => {
                    handleSend(inputText);
                    // Keep focus on input after button click
                    setTimeout(() => {
                      inputRef.current?.focus();
                    }, 10);
                  }}
                  disabled={isLoading || !inputText.trim()}
                  className="flex-shrink-0 p-3.5 bg-gradient-to-br from-[#E31E24] to-[#C41E3A] text-white rounded-full hover:from-[#C41E3A] hover:to-[#A01A2E] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#E31E24]/30 focus:ring-offset-2 shadow-lg hover:shadow-xl active:scale-95"
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
