import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSwitchToSignUp?: () => void;
}

function validateEmailString(currentEmail: string): string {
  // Email validation rules

  // Must have @
  // Must have one character before @
  // Must have at least two characters after @

  if (currentEmail.length == 0) {
    return "Please input email";
  }

  const atIndex: number = currentEmail.indexOf("@");
  console.log("@ index:", atIndex);
  if (atIndex == -1) {
    return "Email does not contain @. Please enter valid email";
  }

  if (atIndex == 0) {
    return "Email has no local part. Please enter valid email"
  }

  if (atIndex >= currentEmail.length - 3) {
    return "Email has no valid domain. Please enter valid email"
  }

  return '';
}

export default function ForgotPasswordModal({ isOpen, onClose, onSwitchToSignUp }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('');
  const [isEmailCaptured, setIsEmailCaptured] = useState(false);
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState('');

  const handleRecoveryEmail = () => {
    const errorString: string = validateEmailString(email);
    if (errorString != '') {
      setIsError(true);
      setError(errorString);
      return;
    }
    setIsError(false);
    console.log('Email:', email);
    setIsEmailCaptured(true);
    // there is already infrastructure set up to send emails, just use that to send the email

    /*

    const baseURL = getApiBaseUrl();
    const response = await fetch(baseURL+ "/api/v1/auth/reset", {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email
      }),
    });

    if (!response.ok) {
      setIsError(true);
      setError("Something went wrong. Please try again later");
      return;
    }

    const data = await response.json();
    console.log('Success:', data);

    */
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
      {/* Forgot Password Modal */}
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
          Reset Password
        </h2>

        {/* Error display */}
        { isError &&
        <p className="text-center text-red-400 text-sm mb-4">
          {error}
        </p>
        }
        
        {/* Recovery Text */}
        { isEmailCaptured &&
        <p className="text-center text-white text-sm mb-4">
            An email was sent to <p className="text-white-400 font-semibold">{email}</p>Please check your email to reset your password.
        </p>
        }

        {/* Email Input */}
        {!isEmailCaptured &&
        <div className="mb-4">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
        </div>
        }

        {/* Send Recovery Email Button */}
        {!isEmailCaptured &&
        <button
          onClick={handleRecoveryEmail}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-4"
        >
          Send Recovery Email
        </button>
        }

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
      </div>
    </div>
  );
}

