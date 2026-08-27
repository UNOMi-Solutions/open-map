import React, { useState } from 'react';
import { X } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiClient';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: (email: string) => void;
}

export default function VerificaitonModal({ isOpen, onClose, onLogin }: VerificationModalProps) {
  const [error, setError] = useState('');
  const [isError, setIsError] = useState(false);

  const handleVerify = async () => {
    /*
    THIS CODE HANDLES THE CALL TO THE BACK END
    */
    const baseURL = getApiBaseUrl();
    const query = window.location.search;
    const response = await fetch(baseURL+ "/api/v1/auth/verify" + query, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
    });

    if (!response.ok) {
      setIsError(true);
      setError("Token invalid or expired");
      return;
    }

    const data = await response.json();
    console.log('Success:', data);
    if (onLogin && data.email) {
      onLogin(data.email);
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
      {/* Verify Modal */}
      <div className="relative bg-gray-900 rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl">
        

        {/* Title */}
        <h2 className="text-white text-2xl font-semibold text-center mb-8">
          Verify Email
        </h2>

        {/* Error display */}
        { isError &&
        <p className="text-center text-red-400 text-sm mb-4">
          {error}
        </p>
        }

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-4"
        >
          Verify
        </button>
      </div>
    </div>
  );
}

