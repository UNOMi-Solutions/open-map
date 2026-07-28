import React from 'react';

export default function ProgressBar({ value = 0 }) {
  // Keep the progress percentage bounded between 0 and 100
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div style={{ width: '100%', fontFamily: 'sans-serif' }}>
      {/* Outer track container */}
      <div 
        style={{
          width: '100%',
          backgroundColor: '#e0e0e0',
          borderRadius: '8px',
          overflow: 'hidden',
          height: '24px',
          position: 'relative'
        }}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        {/* Inner filling bar */}
        <div 
          style={{
            width: `${clampedValue}%`,
            backgroundColor: '#0070f3',
            height: '100%',
            transition: 'width 0.3s ease-in-out',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: '12px'
          }}
        >
          {/* Hide text if space is too cramped (less than 10%) */}
          {clampedValue >= 10 && `${clampedValue}%`}
        </div>
      </div>
    </div>
  );
}