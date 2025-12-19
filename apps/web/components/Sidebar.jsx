"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

export default function Sidebar({ onClose }) {
  const [chats, setChats] = useState([
    { id: 1, title: "What services does Mobiloitte provide?" },
    { id: 2, title: "Explain the AI development process" },
    { id: 3, title: "Company case studies and projects" },
    { id: 4, title: "HR policies and procedures" },
  ]);
  
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleNewChat = () => {
    // In a real app, this would create a new chat session
    router.push('/chat');
  };
  
  const handleLogout = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    console.log('Logout button clicked');
    
    // Close the dropdown menu first
    setShowProfileMenu(false);
    
    // Close sidebar on mobile if open
    if (onClose) {
      onClose();
    }
    
    try {
      console.log('Calling logout function...');
      // Call logout - this will clear user state and token
      const result = await logout();
      console.log('Logout result:', result);
      
      // Small delay to ensure state is cleared
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force a full page reload to ensure all state is cleared
      console.log('Redirecting to login page...');
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, clear everything and redirect
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  // Close sidebar on mobile when clicking outside
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="flex h-full w-sidebar flex-col bg-chat-sidebar text-chat-text-primary border-r border-light">
      <div className="flex h-full min-h-0 flex-col">
        {/* Enhanced Premium Logo Section */}
        <div className="px-4 py-5 border-b border-light">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 flex items-center justify-center flex-shrink-0 rounded-lg bg-surface/30 p-1.5">
              <img
                src="/assets/logo1.png"
                alt="Mobiloitte AI Logo"
                width={40}
                height={40}
                className="h-full w-full object-contain"
                style={{ 
                  display: 'block',
                  position: 'relative',
                  zIndex: 10
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                  const fallback = e.target.parentElement?.querySelector('.logo-fallback');
                  if (fallback) {
                    fallback.style.display = 'flex';
                    fallback.classList.remove('hidden');
                  }
                }}
                onLoad={(e) => {
                  const fallback = e.target.parentElement?.querySelector('.logo-fallback');
                  if (fallback) {
                    fallback.style.display = 'none';
                    fallback.classList.add('hidden');
                  }
                  e.target.style.display = 'block';
                }}
              />
              <div 
                className="logo-fallback hidden absolute inset-0 h-full w-full items-center justify-center rounded-lg bg-chat-user"
                style={{ zIndex: 0, display: 'none' }}
              >
                <span className="text-base font-bold text-white">M</span>
              </div>
            </div>
            <span className="text-[15px] font-semibold text-white tracking-tight">Mobiloitte AI</span>
            {/* Mobile Close Button */}
            {onClose && (
              <button
                onClick={onClose}
                className="ml-auto p-1.5 rounded-lg hover:bg-surface transition-colors duration-200 md:hidden"
                aria-label="Close sidebar"
              >
                <svg
                  className="h-5 w-5 text-chat-text-secondary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Enhanced New Chat Button */}
        <div className="px-3 py-3.5 border-b border-light">
          <button
            onClick={() => {
              handleNewChat();
              if (onClose) onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-xl border border-light bg-surface/40 px-4 py-3 text-[14px] font-medium text-white hover:bg-surface hover:border-white/20 hover:shadow-sm active:scale-[0.98] transition-all duration-200 ease-out group"
          >
            <svg
              className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span>New chat</span>
          </button>
        </div>
        
        {/* Enhanced Chat History */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="px-2 py-4">
            <div className="mb-3 px-3 py-1.5 text-[11px] font-semibold text-chat-text-muted uppercase tracking-wider">
              Recent
            </div>
            <div className="flex flex-col gap-1">
              {chats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onClose && onClose()}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] text-chat-text-secondary hover:bg-surface hover:text-white transition-all duration-200 ease-out relative"
                >
                  <svg
                    className="h-4 w-4 flex-shrink-0 opacity-50 group-hover:opacity-70 transition-opacity duration-200"
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
                  <span className="truncate text-left flex-1 leading-snug">{chat.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Enhanced Premium Profile Card */}
        <div className="border-t border-light p-3.5">
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex w-full items-center gap-3 rounded-xl border border-light bg-surface/40 px-3.5 py-3 hover:bg-surface hover:border-white/20 hover:shadow-sm transition-all duration-200 ease-out group"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chat-user text-sm font-semibold text-white shadow-md ring-2 ring-chat-user/20">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <div className="text-[14px] font-medium text-white truncate leading-tight">
                  {user?.name || 'User'}
                </div>
                <div className="text-[12px] text-chat-text-muted truncate leading-tight mt-0.5">
                  {user?.role === 'employee' ? 'Employee' : 'Client'}
                </div>
              </div>
              <svg
                className={`h-4 w-4 text-chat-text-muted transition-transform duration-200 flex-shrink-0 group-hover:text-white ${
                  showProfileMenu ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            
            {/* Dropdown Menu */}
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-[5]"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowProfileMenu(false);
                  }}
                />
                <div 
                  className="absolute bottom-full left-0 right-0 mb-2.5 rounded-xl border border-light bg-chat-sidebar py-1.5 shadow-xl backdrop-blur-xl z-[20]"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowProfileMenu(false);
                    }}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-[14px] text-chat-text-secondary hover:bg-surface hover:text-white transition-all duration-200 ease-out rounded-lg mx-1.5"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleLogout(e);
                    }}
                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-[14px] text-chat-text-secondary hover:bg-surface hover:text-white transition-all duration-200 ease-out rounded-lg mx-1.5"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                      />
                    </svg>
                    Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}