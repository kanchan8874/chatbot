"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { API_ENDPOINTS } from "../../config/api";

export default function LoginPage() {
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("password123");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { login, isAuthenticated } = useAuth();

  // Redirect to chat if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/chat");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        // Redirect to chat page after successful login
        router.push("/chat");
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError("");
    
    try {
      // In a real implementation, you would integrate with Google OAuth
      // For demo purposes, we'll call the Google login API directly
      const response = await fetch(API_ENDPOINTS.AUTH.GOOGLE_LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          googleToken: 'fake-google-token-for-demo' // In real implementation, this would be actual Google token
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        // Save token to localStorage
        localStorage.setItem('token', data.token);
        // Redirect to chat page after successful login
        router.push("/chat");
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Google login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-[#1a1b23] via-[#252630] to-[#1a1b23] px-4 py-12 sm:px-6 lg:px-8">
      {/* Background Pattern */}
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{
        backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }} />
      
      <div className="w-full max-w-[440px] relative z-10">
        {/* Premium Card Container */}
        <div className="relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.03] backdrop-blur-xl shadow-premium-card p-8 sm:p-10 login-card-enter">
          {/* Card Inner Glow */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/[0.05] to-transparent pointer-events-none" />
          
          {/* Logo and Header Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="mb-6 flex items-center justify-center">
              <div className="relative h-16 w-16 flex items-center justify-center">
                <img
                  src="/assets/logo1.png"
                  alt="Mobiloitte AI Logo"
                  width={64}
                  height={64}
                  className="h-16 w-16 object-contain drop-shadow-lg"
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
                  className="logo-fallback hidden absolute inset-0 h-16 w-16 items-center justify-center rounded-xl bg-chat-user shadow-lg"
                  style={{ zIndex: 0, display: 'none' }}
                >
                  <span className="text-2xl font-bold text-white">M</span>
                </div>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-2">
              Welcome back
            </h1>
            <p className="text-[15px] text-[#9ca3af] leading-relaxed text-center">
              Sign in to access Mobiloitte AI Chatbot
            </p>
          </div>
          
          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
              <div className="flex items-center gap-2.5 text-sm text-red-400">
                <svg
                  className="h-5 w-5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{error}</span>
              </div>
            </div>
          )}
          
          {/* Login Form */}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-5">
              {/* Email Input */}
              <div>
                <label 
                  htmlFor="email-address" 
                  className="block text-sm font-medium text-[#d1d5db] mb-2.5 tracking-tight"
                >
                  Email address
                </label>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-12 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-[#6b7280] focus:border-chat-user/60 focus:bg-white/[0.08] focus:outline-none focus:shadow-premium-input-focus transition-all duration-200 ease-out"
                  placeholder="you@example.com"
                />
              </div>
              
              {/* Password Input */}
              <div>
                <label 
                  htmlFor="password" 
                  className="block text-sm font-medium text-[#d1d5db] mb-2.5 tracking-tight"
                >
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-[15px] text-white placeholder:text-[#6b7280] focus:border-chat-user/60 focus:bg-white/[0.08] focus:outline-none focus:shadow-premium-input-focus transition-all duration-200 ease-out"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center group cursor-pointer">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4.5 w-4.5 rounded-md border-white/20 bg-white/[0.06] text-chat-user focus:ring-2 focus:ring-chat-user/30 focus:ring-offset-0 transition-all duration-200 cursor-pointer"
                />
                <label 
                  htmlFor="remember-me" 
                  className="ml-2.5 text-sm text-[#9ca3af] cursor-pointer group-hover:text-[#d1d5db] transition-colors duration-200"
                >
                  Remember me
                </label>
              </div>

              <a 
                href="#" 
                className="text-sm font-medium text-chat-user hover:text-chat-accent-hover transition-colors duration-200"
              >
                Forgot password?
              </a>
            </div>

            {/* Sign In Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full h-12 rounded-xl bg-chat-user text-white text-[15px] font-semibold shadow-premium-button hover:shadow-premium-button-hover hover:bg-chat-accent-hover active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-chat-user/40 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-premium-button disabled:hover:bg-chat-user transition-all duration-200 ease-out"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  <span className="relative z-10">Sign in</span>
                )}
              </button>
            </div>
          </form>
          
          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-transparent text-[#6b7280] text-[13px]">
                Or continue with
              </span>
            </div>
          </div>

          {/* Google Sign In Button */}
          <div>
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="group w-full h-12 rounded-xl border border-white/10 bg-white/[0.04] text-[15px] font-medium text-white hover:bg-white/[0.08] hover:border-white/15 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ease-out flex items-center justify-center gap-3"
            >
              <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              <span>Sign in with Google</span>
            </button>
          </div>
          
          {/* Sign Up Link */}
          <div className="mt-8 text-center">
            <p className="text-sm text-[#9ca3af]">
              Don't have an account?{" "}
              <a 
                href="#" 
                className="font-semibold text-chat-user hover:text-chat-accent-hover transition-colors duration-200"
              >
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}