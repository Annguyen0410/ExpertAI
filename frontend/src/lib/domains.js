import { Scale, DollarSign, Heart } from "lucide-react";

export const DOMAINS = [
  {
    id: "legal",
    label: "Legal",
    expertLabel: "Legal Expert",
    desc: "Explore contract terms, leases, and everyday rights questions. Situations that need a licensed attorney can be escalated.",
    icon: Scale,
    text: "text-legal",
    bg: "bg-legal/10",
    border: "border-legal/30",
    solid: "bg-legal",
  },
  {
    id: "financial",
    label: "Financial",
    expertLabel: "Financial Expert",
    desc: "Work through budgets, tax preparation questions, and financial planning basics with clear next steps.",
    icon: DollarSign,
    text: "text-financial",
    bg: "bg-financial/10",
    border: "border-financial/30",
    solid: "bg-financial",
  },
  {
    id: "medical",
    label: "Medical",
    expertLabel: "Medical Expert",
    desc: "Prepare questions for care providers and learn about health topics. It does not diagnose or replace medical care.",
    icon: Heart,
    text: "text-medical",
    bg: "bg-medical/10",
    border: "border-medical/30",
    solid: "bg-medical",
  },
];

export function domainMeta(id) {
  return DOMAINS.find((d) => d.id === id) || null;
}