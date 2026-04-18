import React, { useState } from 'react';
import { X } from 'lucide-react';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToLogin?: () => void;
}

export default function SignUpModal({ isOpen, onClose, onSwitchToLogin }: SignUpModalProps) {
  const [email, setEmail] = useState('');

  const handleContinue = () => {
    console.log('Email:', email);
    // Handle email sign up logic here
  };

  const handleAppleSignUp = () => {
    console.log('Continue with Apple');
    // Handle Apple sign up logic here
  };

  const handleGoogleSignUp = () => {
    console.log('Continue with Google');
    // Handle Google sign up logic here
  };

  const handleLogin = () => {
    onClose();
    // Navigate to login - this will be handled by parent component
    if (onSwitchToLogin) {
      onSwitchToLogin();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[9999] bg-[#0E193A]">
    {/* US Map overlay - centered and fully visible */}
    <div 
      className="absolute opacity-[0.24]"
      style={{
        width: '95vw',
        height: '95vh',
        top: '5vh',
        left: '2.5vw',
      }}
    >
      <img
       className="w-full h-full object-contain select-none"
       alt="United States map"
       src="/figmaAssets/united-states.png"
       draggable={false}
     />
   </div>
      {/* Sign Up Modal */}
      <div className="relative bg-gray-900 rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Title */}
        <h2 className="text-white text-2xl font-semibold text-center mb-8">
          Sign Up
        </h2>

        {/* Email Input */}
        <div className="mb-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
        </div>

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-4"
        >
          Continue
        </button>

        {/* Login Link */}
        <p className="text-center text-gray-400 text-sm mb-4">
          Already have an account?{' '}
          <button
            onClick={handleLogin}
            className="text-green-400 hover:text-green-300 transition-colors"
          >
            Log in
          </button>
        </p>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-900 text-gray-400">OR</span>
          </div>
        </div>

        {/* Apple Sign Up Button */}
        <button
          onClick={handleAppleSignUp}
          className="w-full bg-white hover:bg-gray-100 text-black font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-3 flex items-center justify-center gap-2"
        >
          <img
              className="w-[17px] h-[21px] opacity-100"
              alt="Apple"
              src="/figmaAssets/Apple.svg"
          />
          Continue with Apple
        </button>

        {/* Google Sign Up Button */}
        <button
          onClick={handleGoogleSignUp}
          className="w-full bg-white hover:bg-gray-100 text-black font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <img
              className="w-[18px] h-[19px] opacity-100"
              alt="Apple"
              src="/figmaAssets/Google.svg"
          />
          Continue with Google
        </button>
      </div>
    </div>
  );
}