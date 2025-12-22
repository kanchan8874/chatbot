"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { API_ENDPOINTS } from "../../config/api";

export default function LoginPage() {
  // Pre-fill with demo client credentials for quick testing
  const [email, setEmail] = useState("client@mobiloitte.com");
  const [password, setPassword] = useState("client123");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const result = await login(email, password);
      
      if (result.success) {
        // Redirect to homepage after successful login
        router.push("/");
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
      // Google OAuth - Demo implementation
      // In production, use proper Google OAuth flow
      const response = await fetch(API_ENDPOINTS.AUTH.GOOGLE_LOGIN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          googleToken: 'demo-google-token-' + Date.now()
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        localStorage.setItem('token', data.token);
        router.push("/");
      } else {
        setError(data.message || "Google login failed. Please use email/password.");
      }
    } catch (err) {
      setError("Google login is not configured. Please use email/password to sign in.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative h-10 w-10 flex items-center justify-center">
                <img
                  src="/assets/logo1.png"
                  alt="Mobiloitte AI Logo"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-contain"
                />
              </div>
              <span className="text-xl font-bold text-[#E31E24] tracking-tight">
                MOBILOITTE AI
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="px-4 py-2 text-sm font-semibold text-gray-800 uppercase tracking-wide hover:text-[#E31E24] transition-colors duration-200"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12 sm:px-6 lg:px-8 bg-gradient-to-br from-gray-50 to-white">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 sm:p-10">
            {/* Logo and Header */}
            <div className="text-center mb-8">
              <div className="flex justify-center mb-6">
                <div className="relative h-16 w-16 flex items-center justify-center">
                  <img
                    src="/assets/logo1.png"
                    alt="Mobiloitte AI Logo"
                    width={64}
                    height={64}
                    className="h-16 w-16 object-contain"
                  />
                </div>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back
              </h1>
              <p className="text-sm text-gray-600">
                Sign in to access Mobiloitte AI Chatbot
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex items-center gap-2 text-sm text-red-600">
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

            {/* Google Sign In Button (disabled in static demo) */}
            <div className="mb-6">
              <button
                type="button"
                disabled
                className="w-full h-12 rounded-lg border-2 border-gray-200 bg-gray-50 text-gray-400 text-sm font-semibold cursor-not-allowed flex items-center justify-center gap-3"
              >
                <span>Google sign-in is disabled in this demo</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">Or continue with email</span>
              </div>
            </div>

            {/* Login Form */}
            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Email Input */}
              <div>
                <label 
                  htmlFor="email-address" 
                  className="block text-sm font-semibold text-gray-700 mb-2"
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
                  className="w-full h-12 rounded-lg border-2 border-gray-300 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#E31E24] focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20 transition-all duration-200"
                  placeholder="you@example.com"
                />
              </div>
              
              {/* Password Input */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label 
                    htmlFor="password" 
                    className="block text-sm font-semibold text-gray-700"
                  >
                    Password
                  </label>
                  <a 
                    href="#" 
                    className="text-sm font-medium text-[#E31E24] hover:text-[#C41E3A] transition-colors"
                  >
                    Forgot password?
                  </a>
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-12 rounded-lg border-2 border-gray-300 bg-white px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#E31E24] focus:outline-none focus:ring-2 focus:ring-[#E31E24]/20 transition-all duration-200"
                  placeholder="Enter your password"
                />
              </div>

              {/* Remember Me */}
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                />
                <label 
                  htmlFor="remember-me" 
                  className="ml-2 text-sm text-gray-600 cursor-pointer"
                >
                  Remember me
                </label>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 rounded-lg bg-gradient-to-r from-[#E31E24] to-[#C41E3A] text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:from-[#C41E3A] hover:to-[#E31E24] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#E31E24] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
                  "Sign in"
                )}
              </button>
            </form>
          
            {/* Demo credentials helper */}
            <div className="mt-6 text-xs text-gray-500">
              <p className="font-semibold mb-1">Demo logins (static users):</p>
              <ul className="space-y-1">
                <li>Client: client@mobiloitte.com / client123</li>
                <li>HR (Employee): hr@mobiloitte.com / hr123</li>
                <li>Admin: admin@mobiloitte.com / admin123</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
