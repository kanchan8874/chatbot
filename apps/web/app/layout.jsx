import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
  title: "Mobiloitte AI - Knowledge Base & Operations Chatbot",
  description: "AI-powered chatbot for company knowledge base and employee operations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <AuthProvider>
          <div role="application" aria-label="AI chatbot workspace">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}