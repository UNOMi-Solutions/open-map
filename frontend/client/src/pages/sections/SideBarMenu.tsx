import React, { useState } from 'react';
import { X, User, Mail, Home } from 'lucide-react';
interface SidebarMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onContactClick: () => void;
  onAboutClick: () => void;
  onNewsletterClick: () => void;
  onPriceClick: () => void;
}

export default function SideBarMenu({ isOpen, onClose, onContactClick,onAboutClick, onPriceClick, onNewsletterClick }: SidebarMenuProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed bg-gray-200 flex flex-col"
      style={{
        width: '343px',
        height: '1198px',
        right: '0px',
        top: '0px',
        paddingTop: '12px',
        paddingRight: '46px',
        paddingBottom: '12px',
        paddingLeft: '46px',
        gap: '29px',
        opacity: 1,
        zIndex: 1000
      }}
    >
      {/* Close Button */}
      <button
        onClick={onClose}
        className="self-end p-2"
        aria-label="Close Menu"
      >
        <X className="w-6 h-6 text-gray-700" />
      </button>

      {/* Logo/Brand */}
      <div className="flex items-center gap-2 mb-4">
      <img
            className="w-[20px] h-[21px]"
            alt="Home"
            src="/figmaAssets/Home.svg"
            />
        <h1 className="text-xl font-bold text-gray-800">OpenMap</h1>
      </div>

      {/* Menu Items */}
      <div className="flex flex-col" style={{ gap: '29px' }}>
        {/* About Us */}
        <button
  onClick={() => {
    onAboutClick();
    onClose(); // Close the sidebar when about modal opens
  }}
  className="flex items-center gap-3 py-3 px-2 text-gray-800 hover:bg-gray-400 rounded-md transition-colors duration-200 w-full text-left"
>
  <img
    className="w-[19px] h-[17.54px]"
    alt="about-us"
    src="/figmaAssets/about-us.svg"
  />
  <span className="text-xl font-bold text-gray-800">About Us</span>
</button>

        {/* Contact Us */}

<button
  onClick={() => {
    onContactClick();
    onClose(); // Close the sidebar when contact form opens
  }}
  className="flex items-center gap-3 py-3 px-2 text-gray-800 hover:bg-gray-400 rounded-md transition-colors duration-200 w-full text-left"
>
  <img
    className="w-[19px] h-[17.54px]"
    alt="contact-us"
    src="/figmaAssets/contact-us.svg"
  />
  <span className="text-xl font-bold text-gray-800">Contact Us</span>
</button>

        {/* Newsletter */}
        <button
          onClick={() => {
            onNewsletterClick();
            onClose(); // Close the sidebar when newsletter opens
          }}
          className="flex items-center gap-3 py-3 px-2 text-gray-800 hover:bg-gray-400 rounded-md transition-colors duration-200 w-full text-left"
        >
          <Mail className="w-[19px] h-[17.54px] text-gray-800" />
          <span className="text-xl font-bold text-gray-800">Newsletter</span>
        </button>
{ /* Plans */ }
<button
  onClick={() => {
    onPriceClick();
    onClose(); // Close the sidebar when contact form opens
  }}
  className="flex items-center gap-3 py-3 px-2 text-gray-800 hover:bg-gray-400 rounded-md transition-colors duration-200 w-full text-left"
>
  <img
    className="w-[19px] h-[17.54px]"
    alt="plans"
    src="./figmaAssets/plans.svg"
  />
  <span className="text-xl font-bold text-gray-800">Plans</span>
</button>
      </div>

      {/* Divider */}
      <div className="w-full h-px bg-gray-500 my-4"></div>

      {/* Social Media Icons */}
      <div className="flex gap-4 justify-center">
        <a
          href="#"
          className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center"
          aria-label="Facebook"
        >
          <img
            className="w-[38.44px] h-[38.44px]"
            alt="facebook"
            src="/figmaAssets/facebook.svg"
            />
        </a>
        
        <a
          href="#"
          className="w-12 h-12 rounded-full flex items-center justify-center"
          aria-label="Twitter/X"
        >
          <img
            className="w-[48px] h-[48px]"
            alt="facebook"
            src="/figmaAssets/x.svg"
            />
        </a>
        
        <a
          href="#"
          className="w-12 h-12 rounded-full flex items-center justify-center"
          aria-label="Instagram"
        >
          <img
            className="w-[38.44px] h-[38.44px]"
            alt="Instagram"
            src="/figmaAssets/Instagram.svg"
            />
        </a>
        
        <a
          href="#"
          className="w-12 h-12 rounded-full flex items-center justify-center"
          aria-label="LinkedIn"
        >
          <img
            className="w-[48px] h-[48px]"
            alt="LinkedIn"
            src="/figmaAssets/Linkedin.svg"
            />
        </a>
      </div>
    </div>
  );
}