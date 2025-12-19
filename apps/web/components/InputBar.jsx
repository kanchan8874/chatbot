"use client";

import { useState, useRef, useEffect } from "react";

export default function InputBar({ onSend, isLoading }) {
  const [inputValue, setInputValue] = useState("");
  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Max height in pixels (approx 8-9 lines)
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [inputValue]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim() && !isLoading) {
      onSend(inputValue);
      setInputValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isDisabled = !inputValue.trim() || isLoading;

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative flex items-end rounded-2xl border border-chat-input-border bg-surface shadow-sm transition-all duration-200 focus-within:border-chat-user/50 focus-within:shadow-premium-input-focus">
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message Mobiloitte AI..."
          disabled={isLoading}
          rows={1}
          className="max-h-[200px] min-h-[52px] w-full resize-none border-0 bg-transparent px-4 py-3.5 pr-14 text-[15px] text-white placeholder:text-chat-text-muted focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50 leading-[1.5]"
        />
        <button
          type="submit"
          disabled={isDisabled}
          className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-xl bg-chat-user text-white transition-all duration-200 hover:bg-chat-accent-hover hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-chat-user disabled:hover:scale-100 shadow-sm"
          aria-label="Send message"
        >
          {isLoading ? (
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}