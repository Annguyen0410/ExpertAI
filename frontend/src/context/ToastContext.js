"use client";

import { createContext, useContext, useState, useCallback } from "react";

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

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-start gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-medium animate-slide-up ${
              toast.type === "success"
                ? "bg-emerald-900/90 border-emerald-500/30 text-emerald-200"
                : toast.type === "error"
                  ? "bg-red-900/90 border-red-500/30 text-red-200"
                  : "bg-slate-800/90 border-slate-600/30 text-slate-200"
            }`}
          >
            <span className={`mt-0.5 ${toast.type === "success" ? "text-emerald-400" : toast.type === "error" ? "text-red-400" : "text-indigo-400"}`}>
              {toast.type === "success" ? "✓" : toast.type === "error" ? "✗" : "ℹ"}
            </span>
            <p className="flex-1">{toast.message}</p>
            <button onClick={() => removeToast(toast.id)} className="text-slate-400 hover:text-white">×</button>
          </div>
        ))}
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
