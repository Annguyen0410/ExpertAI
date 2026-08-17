import "./globals.css";
import { Inter, Fraunces } from "next/font/google";
import { ToastProvider } from "../context/ToastContext";
import { AuthProvider } from "../context/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://expertai-io.onrender.com";

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ExpertAI - Expert Guidance, 24/7 at 1/100th the Cost",
    template: "%s | ExpertAI",
  },
  description:
    "World-class professional guidance across legal, financial, and medical domains. Powered by Google Cloud AI.",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "ExpertAI",
    title: "ExpertAI - Professional Expertise, Democratized by AI",
    description:
      "Legal, financial, and medical information guidance through Gemini-powered AI agents, with human escalation for high-risk matters.",
  },
  twitter: {
    card: "summary",
    title: "ExpertAI - Professional Expertise, Democratized by AI",
    description:
      "Legal, financial, and medical information guidance through Gemini-powered AI agents.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("expertai_theme");var t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}