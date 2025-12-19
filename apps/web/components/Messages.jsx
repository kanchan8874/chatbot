"use client";

import { useRef, useEffect } from "react";

function MessageBubble({ role, content, isLast }) {
  const isUser = role === 'user';
  
  return (
    <div 
      className={`group message-enter w-full ${
        isUser ? 'bg-chat-bg' : 'bg-chat-assistant'
      }`}
    >
      <div className="flex gap-4 px-4 py-5 md:px-6 md:py-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            isUser 
              ? 'bg-chat-user' 
              : 'bg-surface border border-subtle'
          }`}>
            {isUser ? (
              <svg 
                className="h-4.5 w-4.5 text-white" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" 
                />
              </svg>
            ) : (
              <svg 
                className="h-4.5 w-4.5 text-chat-text-primary" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
                />
              </svg>
            )}
          </div>
        </div>
        
        {/* Message Content */}
        <div className="flex-1 min-w-0">
          <div className="text-[15px] text-white leading-[1.75] whitespace-pre-wrap break-words">
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingMessage() {
  return (
    <div className="group w-full bg-chat-assistant message-enter">
      <div className="flex gap-4 px-4 py-5 md:px-6 md:py-6">
        {/* Avatar */}
        <div className="flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-subtle">
            <svg 
              className="h-4.5 w-4.5 text-chat-text-primary" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
              strokeWidth={2}
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" 
              />
            </svg>
          </div>
        </div>
        
        {/* Loading Dots */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 py-1">
            <div className="h-2 w-2 rounded-full bg-chat-text-secondary animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="h-2 w-2 rounded-full bg-chat-text-secondary animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="h-2 w-2 rounded-full bg-chat-text-secondary animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Messages({ messages, isLoading }) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col">
      {messages.map((message, index) => (
        <MessageBubble 
          key={message.id} 
          role={message.role} 
          content={message.content}
          isLast={index === messages.length - 1}
        />
      ))}
      {isLoading && <LoadingMessage />}
      <div ref={messagesEndRef} className="h-4" />
    </div>
  );
}