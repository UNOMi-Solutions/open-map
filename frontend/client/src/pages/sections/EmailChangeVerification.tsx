import React, { useEffect, useState } from 'react';
import { ApiError, confirmEmailChange } from '@/lib/apiClient';

interface EmailChangeVerificationProps {
  isOpen: boolean;
  onClose: () => void;
  /** Fired with the new address once the change is applied. */
  onConfirmed?: (email: string) => void;
}

/**
 * Landing screen for the confirmation link mailed to a user's new address.
 * It confirms on mount because the click on the link is the user's consent —
 * asking them to press another button would add nothing.
 */
export default function EmailChangeVerification({
  isOpen,
  onClose,
  onConfirmed,
}: EmailChangeVerificationProps) {
  const [status, setStatus] = useState<'working' | 'done' | 'failed'>('working');
  const [message, setMessage] = useState('Confirming your new email address…');

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const token = new URLSearchParams(window.location.search).get('token') || '';

    if (!token) {
      setStatus('failed');
      setMessage('This confirmation link is missing its token.');
      return;
    }

    (async () => {
      try {
        const data = await confirmEmailChange(token);
        if (cancelled) return;
        setStatus('done');
        setMessage(`Your email is now ${data.email}. Use it the next time you log in.`);
        onConfirmed?.(data.email);
      } catch (e) {
        if (cancelled) return;
        setStatus('failed');
        setMessage(
          e instanceof ApiError && e.message
            ? e.message
            : 'This confirmation link is invalid or has expired.'
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-[#0E193A]">
      <div
        className="absolute opacity-[0.24]"
        style={{ width: '95vw', height: '95vh', top: '5vh', left: '2.5vw' }}
      >
        <img
          className="w-full h-full object-contain select-none"
          alt="United States map"
          src="/figmaAssets/united-states.png"
          draggable={false}
        />
      </div>

      <div className="relative bg-gray-900 rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl">
        <h2 className="text-white text-2xl font-semibold text-center mb-6">Confirm Email Change</h2>

        <p
          className={`text-center text-sm mb-6 ${
            status === 'failed'
              ? 'text-red-400'
              : status === 'done'
              ? 'text-green-400'
              : 'text-gray-300'
          }`}
        >
          {message}
        </p>

        {status !== 'working' && (
          <button
            onClick={() => {
              // Drop the token from the URL so a refresh doesn't retry it.
              window.history.replaceState({}, '', '/');
              onClose();
            }}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200"
          >
            Continue to OpenMap
          </button>
        )}
      </div>
    </div>
  );
}
