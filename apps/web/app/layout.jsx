import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
  title: "Mobiloitte AI - Knowledge Base & Operations Chatbot",
  description: "AI-powered chatbot for company knowledge base and employee operations",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden">
        <AuthProvider>
          <div className="h-full" role="application" aria-label="AI chatbot workspace">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}