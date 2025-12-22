"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import ChatbotAvatar from "../components/ChatbotAvatar";
import ChatbotModal from "../components/ChatbotModal";

export default function HomePage() {
  const { isAuthenticated } = useAuth();
  const [chatbotOpen, setChatbotOpen] = useState(false);

  // Auto-open chatbot modal if user came from /chat redirect
  useEffect(() => {
    // Check if user was redirected from /chat
    const fromChat = sessionStorage.getItem("fromChat");
    if (fromChat === "true") {
      setChatbotOpen(true);
      sessionStorage.removeItem("fromChat");
    }
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      
      {/* Hero Section - Air India Style */}
      <section className="relative bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f3460] min-h-[600px] flex items-center justify-center overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')]"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            {/* Main Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              UP TO 25% OFF*
              <br />
              <span className="text-4xl md:text-5xl lg:text-6xl">ON AI SOLUTIONS</span>
            </h1>
            
            {/* Sub-headline */}
            <p className="text-xl md:text-2xl text-gray-200 mb-8">
              Limited time offers!
            </p>

            {/* CTA Button */}
            <button
              onClick={() => setChatbotOpen(true)}
              className="px-8 py-4 bg-[#E31E24] text-white font-semibold text-lg rounded-lg hover:bg-[#C41E3A] transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Get Started
            </button>
          </div>

          {/* Promotional Cards */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Card 1 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Special Offers</h3>
              <ul className="space-y-2 text-sm text-gray-200">
                <li>• Students</li>
                <li>• Senior Citizens</li>
                <li>• Startups</li>
                <li>• Enterprise</li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Offers for All</h3>
              <p className="text-sm text-gray-200 mb-2">Get Up to ₹2000/- off using</p>
              <p className="text-xs text-gray-300">Promo codes: AI2024, TECH2024</p>
            </div>

            {/* Card 3 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20">
              <h3 className="text-xl font-bold text-white mb-4">Member Benefits</h3>
              <ul className="space-y-2 text-sm text-gray-200">
                <li>• Zero Setup Fee</li>
                <li>• Exclusive discounts</li>
                <li>• Priority support</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Our AI Services
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: "Generative AI", desc: "OpenAI, Gemini, Meta.AI models" },
              { title: "Traditional AI", desc: "Predictive analytics, chatbots" },
              { title: "AI Integration", desc: "MLOps, Databricks, TensorFlow" },
            ].map((service, idx) => (
              <div key={idx} className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{service.title}</h3>
                <p className="text-gray-600">{service.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Solutions Section */}
      <section id="solutions" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-12">
            Solutions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              { title: "AI for Blockchain", desc: "Fraud detection, smart contracts" },
              { title: "AI for Web & Mobile", desc: "Personalization, dynamic interfaces" },
            ].map((solution, idx) => (
              <div key={idx} className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{solution.title}</h3>
                <p className="text-gray-600">{solution.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">About Mobiloitte</h2>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            With over 15 years of experience, Mobiloitte delivers custom AI solutions tailored to specific business needs.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">Contact Us</h2>
          <p className="text-lg text-gray-600 mb-8">
            Get in touch with our team
          </p>
          <button
            onClick={() => setChatbotOpen(true)}
            className="px-8 py-3 bg-[#E31E24] text-white font-semibold rounded-lg hover:bg-[#C41E3A] transition-colors"
          >
            Chat with Us
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Mobiloitte AI</h3>
              <p className="text-gray-400 text-sm">
                AI-powered chatbot for company knowledge base and employee operations.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>AI Development</li>
                <li>Blockchain Solutions</li>
                <li>Web & Mobile Apps</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>About</li>
                <li>Contact</li>
                <li>Careers</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>Help Center</li>
                <li>FAQs</li>
                <li>Contact Support</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-sm text-gray-400">
            <p>&copy; 2024 Mobiloitte. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Chatbot Avatar */}
      <ChatbotAvatar onOpen={() => setChatbotOpen(true)} />

      {/* Chatbot Modal */}
      <ChatbotModal isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />
    </div>
  );
}
