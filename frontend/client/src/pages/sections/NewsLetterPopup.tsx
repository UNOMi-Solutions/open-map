import React, { useState } from "react";
import { X } from "lucide-react";

interface NewsletterPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

const NewsletterPopup = ({ isOpen, onClose }: NewsletterPopupProps) => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/v1/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus("success");
        setMessage(typeof data.message === "string" ? data.message : "Thank you for subscribing!");
        setEmail("");
        setTimeout(() => {
          onClose();
          setStatus("idle");
          setMessage("");
        }, 2000);
      } else {
        setStatus("error");
        setMessage(
          typeof data.message === "string"
            ? data.message
            : typeof data.error === "string"
              ? data.error
              : "Could not subscribe. Please try again.",
        );
      }
    } catch {
      setStatus("error");
      setMessage("Connection error. Please try again.");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="relative flex items-center justify-center rounded-[30px] border-2 border-white/70 bg-transparent p-6 shadow-2xl">
        <div className="relative flex w-[320px] flex-col items-center justify-center gap-8 rounded-[36px] bg-white p-10 shadow-[0px_34px_69px_rgba(0,0,0,0.19)]">
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-3 -right-3 rounded-full bg-white p-2 text-gray-600 shadow-lg transition-colors hover:text-gray-900"
          >
            <X size={18} />
          </button>

          <div className="text-center">
            <h2 className="mb-3 font-inter text-xl font-bold text-orange-500">OpenMap Newsletter</h2>
            <p className="text-sm leading-relaxed text-gray-700">
              Sign up to our newsletter to receive the latest updates
            </p>
          </div>

          <div className="w-full space-y-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email address..."
              className="w-full rounded-lg border border-black/10 py-3 text-center text-gray-700 placeholder-gray-400 outline-none transition focus:ring-2 focus:ring-orange-500"
            />

            {message && (
              <p
                className={`text-center text-sm ${
                  status === "success" ? "text-emerald-600" : "text-red-600"
                }`}
              >
                {message}
              </p>
            )}

            <button
              type="button"
              disabled={status === "loading"}
              onClick={handleSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-orange-500 to-red-500 py-4 text-white transition-all duration-200 hover:from-orange-600 hover:to-red-600 disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="20" height="16" x="2" y="4" rx="2" />
                <path d="m22 7-10 5L2 7" />
              </svg>
              {status === "loading" ? "…" : "SIGN UP"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewsletterPopup;
