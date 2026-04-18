import React from 'react';
import { X } from 'lucide-react';

const TermsOfUseModal = ({ isOpen, onClose }) => {
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
        className="bg-[#06012A] text-white relative"
        style={{
          width: '1277px',
          height: '90vh',
          maxHeight: '900px',
          top: '87px',
          left: '97px',
          borderRadius: '64px',
          position: 'absolute',
          opacity: 1,
          overflow: 'hidden'
        }}
      >
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white hover:text-gray-300 transition-colors z-20"
        >
          <X size={28} />
        </button>

        {/* Scrollable content container */}
        <div 
          className="absolute inset-0 overflow-y-auto"
          style={{
            padding: '64px 64px 32px 64px'
          }}
        >
          {/* Content */}
          <div className="font-inter pt-8">
            {/* Header */}
            <h1 className="text-[18px] font-normal text-Bold text-center mb-12 leading-[100%]">Terms of Use</h1>

            {/* Content sections */}
            <div className="space-y-8 text-[18px] font-normal leading-[100%]">
              
              {/* Section 1: Agreement */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">1. ALL PERSONS ACCESSING AND/OR USING THIS SITE AGREE TO THE FOLLOWING TERMS AND CONDITIONS.</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    1.1. Ownership and Usage Restrictions. All rights, including copyrights, to this Site and its contents are owned by Pixel Pirate Studio LLC (hereinafter referred to as “Pixel Pirate Studio”) or third parties who have licensed such rights to Pixel Pirate Studio. The contents of this Site may not be copied, republished, distributed, altered or used for any purpose except as explicitly set forth in this Site or approved in writing by Pixel Pirate Studio.

                  </p>
                  <p className="text-[18px] font-normal leading-[100%]">
                    1.2. Pixel Pirate Studio LLC (“PIXEL PIRATE STUDIO”)is an Emmy Nominated production studio that focuses on fun filled brands (the “Service“). The Pixel Pirate Studio website (the “Site“) is comprised of various web pages operated by us, and includes any mobile phone applications (the “Application”). The Site and any Application is offered to you conditioned on your acceptance of our Privacy Policy.
                    </p>
                  <p className="text-[18px] font-normal leading-[100%]">
                    1.3. Informational Purposes Only. The materials available on this Site have been prepared by Pixel Pirate Studio and are intended for informational purposes ONLY. The information provided on this Site is provided only as general information and does not create a business or professional services relationship between you and Pixel Pirate Studio.
                  </p>
                  <p className="text-[18px] font-normal leading-[100%]">
                    1.4. Submitted Information. The Pixel Pirate Studio Site is free to use and exploit in any legal manner and for any legal purpose any information sent to this Site by any person accessing and/or using this Site. Please refer to the Privacy Policy section of this Site for further details on the collection and use of Site user information.
                  </p>
                </div>
              </div>

              {/* Section 2: Third Party Links */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">2. THIRD PARTY LINKS</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    2.1. We may include links to related internet sites maintained by third parties. Neither Pixel Pirate Studio nor its affiliates or subsidiaries operate or control, in any respect, any information, products or services on such linked sites. In addition,Pixel Pirate Studio does not guarantee the timeliness, sequence, accuracy, completeness, reliability, or content of such information.
                  </p>
                </div>
              </div>

              {/* Section 3: Conditions of Use */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">3. CONDITIONS OF USE</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    3.1. You agree that it shall only use the Site for legal purposes. You are solely responsible for complying with the laws of the jurisdiction from which you are accessing this Site and you agree that you will not access or use the information on this Site in violation of such law.You represent that you have the lawful right to submit such information and you agree that you will not submit any information through the use of this Site unless you are legally entitled to do so.  Again, we recommend that you do not submit information you consider confidential. Without limiting the foregoing, you may not and shall NOT:
                  </p>
                  <div className="pl-4 space-y-2">
                    <p className="text-[18px] font-normal leading-[100%]">(a) engage in any conduct that is unlawful, immoral, threatening, abusive or in a way that is deemed unreasonable by Pixel Pirate Studio in its discretion.</p>
                    <p className="text-[18px] font-normal leading-[100%]">(b) infringe our intellectual property rights or those of any third party in relation to your use of the Service;</p>
                    <p className="text-[18px] font-normal leading-[100%]">(c) transmit any material that is confidential or proprietary;</p>
                    <p className="text-[18px] font-normal leading-[100%]">(d) use the Service in a way that could damage, disable, overburden, impair or compromise our systems or security or interfere with other users;</p>
                    <p className="text-[18px] font-normal leading-[100%]">(e) collect or harvest any information or data from the Service or attempt to decipher any transmissions to or from the servers running any Service;</p>
                    <p className="text-[18px] font-normal leading-[100%]">(f) access the Service in order to build a similar or competitive product or service or copy any ideas, features, functions, or graphics of the Service;</p>
                    <p className="text-[18px] font-normal leading-[100%]">(g) use the Service in any manner that may harm minors or that interacts with or targets minors;</p>
                    <p className="text-[18px] font-normal leading-[100%]">(h) send unsolicited communications, promotions or advertisements, or spam;</p>
                    <p className="text-[18px] font-normal leading-[100%]">(i) send altered, deceptive or false source-identifying information, including "spoofing" or "phishing";</p>
                    <p className="text-[18px] font-normal leading-[100%]">(j) sublicense, resell, time share or similarly exploit the Services;</p>
                    <p className="text-[18px] font-normal leading-[100%]">(k) authorize, permit, enable, induce or encourage any third party to do any of the above.</p>
                  </div>
                  <p className="text-[18px] font-normal leading-[100%]">
                    3.2. You agree that you will not engage in any activity that interferes with or disrupts the Site. You further agree that you will not crawl, scrape, reproduce, duplicate, copy, sell, trade or resell any part of the Site or the Application for any purpose.
                  </p>
                </div>
              </div>

              {/* Section 4: Intellectual Property */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">4. INTELLECTUAL PROPERTY</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    4.1. User acknowledges that Pixel Pirate Studio retains ownership of all Intellectual Property of Pixel Pirate Studio incorporated in the Site and Service (including all improvements, enhancements, updates and corrections) and any Intellectual Property generated by Pixel Pirate Studio in the process of providing the Service.
                  </p>
                  <p className="text-[18px] font-normal leading-[100%]">
                    4.2. The User agrees and accepts that any Intellectual Property generated by the user in connection with the user's use of the Site, Application or Service is owned absolutely by Pixel Pirate Studio and vests in Pixel Pirate Studio immediately, including:
                  </p>
                  <div className="pl-4 space-y-2">
                    <p className="text-[18px] font-normal leading-[100%]">(a) Pixel Pirate Studio name, trade marks, logo and design; and</p>
                    <p className="text-[18px] font-normal leading-[100%]">(b) any text, images, graphics, source code, usage data, ideas, enhancements, feature requests, suggestions or other information provided by the User or any other party with respect to the Service.</p>
                  </div>
                </div>
              </div>

              {/* Section 5: Advertising */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">5. ADVERTISING</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    5.1. Some of our Services may be supported by advertising revenue and may display advertisements and promotions. You agree that we may place such advertising and promotions on the Site or Application, or on, about, or in conjunction with any content provided by the User. The manner, mode, and extent of such advertising and promotions are subject to change without specific notice to you.
                  </p>
                </div>
              </div>

              {/* Section 6: Disclaimer */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">6. DISCLAIMER</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    6.1. All content and information on this Site is subject to change without notice. This Site may contain links to other websites. Pixel Pirate Studio makes no representation or warranty and disclaims any responsibility or liability with respect to such third-party websites and their content.
                  </p>
                  <p className="text-[18px] font-normal leading-[100%]">
                    6.2. ALL CONTENT AND INFORMATION ON THIS SITE IS PROVIDED "AS IS," WITH NO WARRANTIES WHATSOEVER, EITHER EXPRESS OR IMPLIED.STORYLINES AND ITS AFFILIATES, AND ITS AND THEIR THIRD-PARTY LICENSORS, EXPRESSLY DISCLAIM TO THE FULLEST EXTENT PERMITTED BY LAW ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, STATUTORY OR OTHERWISE, INCLUDING, WITHOUT LIMITATION, THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT OF PROPRIETARY RIGHTS. PIXEL PIRATE STUDIO AND ITS AFFILIATES, AND ITS AND THEIR THIRD-PARTY LICENSORS, DISCLAIM ANY WARRANTIES REGARDING THE SECURITY, RELIABILITY, TIMELINESS, AND PERFORMANCE OF THE APPLICATION, AND ALL MATERIALS, INFORMATION, ADVICE, JOB LISTINGS, USER CONTENT, PRODUCTS AND SERVICES AVAILABLE ON OR THROUGH THE APPLICATION. STORYLINES AND ITS AFFILIATES, AND ITS AND THEIR THIRD-PARTY LICENSORS, DISCLAIM ANY WARRANTIES FOR SERVICES OR GOODS RECEIVED THROUGH OR ADVERTISED ON THE SITE OR APPLICATION OR RECEIVED THROUGH ANY LINKS MADE AVAILABLE BY PIXEL PIRATE STUDIO.

                  </p>
                </div>
              </div>

              {/* Section 7: Infringement Claims */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">7. INFRINGEMENT CLAIMS</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    7.1. U.S. Copyright Infringement. The Digital Millennium Copyright Act of 1998 (the "DMCA") provides recourse for copyright owners who believe that material appearing on the Internet infringes their rights under U.S. copyright law. If you believe in good faith that materials hosted by this Site infringe your copyright, you may send us a notice requesting that the material be removed, or access to it blocked.The notice must include the following information as required by 17 USC. § 512(c)(3)(A): (a) a physical or electronic signature of a person authorized to act on behalf of the owner of an exclusive right that is allegedly infringed; (b) identification of the copyrighted work claimed to have been infringed (or if multiple copyrighted works located on the Application are covered by a single notification, a representative list of such works); (c) identification of the material that is claimed to be infringing or the subject of infringing activity, and information reasonably sufficient to allow Pixel Pirate Studio to locate the material on the Site; (d) the name, address, telephone number, and email address (if available) of the complaining party; (e) a statement that the complaining party has a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law; and (f) a statement that the information in the notification is accurate, and under penalty of perjury, that the complaining party is authorized to act on behalf of the owner of an exclusive right that is allegedly infringed. If you believe in good faith that a notice of copyright infringement has been wrongly filed against you, the DMCA permits you to send Pixel Pirate Studio a counter-notice. Notices and counter-notices must meet the then-current statutory requirements imposed by the DMCA; see http://www.loc.gov/copyright/ for details. We suggest that you consult your legal advisor before filing a notice or counter-notice. Also, be aware that there are penalties for false claims under the DMCA.

                  </p>
                </div>
              </div>

              {/* Section 8: Notices */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">8. NOTICES</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    8.1. The User can direct notices, enquiries, complaints and so forth to OpenMap at this address: contact@pixelpiratestudio.com
                  </p>
                  <p className="text-[18px] font-normal leading-[100%]">
                    8.2. A consent, notice or communication under this Agreement is effective if it is sent as an electronic communication unless required to be physically delivered under law.
                  </p>
                </div>
              </div>

              {/* Section 9: Modifications */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">9. MODIFICATIONS</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    9.1. As our business evolves, we may change these Terms or the Privacy Policy. If we make any material changes to the Terms or the Privacy Policy, we will provide you with reasonable notice prior to the change taking effect either by emailing the email address associated with your account or by posting a notice on our Site.You can review the most current version of the Terms at any time by visiting this page. Any material revisions to these Terms will become effective on the date set forth in our notice, and all other changes will become effective on the date we publish the change. If you use the Site or service after the effective date of any changes, that use will constitute your acceptance of the revised terms and conditions.

                  </p>
                </div>
              </div>

              {/* Section 10: Choice of Law */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">10. CHOICE OF LAW / JURISDICTION</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    10.1. Owner maintains this site in Delaware, U.S.A. and you agree that these terms of use and any legal action or proceeding relating to this Site shall be governed by the laws of the State of Delaware without reference to its choice of law rules.As you have agreed by using this site to choose the laws of the State of Delaware to govern any such proceedings, Owner may elect to defend any such action in Delaware, without regard to where in the world you are located, or from where in the world you visited this Site.

                  </p>
                </div>
              </div>

              {/* Section 11: General */}
              <div className="space-y-4">
                <h2 className="text-[18px] font-normal leading-[100%] mb-4">11. GENERAL</h2>
                <div className="space-y-3 pl-4">
                  <p className="text-[18px] font-normal leading-[100%]">
                    11.1. No failure or delay by either party in exercising any right under the Terms, will constitute a waiver of that right. No waiver under the Terms will be effective unless made in writing and signed by an authorized representative of the party being deemed to have granted the waiver. Each party acknowledges that it has not relied on any representation, warranty or statement made by any other party, other than as set out in this Agreement. The relationship of the parties to this Agreement does not form a joint venture or partnership. No clause of this Agreement will be deemed waived and no breach excused unless such waiver or consent is provided in writing. Each party must do anything necessary (including executing agreements and documents) to give full effect to this Agreement and the transaction facilitated by it. Any clause of this Agreement, which is invalid or unenforceable is ineffective to the extent of the invalidity or unenforceability without affecting the remaining clauses of this Agreement. The Terms, including any terms incorporated by reference into the Terms, constitute the entire agreement between you and us and supersede all prior and contemporaneous agreements, proposals or representations, written or oral, concerning its subject matter. To the extent of any conflict or inconsistency between the provisions in these Terms and any pages referenced in these Terms, these Terms will prevail.

                  </p>
                </div>
              </div>

              {/* Last Updated */}
              <div className="space-y-4 pt-8">
                <p className="text-[18px] font-normal leading-[100%] text-center">
                  These Terms were last updated on May 7,2020
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfUseModal;