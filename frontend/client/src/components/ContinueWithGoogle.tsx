import React, { useEffect, useState } from "react";
import { preloadGoogleSignIn, signInWithGoogle } from "@/lib/googleSignIn";
import type { AccountUser } from "@/lib/apiClient";

interface ContinueWithGoogleProps {
  onSignedIn: (user: AccountUser) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
  className?: string;
}

export default function ContinueWithGoogle({
  onSignedIn,
  onError,
  disabled,
  className,
}: ContinueWithGoogleProps) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    preloadGoogleSignIn();
  }, []);

  const handleClick = async () => {
    if (pending || disabled) return;
    setPending(true);
    try {
      const { user } = await signInWithGoogle();
      onSignedIn(user);
    } catch (err) {
      const message =
        err instanceof Error && err.message
          ? err.message
          : "Google sign-in failed. Please try again.";
      onError?.(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || pending}
      className={
        className ||
        "w-full bg-white hover:bg-gray-100 text-black font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
      }
    >
      <img
        className="w-[18px] h-[19px] opacity-100"
        alt=""
        src="/figmaAssets/Google.svg"
      />
      {pending ? "Connecting to Google…" : "Continue with Google"}
    </button>
  );
}
