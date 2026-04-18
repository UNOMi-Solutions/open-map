import { useEffect, useState } from "react";

const STORAGE_KEY = "cookieConsent_v2";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (typeof localStorage !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = (value: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      id="cookie-consent"
      className="fixed bottom-6 right-6 z-[10000] w-[360px] max-w-[calc(100vw-48px)] rounded-lg bg-slate-700 p-5 text-sm leading-relaxed text-white shadow-xl"
      role="dialog"
      aria-label="Cookie policy"
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="m-0 text-base font-bold">Cookie policy</h3>
        <button
          type="button"
          className="border-0 bg-transparent p-0 text-xl leading-none text-white opacity-90 hover:opacity-100"
          aria-label="Close"
          onClick={() => dismiss("dismissed")}
        >
          &times;
        </button>
      </div>
      <p className="mb-4 text-slate-200">
        This site uses cookies to make it work properly, help us understand how it&apos;s used, and to
        display content that is more relevant to you. For more information, see our{" "}
        <a href="/privacy" className="text-white underline">
          Cookie Policy
        </a>
        .
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          onClick={() => dismiss("accepted")}
        >
          Accept
        </button>
        <button
          type="button"
          className="flex-1 rounded-md border border-white bg-transparent px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          onClick={() => dismiss("rejected")}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
