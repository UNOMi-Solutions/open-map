import React from 'react';
import { X } from 'lucide-react';

interface AboutUsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AboutUsModal: React.FC<AboutUsModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#0E193A] flex items-center justify-center z-50">
        <div 
    className="absolute inset-0 opacity-24"
    style={{
      width: '100%',
      height: '100%',
    }}
  >
    <img
      className="w-full h-full object-contain select-none"
      alt="United States map"
      src="/figmaAssets/united-states.png"
      draggable={false}
    />
  </div>
      <div 
        className="bg-[#06012A] text-white relative overflow-y-auto w-[90vw] max-w-[1108px] h-auto max-h-[80vh] rounded-[64px] shadow-2xl translate-y-[-40px]"
      >
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors z-10"
        >
          <X size={28} />
        </button>

        {/* Content */}
        <div className="p-12 pt-16">
          {/* Header */}
          <h1 className="text-[18px] font-Inter font-bold text-center mb-8 leading-[100%]">About Us</h1>

          {/* Content paragraphs */}
          <div className="space-y-6 font-Inter text-white leading-[100%]">
            <p className="text-[18px] font-normal leading-[100%]">
              At OpenMap, we believe information should empower, not overwhelm. We're building a platform 
              that transforms vast, scattered data into clear, interactive maps, helping you see the story behind 
              the numbers.
            </p>

            <p className="text-[18px] font-normal leading-[100%]">
              From environmental hazards and social demographics to wealth distribution and historical trends, 
              OpenMap visualizes diverse datasets across the United States, making it easy for anyone, 
              researchers, journalists, businesses, or curious individuals, to explore and understand complex 
              realities with a single glance.
            </p>

            <p className="text-[18px] font-normal leading-[100%]">
              Our mission is simple: shine a light on the hidden patterns shaping our world. Whether you're 
              investigating community risks, studying urban development, or uncovering untold histories, 
              OpenMap gives you the tools to explore, compare, and share insights like never before. 
              Transparency, accessibility, and truth guide everything we do. Join us as we map the facts that 
              matter.
            </p>

            <p className="text-[18px] font-normal leading-[100%]">
              OpenMap, Where Data Meets Clarity.
            </p>
          </div>
        </div>
      {/*</div>*/}
    </div>
    </div>
  );
};

export default AboutUsModal;