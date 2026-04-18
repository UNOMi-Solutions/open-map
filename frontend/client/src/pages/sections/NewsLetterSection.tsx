import React, { useState } from 'react';
import PrivacyPolicyModal from './PrivacySection';
import TermsOfUseModal from './TermsofUse';
import PricingCards from './PricingCards';
import ContactUsform from './ContactUsform';

export const NewsLetterSection=(): JSX.Element => {
 const [email, setEmail] = useState('');
 const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
 const [isTermsOpen, setIsTermsOpen] = useState(false);
 const [isPricingOpen, setIsPricingOpen] = useState(false);
 const [isContactOpen, setIsContactOpen] = useState(false);


  const handleSubmit = () => {
    if (email) {
      console.log('Email submitted:', email);
      // Handle newsletter subscription logic here
      setEmail('');
    }
  };
  // Privacy handler
  const handlePrivacyClick = () => {
    setIsPrivacyOpen(true);
  };
  // Terms of Use handler
  const handleTermsClick = () => {
    setIsTermsOpen(true);
  };
  // Pricing handler
  const handlePricingClick = () => {
    setIsPricingOpen(true);
  };
  // Contact Us handler
  const handleContactClick = () => {
    setIsContactOpen(true);
  };
  

  return (
    <>
    <section className="bg-gray-200 py-12 px-4 pb-40">
      <div className="max-w-7xl mx-auto">
        <div 
          className="flex items-center justify-between"
          style={{
            minHeight: '239.32px',
            paddingLeft: '126px',
            paddingRight: '126px'
          }}
        >
          {/* Newsletter Section */}
          <div className="flex-shrink-0">
            <h2 className="text-sm font-semibold text-gray-600 mb-2 tracking-wide">
              GET OUR WEEKLY
            </h2>
            <h1 className="text-3xl font-bold text-orange-500 mb-4">
              NEWSLETTER
            </h1>
            <p className="text-gray-700 mb-6 text-sm leading-relaxed max-w-sm">
              Get weekly updates on the newest US data sent right in your mailbox.
              <br />
              Subscribe now!
            </p>
            
            <div className="flex max-w-md">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email Address"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-gray-700"
              />
              <button
                onClick={handleSubmit}
                className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-r-md font-semibold text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              >
                SUBSCRIBE
              </button>
            </div>
          </div>

          {/* Vertical Divider */}
          <div 
          className="border-t border-black"
          style={{
                  width: '248px',
                  height: '0px',
                  transform: 'rotate(-90deg)',
                  opacity: 1,
                  borderWidth: '1px'
          }     }
            ></div>

          {/* Social Media Icons */}
          <div 
            className="flex flex-shrink-0"
            style={{
              width: '426px',
              height: '48px',
              opacity: 1,
              gap: '78px'
            }}
          >
            <a
              href="#"
              className="flex items-center justify-center"
              aria-label="Facebook"
            >
              <img
            className="w-[48px] h-[48px]"
            alt="facebook"
            src="/figmaAssets/facebook.svg"
            />
            </a>
            
            <a
              href="#"
              className="flex items-center justify-center"
              aria-label="Twitter/X"
            >
              <img
            className="w-[48px] h-[48px]"
            alt="x"
            src="/figmaAssets/x.svg"
            />
            </a>
            
            <a
              href="#"
              className="flex items-center justify-center"
              aria-label="Instagram"
            >
              <img
            className="w-[48px] h-[48px]"
            alt="Instagram"
            src="/figmaAssets/Instagram.svg"
            />
              
            </a>
            
            <a
              href="#"
              className="flex items-center justify-center"
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
      </div>
    </section>
  
    <footer 
        className="bg-gray-900 flex items-center justify-center"
        style={{
          width: '1728px',
          height: '66px',
          opacity: 1
        }}
      >
        <div 
          className="flex items-center justify-between text-white text-sm"
          style={{
            width: '802px',
            height: '17px',
            opacity: 1
          }}
        >
          <div className="flex items-center space-x-8">
          <button 
         onClick={handlePricingClick}
        className="text-white hover:text-gray-300 transition-colors duration-200 bg-transparent border-none cursor-pointer"
  >
    Plans
  </button>
        
  <button 
    onClick={handleContactClick}
    className="text-white hover:text-gray-300 transition-colors duration-200 bg-transparent border-none cursor-pointer"
  >
    Contact
  </button>
            <button 
              onClick={handlePrivacyClick}
              className="text-white hover:text-gray-300 transition-colors duration-200 bg-transparent border-none cursor-pointer"
            >
              Privacy
            </button>
            <button 
            onClick={handleTermsClick}
            className="text-white hover:text-gray-300 transition-colors duration-200 bg-transparent border-none cursor-pointer"
      >
          Terms of Use
          </button>
          </div>
          
          <div className="text-gray-400">
            Copyright ©2025 OpenMap All rights reserved
          </div>
        </div>
      </footer>
      {/* ADD THE PRIVACY POLICY MODAL */}
      {isPrivacyOpen && (
        <PrivacyPolicyModal 
          isOpen={isPrivacyOpen}
          onClose={() => setIsPrivacyOpen(false)}
        />
      )}
      {/* Terms of Use*/}
      {isTermsOpen && (
      <TermsOfUseModal 
        isOpen={isTermsOpen}
        onClose={() => setIsTermsOpen(false)}
        />
      )}
      {/* Plans*/}
      {isPricingOpen && (
      <PricingCards 
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
      />
    )}
    {/* Contact us*/}
{isContactOpen && (
  <ContactUsform 
    isOpen={isContactOpen}
    onClose={() => setIsContactOpen(false)}
  />
)}
    </>
  );
}