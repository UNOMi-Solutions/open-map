import React, { useState } from 'react';
import { X } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiClient';

interface ResetPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: (email: string) => void;
}

function validatePasswordString(currentPassword: string): string {
  // Password validation rules

  // Must be at least 8 characters
  // Must be less than 64 chracters
  // Must contain one uppercase letter
  // Must contain one number
  // Must contain one special character

  if (currentPassword.length < 8) {
    return "Password must be at least 8 characters long";
  }

  if (currentPassword.length > 64) {
    return "Password must be less than 64 characters long";
  }

  if (!(/[A-Z]/.test(currentPassword))) {
    return "Password must contain at least one uppercase letter";
  }

  if (!(/[0-9]/.test(currentPassword))) {
    return "Password must contain at least one number";
  }

  if (!(/[^a-zA-Z0-9 ]/.test(currentPassword))) {
    return "Password must contain at least one special character";
  }

  return '';
}

export default function ResetPasswordModal({ isOpen, onClose }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [matchingInput, setMatchingInput] = useState('');
  const [error, setError] = useState('');
  const [isError, setIsError] = useState(false);

  const handleReset = async () => {
    if (matchingInput != password) {
      setIsError(true);
      setError("Passwords don't match. Please try again");
      return;
    }

    const errorString: string = validatePasswordString(password);
    if (errorString != '') {
      setIsError(true);
      setError(errorString);
      return;
    }

    /*
    THIS CODE HANDLES THE CALL TO THE BACK END
    */
    const baseURL = getApiBaseUrl();
    const query = window.location.search;
    const response = await fetch(baseURL+ "/api/v1/auth/reset" + query, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password : password
      }),
    });

    if (!response.ok) {
      setIsError(true);
      setError("Token invalid or expired");
      return;
    }

    const data = await response.json();
    console.log('Success:', data);
    if (onClose) {
      onClose();
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
      {/* Reset Password Modal */}
      <div className="relative bg-gray-900 rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl">
        

        {/* Title */}
        <h2 className="text-white text-2xl font-semibold text-center mb-8">
          Reset Password
        </h2>

        {/* Error display */}
        { isError &&
        <p className="text-center text-red-400 text-sm mb-4">
          {error}
        </p>
        }

        {/* Email Input */}
        <div className="mb-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
        </div>

        {/* Password Input */}
        <div className="mb-4">
          <input
            type="password"
            placeholder="Confirm Password"
            value={matchingInput}
            onChange={(e) => setMatchingInput(e.target.value)}
            className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
        </div>

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-4"
        >
          Reset Password
        </button>
      </div>
    </div>
  );
}

