import React, { useState } from 'react';
import { X } from 'lucide-react';
import ContinueWithGoogle from '@/components/ContinueWithGoogle';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: (email: string, plan?: string | null, verified?: boolean) => void;
  onSwitchToLogin?: () => void;
  onSwitchToSignUp?: () => void;
}

export default function SearchPopup({
  isOpen,
  onClose,
  onLogin,
  onSwitchToLogin,
  onSwitchToSignUp,
}: SearchModalProps) {
  const [error, setError] = useState('');

  const handleContinue = () => {
    onClose();
    onSwitchToSignUp?.();
  };

  const handleLogin = () => {
    onClose();
    onSwitchToLogin?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999]">
      {/* Dark background overlay */}
      <div 
        className="absolute bg-black"
        style={{
          width: '1728px',
          height: '1650px',
          opacity: 0.76
        }}
      />
      {/* Sign Up Modal */}
      <div 
        className="relative"
        style={{
          width: '450px',
          height: '503px',
          borderRadius: '64px',
          backgroundColor: '#06012A',
          opacity: 1,
          top: '323px',
          left: '524px',
          transform: 'translate(-50%, -50%)',
          marginTop: '-101.5px',
          marginLeft: '-362px'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Content Container */}
        <div className="flex flex-col items-center justify-center h-full px-12 py-8">
          {/* Main Title */}
          <h1 className="text-white text-center text-lg font-semibold mb-8 leading-tight">
            CREATE AN ACCOUNT TO<br />
            UNLOCK MORE FEATURES.
          </h1>

          {/* Sign Up Subtitle */}
          <h2 className="text-white text-xl font-medium mb-8">
            Sign Up
          </h2>

          {error && (
            <p className="text-center text-red-400 text-sm mb-4">{error}</p>
          )}

          {/* Continue Button */}
          <button
            onClick={handleContinue}
            className="w-full max-w-sm bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-4"
          >
            Continue with email
          </button>

          {/* Login Link */}
          <p className="text-center text-gray-300 text-sm mb-4">
            Already have an account?{' '}
            <button
              onClick={handleLogin}
              className="text-green-400 hover:text-green-300 transition-colors"
            >
              Log in
            </button>
          </p>

          {/* Divider */}
          <div className="relative w-full max-w-sm mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-[#06012A] text-gray-400">OR</span>
            </div>
          </div>

          <ContinueWithGoogle
            className="w-full max-w-sm bg-white hover:bg-gray-100 text-black font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            onSignedIn={(user) => {
              onLogin?.(user.email, user.plan ?? null, user.verified ?? false);
              onClose();
            }}
            onError={setError}
          />
        </div>
      </div>
    </div>
  );
}
