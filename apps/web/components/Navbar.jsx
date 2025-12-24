"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import Link from "next/link";

export default function Navbar() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSignIn = () => {
    router.push("/login");
  };

  return (
    <>
      {/* Top Dark Bar */}
      <div className="w-full bg-[#1a1a1a] border-b border-[#2a2a2a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-end h-8 text-xs text-gray-400">
            {/* Utility links can go here */}
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <nav
        className={`sticky top-0 z-50 w-full bg-white transition-all duration-300 ${
          isScrolled ? "shadow-md" : ""
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo Section */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                <div className="relative h-12 w-12 flex items-center justify-center flex-shrink-0">
                  <img
                    src="/assets/logo1.png"
                    alt="Mobiloitte AI Logo"
                    width={48}
                    height={48}
                    className="h-full w-full object-contain object-center"
                    style={{ maxWidth: '100%', height: 'auto' }}
                    onError={(e) => {
                      e.target.style.display = "none";
                      const fallback = e.target.parentElement?.querySelector(".logo-fallback");
                      if (fallback) {
                        fallback.style.display = "flex";
                      }
                    }}
                  />
                  <div
                    className="logo-fallback hidden absolute inset-0 h-12 w-12 items-center justify-center rounded-lg bg-[#E31E24]"
                    style={{ display: "none" }}
                  >
                    <span className="text-xl font-bold text-white">M</span>
                  </div>
                </div>
                <span className="text-2xl font-bold text-[#E31E24] tracking-tight whitespace-nowrap">
                  MOBILOITTE AI
                </span>
              </Link>
            </div>

            {/* Main Navigation Links */}
            <div className="hidden lg:flex items-center gap-8">
              <Link
                href="/#services"
                className="text-sm font-semibold text-gray-800 uppercase tracking-wide hover:text-[#E31E24] transition-colors duration-200"
              >
                Services
              </Link>
              <Link
                href="/#solutions"
                className="text-sm font-semibold text-gray-800 uppercase tracking-wide hover:text-[#E31E24] transition-colors duration-200"
              >
                Solutions
              </Link>
              <Link
                href="/#about"
                className="text-sm font-semibold text-gray-800 uppercase tracking-wide hover:text-[#E31E24] transition-colors duration-200"
              >
                About
              </Link>
              <Link
                href="/#contact"
                className="text-sm font-semibold text-gray-800 uppercase tracking-wide hover:text-[#E31E24] transition-colors duration-200"
              >
                Contact
              </Link>
              {isAuthenticated && user?.role === "admin" && (
                <Link
                  href="/admin"
                  className="text-sm font-semibold text-gray-800 uppercase tracking-wide hover:text-[#E31E24] transition-colors duration-200"
                >
                  Admin
                </Link>
              )}
            </div>

            {/* Right Side - Auth Buttons (Sign In only; Sign Up hidden for demo) */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleSignIn}
                className="px-6 py-2.5 text-sm font-semibold text-white uppercase tracking-wide bg-gradient-to-r from-[#E31E24] to-[#C41E3A] rounded-md hover:from-[#C41E3A] hover:to-[#E31E24] transition-all duration-200 shadow-md hover:shadow-lg"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
