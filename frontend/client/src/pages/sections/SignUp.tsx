import React, { useState } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/apiClient';

interface SignUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin?: (email: string) => void;
  onSwitchToLogin?: () => void;
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

export default function SignUpModal({ isOpen, onClose, onLogin, onSwitchToLogin }: SignUpModalProps) {
  // Didn't know how this code was intended to work, there was very little to work with

  // It seems that the user is supposed to progress through two stages, one for email and one for password
  // There is unfortunately only one page being returned, so we are keeping track of the stage with isEmail state
  const [isError, setIsError] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmail, setIsEmail] = useState(true);
  const [isDone, setIsDone] = useState(false);

  // Originally, only the email was being logged and changed, and the continue button did not work
  // Not correct this, instead of changing the email when input is entered, we change the input variable
  // This is then read when continue is pressed. If the email is valid, we can move to the next stage
  const handleContinue = async () => {

    /*
      Input validation that needs to happen
      1. Check that it's an acutal email
      2. Check if the email is in the database
    */
    if (isEmail) {
      // Check for valid email
      const errorString: string = validateEmailString(input);
      if (errorString != '') {
        setIsError(true);
        setError(errorString);
        return;
      }
      setEmail(input);
      console.log('Email:', input);
      setIsEmail(false);
      setInput('');
    }

    // Once we are in this next stage, we record the password, and log the user straight in

    /*
      Input validation that needs to happen
      1. Check that passwords match between both inputs
      2. Check for strong passwords (special characters, uppercase, number, etc.)
    */
    if(!isEmail) {
      if (input != password) {
        setIsError(true);
        setError("Passwords don't match. Please try again");
        return;
      }

      const errorString: string = validatePasswordString(input);
      if (errorString != '') {
        setIsError(true);
        setError(errorString);
        return;
      }
      
      /*
      THIS CODE HANDLES THE CALL TO THE BACK END
      */
      const baseURL = getApiBaseUrl();
      const response = await fetch(baseURL+ "/api/v1/auth/register", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email,
          password: password
        }),
      });

      if (!response.ok) {
        setIsError(true);
        setError("Something went wrong. Please try again later");
        return;
      }

      const data = await response.json();
      console.log('Success:', data);
      setIsDone(true);
    }
  };

  const handleDone = () => {
    if (onClose) {
      onClose();
    }
  }

  const handleBack = () => {
    setInput('');
    setIsEmail(true);
    setIsError(false);
    setPassword('');
  }

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

        {/* Back Button */}
        { !isEmail &&
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 text-gray-400 hover:text-white transition-colors"
        >
          
          <ArrowLeft className="w-6 h-6" />
        </button>
}

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

        {/* Error display */}
        { isError &&
        <p className="text-center text-red-400 text-sm mb-4">
          {error}
        </p>
        }

        {/* Email Input */}
        { !isDone &&
        <div className="mb-4">
          <input
            type={isEmail ? "email" : "password"}
            placeholder={isEmail ? "Email address" : "Password"}
            value={input}
            onChange={(e) => {setInput(e.target.value); setIsError(false);}}
            className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
        </div>
}

        {/* Password Input */}
        {!isEmail && !isDone &&
        <div className="mb-4">
          <input
            type="password"
            placeholder="Confirm password"
            value={password}
            onChange={(e) => {setPassword(e.target.value); setIsError(false);}}
            className="w-full px-4 py-3 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-900 placeholder-gray-500"
          />
        </div>
}

        {/* Continue Button */}
        { !isDone &&
        <button
          onClick={handleContinue}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-4"
        >
          {isEmail ? 'Continue' : 'Sign Up'}
        </button>
        }

        {/* Done Button */}
        { isDone &&
        <p className="text-center text-white text-sm mb-4">
            An email was sent to <p className="text-white-400 font-semibold">{email}</p>Please check your email to verify your account.
        </p>
        }

        {/* Done Button */}
        { isDone &&
        <button
          onClick={handleDone}
          className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 mb-4"
        >
          Done
        </button>
        }

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