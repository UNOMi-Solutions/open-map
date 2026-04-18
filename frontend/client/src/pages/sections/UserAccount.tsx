import React from 'react';

const UserAccount = ({ userEmail, onLogout, onClose, onPlanClick }) => {

  return (
    <div className="bg-gray-700 rounded-lg p-4 w-64 text-white shadow-lg">
      {/* User Email Section */}
      <div className="flex items-center gap-3 mb-4">
      <img
              className="w-[17px] h-[21px] opacity-100"
              alt="User"
              src="/figmaAssets/user-head.svg"
            />
        <span className="text-sm text-gray-200">joe@gmail.com</span>
      </div>
      
      {/* Plan Section */}
      <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-500"
      onClick={() => onPlanClick && onPlanClick()}>
      
      <img
              className="w-[17px] h-[21px] opacity-100"
              alt="Plan"
              src="/figmaAssets/Plan.svg"
            />
        <span className="text-sm text-white">Plan</span>
      </div>
      
      {/* Help Option */}
      <div className="flex items-center gap-3 mb-3 p-2 hover:bg-gray-600 rounded cursor-pointer transition-colors">
      <img
              className="w-[24px] h-[24px] opacity-100"
              alt="Help"
              src="/figmaAssets/Question.svg"
            />
        <span className="text-sm text-white">Help</span>
      </div>
      
      {/* Log out Option */}
      <div className="flex items-center gap-3 p-2 hover:bg-gray-600 rounded cursor-pointer transition-colors">
      <img
              className="w-[17px] h-[21px] opacity-100"
              alt="Logout"
              src="/figmaAssets/logout.svg"
            />
        <span className="text-sm text-white">Log out</span>
      </div>
    </div>
  );
};

export default UserAccount;