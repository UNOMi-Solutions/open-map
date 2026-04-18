import React, { useState } from 'react';
import { X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: (email: string) => void;
  onSwitchToSignUp?: () => void;
}

export default function LoginModal({ isOpen, onClose, onLogin, onSwitchToSignUp }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    console.log('Email:', email, 'Password:', password);
    // Handle login logic here
    if (onLogin && email) {
      onLogin(email);
    }
  };

  const handleAppleLogin = () => {
    console.log('Login with Apple');
    // Handle Apple login logic here
  };

  const handleGoogleLogin = () => {
    console.log('Login with Google');
    // Handle Google login logic here
  };

  const handleSignUp = () => {
    onClose();
    // Navigate to sign up - this will be handled by parent component
    if (onSwitchToSignUp) {
      onSwitchToSignUp();
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
      {/* Login Modal */}
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
          Login
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

        {/* Password Input */}
        <div className="mb-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
        </div>

        {/* Login Button */}
        <button
          onClick={handleLogin}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-4"
        >
          Login
        </button>

        {/* Sign Up Link */}
        <p className="text-center text-gray-400 text-sm mb-4">
          Don't have an account?{' '}
          <button
            onClick={handleSignUp}
            className="text-green-400 hover:text-green-300 transition-colors"
          >
            Sign up
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

        {/* Apple Login Button */}
        <button
          onClick={handleAppleLogin}
          className="w-full bg-white hover:bg-gray-100 text-black font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-3 flex items-center justify-center gap-2"
        >
          <img
            className="w-[17px] h-[21px] opacity-100"
            alt="Apple"
            src="/figmaAssets/Apple.svg"
          />
          Continue with Apple
        </button>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-white hover:bg-gray-100 text-black font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
        >
          <img
            className="w-[18px] h-[19px] opacity-100"
            alt="Google"
            src="/figmaAssets/Google.svg"
          />
          Continue with Google
        </button>
      </div>
    </div>
  );
}

