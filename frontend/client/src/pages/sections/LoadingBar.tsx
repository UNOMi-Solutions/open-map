import React, { useState } from 'react';
import { Loader } from 'lucide-react';

const LoadingBar = ({ isOpen, onClose }) => {

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="relative flex items-center justify-center rounded-[30px] border-2 border-white/70 bg-transparent p-6 shadow-2xl">
       <Loader color="white"/>
      </div>
    </div>
  );
  };
  
  export default LoadingBar;