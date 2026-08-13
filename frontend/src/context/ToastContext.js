"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext) || { addToast() {}, removeToast() {} };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "success", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const styles = {
    success: {
      box: "border-emerald-500/40",
      icon: "text-emerald-600 dark:text-emerald-400",
      Icon: CheckCircle2,
    },
    error: {
      box: "border-red-500/40",
      icon: "text-red-600 dark:text-red-400",
      Icon: XCircle,
    },
    info: {
      box: "border-primary/40",
      icon: "text-primary",
      Icon: Info,
    },
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => {
          const s = styles[toast.type] || styles.info;
          return (
            <div
              key={toast.id}
              role="status"
              className={`flex items-start gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium animate-slide-up bg-surface text-ink-2 ${s.box}`}
            >
              <span className={`mt-0.5 ${s.icon}`}><s.Icon className="w-5 h-5" /></span>
              <p className="flex-1">{toast.message}</p>
              <button onClick={() => removeToast(toast.id)} aria-label="Dismiss notification" className="text-ink-3 hover:text-ink transition-colors"><X className="w-4 h-4" /></button>
            </div>
          );
        })}
      </div>
      <style jsx global>{`
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
      `}</style>
    </ToastContext.Provider>
  );
}