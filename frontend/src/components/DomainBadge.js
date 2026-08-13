import { Bot } from "lucide-react";
import { domainMeta } from "../lib/domains";

export default function DomainBadge({ domain, label = null, iconClassName = "w-4 h-4", className = "" }) {
  const meta = domainMeta(domain);

  if (!meta) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-2 border border-line text-ink-2 ${className}`}>
        <Bot className={iconClassName} />
        {label || "General"}
      </span>
    );
  }

  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${meta.bg} ${meta.border} border ${meta.text} ${className}`}>
      <Icon className={iconClassName} />
      {label || meta.expertLabel}
    </span>
  );
}