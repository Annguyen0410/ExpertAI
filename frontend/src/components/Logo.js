import Link from "next/link";
import { Bot } from "lucide-react";

const sizes = {
  sm: { box: "w-7 h-7 rounded-lg", icon: "w-4 h-4", text: "text-base" },
  md: { box: "w-8 h-8 rounded-xl", icon: "w-5 h-5", text: "text-lg" },
  lg: { box: "w-10 h-10 rounded-2xl", icon: "w-6 h-6", text: "text-xl" },
};

export default function Logo({ href = "/", size = "md", className = "" }) {
  const s = sizes[size] || sizes.md;

  return (
    <Link href={href} className={`inline-flex items-center gap-2 group ${className}`}>
      <span
        className={`${s.box} bg-gradient-to-br from-primary to-legal flex items-center justify-center shadow-lg shadow-primary/25 transition-transform group-hover:scale-105`}
      >
        <Bot className={`${s.icon} text-white`} />
      </span>
      <span className={`${s.text} font-bold tracking-tight`}>
        Expert<span className="text-primary">AI</span>
      </span>
    </Link>
  );
}