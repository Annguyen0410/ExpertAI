import "./globals.css";
import { ToastProvider } from "../context/ToastContext";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
  title: "ExpertAI - Expert Guidance, 24/7 at 1/100th the Cost",
  description:
    "World-class professional guidance across legal, financial, and medical domains. Powered by Google Cloud AI.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
