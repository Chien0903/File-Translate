import React from 'react';

const LoadingBar = () => {
  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="w-full h-1 bg-gray-200">
        <div 
          className="h-full bg-indigo-700 animate-loading-bar"
          style={{
            width: '100%',
            animation: 'loading-bar 1.5s ease-in-out infinite',
            background: 'linear-gradient(90deg, #4338CA 0%, #6366F1 50%, #4338CA 100%)',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
    </div>
  );
};

export default LoadingBar; 