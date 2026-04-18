import React from 'react';
import { X } from 'lucide-react';


const PrivacyPolicyModal = ({ isOpen, onClose }) => {
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
        className="bg-[#06012A] text-white relative overflow-y-auto"
        style={{
          width: '1277px',
          height: '90vh',
          maxHeight:'900px',
          top: '87px',
          left: '97px',
          borderRadius: '64px',
          position: 'absolute',
          opacity: 1,
          //overflow: 'hidden'
        }}
      >
        {/* Scrollable content container */}
        <div 
          className="absolute inset-0 overflow-y-auto"
          style={{
            padding: '64px 64px 32px 64px'
          }}
        >

        
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white transition-colors z-20"
        >
          <X size={22} />
        </button>
      
        {/* Content */}
        <div className="p-16 pt-20 font-inter">
          {/* Header */}
          <h1 className="text-[18px] font-bold font-inter text-center mb-12 leading-[100%]">Privacy Policy</h1>

          {/* Content sections */}
          <div className="space-y-8 text-[18px] font-normal leading-[100%]">
            
            {/* Section 1: Introduction */}
            <div className="space-y-4">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">1. INTRODUCTION</h2>
              <div className="space-y-3 pl-4">
                <p className="text-[18px] font-normal leading-[100%]">
                  (a) Maintaining the privacy of your information is of paramount importance to us. Privacy helps foster confidence, goodwill and stronger relationships with you, our customers. If, at any time, you have questions or concerns about our privacy practices, please feel free contact us at contact@openmap.com
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  (b) OpenMap ("OPENMAP") is a data visualization platform that focuses on transforming complex data into clear, interactive maps (the "Service"). The OpenMap website (the "Site") is comprised of various web pages operated by us, and includes any mobile phone applications (the "Application"). The Site and any Application is offered to you conditioned on your acceptance of our Privacy Policy.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  (c) The Privacy Policy goes hand-in-hand with our Terms of Use, which govern all use of the Service and can be found at: https://openmap.com/. Please read them together.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  (d) THE SERVICE MAY COLLECT INFORMATION THAT PERSONALLY IDENTIFIES YOU ("PERSONALLY IDENTIFIABLE INFORMATION" AND/OR "PERSONAL INFORMATION") AS DEFINED IN THE CODE OF FEDERAL REGULATIONS (2 CFR 200.79). "Personal Information" includes (but is not limited to) the following categories of information: (1) contact data (such as your e-mail address and phone number); (2) demographic data (such as your gender, your date of birth and your zip code); (3) any health information you choose to share with us; and (4) other identifying information that you voluntarily choose to provide to us.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  (e) OpenMap is the responsible party or data controller regarding Personal Information collected through our Service. If you have any questions or concerns at any time about your data, privacy, or our terms of use, please email us at contact@openmap.com.
                </p>
              </div>
            </div>

            {/* Section 2: Privacy Statement */}
            <div className="space-y-4">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">2. PRIVACY STATEMENT</h2>
              <div className="space-y-3 pl-4">
                <p className="text-[18px] font-normal leading-[100%]">
                  2.1. This Privacy Policy explains how we collect, use, maintain and disclose your Information. This includes information that could be used to identify a specific user ("Personal Information"), and other information that does not constitute Personal Information ("Non-Personal Information") that is collected from you while using our Service. We take the privacy of your Personal Information seriously.
                </p>
              </div>
            </div>

            {/* Section 3: Consent */}
            <div className="space-y-4">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">3. CONSENT</h2>
              <div className="space-y-3 pl-4">
                <p className="text-[18px] font-normal leading-[100%]">
                  3.1. When you use our Service or allow someone to use our Service on your behalf, you consent to our collection, use, disclosure, transfer and storage/retention of any the Personal and Non-Personal Information or other information received by us as a result of your use, all in accordance with this Privacy Policy.
                </p>
              </div>
            </div>

            {/* Section 4: Data Controller */}
            <div className="space-y-4">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">4. DATA CONTROLLER</h2>
              <div className="space-y-3 pl-4">
                <p className="text-[18px] font-normal leading-[100%]">
                  4.1. Data protection laws and privacy laws in certain jurisdictions, like the European Economic Area (EEA), differentiate between "controllers" and "processors" of personal information. A controller decides why and how to process personal information.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  4.2. A processor processes personal information on behalf of a controller based on the controller's instructions. When OpenMap processes your Personal Information, we act as a controller.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  4.3. Broadly speaking, we use your information to further our legitimate interests to:</p> 
                  <p className="text-[18px] font-normal leading-[100%]">
                     (a) understand who our customers and potential customers are and their interests in our product and services, 
                     </p>
                     <p className="text-[18px] font-normal leading-[100%]">
                     (b) manage our relationship with you and other customers, </p>
                     <p className="text-[18px] font-normal leading-[100%]">
                      (c) carry out core business operations such as accounting, filing taxes, and fulfilling regulatory obligations and </p>
                      <p className="text-[18px] font-normal leading-[100%]">(d) help detect, prevent, or investigate security incidents, fraud and other abuse.</p>
                
              </div>
            </div>

            {/* Section 5: Children */}
            <div className="space-y-4">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">5. A NOTE ABOUT CHILDREN</h2>
              <div className="space-y-3 pl-4">
                <p className="text-[18px] font-normal leading-[100%]">
                  5.1. If you are under the age of 13, you may not use the Service. Parents or legal guardians of children under age 13 cannot consent to these terms on their behalf. We do not knowingly collect Personal Information from children under the age of 13. If you have reason to believe that a child under the age of 13 has used our Service and provided Personal Information to us, please contact us, and we will work to delete that information from our databases.
                </p>
              </div>
            </div>

            {/* Section 6: Information We Collect */}
            <div className="space-y-4">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">6. THE INFORMATION WE COLLECT</h2>
              <div className="space-y-3 pl-4">
                <p className="text-[18px] font-normal leading-[100%]">
                  6.1. In the course of business it may be necessary for us to collect Personal and Non-Personal Information. This information allows us to identify who an individual is for the purposes of our business, contact the individual in the ordinary course of business and transact with the individual. We require this information in order to verify the identity of our users, to protect our customers, and to ensure the integrity of the Service.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  6.2. We will collect Personal Information from you only if you, or an authorized individual, whom you have authorized to share data about you voluntarily submit such information to us. You can refuse to supply Personal Information, except that it may prevent you from engaging in certain Site related activities or accessing parts of the Service.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  6.3. Without limitation, the types of information we may collect are:</p>
                  <p className="text-[18px] font-normal leading-[100%]">(a) Aggregated Data. So that we can continually improve our Service, we often conduct research on user demographics, interests, and behavior. This is based on Personal and Non-Personal Information and other information that we have collected, and may be compiled and analyzed on an aggregate basis. Since this aggregate information does not identify you personally, it is considered and treated as Non-Personal Information under this Privacy Policy;</p>
                  <p className="text-[18px] font-normal leading-[100%]">(b) Communications, Video and Workflow. We may collect information about a user’s habits, activity and communications when the user uses the Service. This includes, without limitation, messages and communications within the platform between users.</p>
                  <p className="text-[18px] font-normal leading-[100%]"> (c) Contact Information. We may collect information like your email address, telephone, and other information that allows us to contact you and is also considered Personal Information under California Law;</p>
                  <p className="text-[18px] font-normal leading-[100%]">(d) Financial Information. We may collect financial information related to an individual such as any bank or credit card details used to transact with us and other information that allows us to transact with the individual and/or provide them with our Service;</p>
                  <p className="text-[18px] font-normal leading-[100%]">(e) Personal Information. We may collect personal details such as your name, location, and other information defined as “Personal Information” that allows us to identify who you are. We may utilize this information in order to adapt our Service to users’ needs or to develop new tools for the community;</p>
                  <p className="text-[18px] font-normal leading-[100%]">(f) Social Media Information. We may collect twitter, Facebook or other social media usernames if you connect to these social networks through the Service or for identity verification purposes;</p>
                  <p className="text-[18px] font-normal leading-[100%]"> (g) Statistical Information. We may collect information about an individual’s online and offline preferences, habits, movements, trends, decisions, associations, memberships, finances, purchases and other information for statistical purposes;</p>
                  <p className="text-[18px] font-normal leading-[100%]"> (h) Other Information. We may collect other Personal Information about you, which we will maintain according to this Privacy Policy. We may also collect non-Personally Identifiable Information about you such as information about your network, device, or operating system. Finally, we may collect any personal correspondence that you send us, or that is sent to us by others about an individual’s activities.</p>
                </div>
            </div>

            {/* Section 7: How Information is Collected */}
            <div className="space-y-4">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">7. HOW INFORMATION IS COLLECTED</h2>
              <div className="space-y-3 pl-4">
                <p className="text-[18px] font-normal leading-[100%]">
                  7.1. Most information is collected in association with your use of the Service. In particular, information is likely to be collected as follows:</p>
                  <p className="text-[18px] font-normal leading-[100%]"> (a) Account. When you open an account (the “Account”) on the application and submit your personal details, or when you enter Personal Information details through another process in order to receive or access something.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(b) Contact. When you contact us in any way.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(c) Cookies & Similar Technologies. When you use the Application, we may use cookies and similar technologies like pixels, web beacons, and local storage to collect information about how you use our Service, and to provide features to you. We use cookies to make your use of our website and Service as convenient as possible. Cookies are useful to estimate our number of visitors and to determine overall traffic patterns through our website. If you do not wish to receive any cookies you may set your Mobile browser to refuse cookies. This may mean you will not be able to take full advantage of the Service.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(d) Flash LSOs. When we post videos, third parties may use local shared objects, known as “Flash Cookies,” to store your preferences for volume control or to personalize certain video features. Flash Cookies are different from browser Cookies because of the amount and type of data and how the data is stored. Cookie management tools provided by your browser will not remove Flash Cookies.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(e) Google Analytics. We may use Google Analytics to help analyze how users use the Site. Google Analytics uses Cookies to collect information such as how often users visit the Site, what pages they visit, and what other sites they used prior to coming to the Site. We use the information we get from Google Analytics only to improve our Site and Service. Google Analytics collects only the IP address assigned to you on the date you visit the Site, rather than your name or other personally identifying information. We do not combine the information generated through the use of Google Analytics with your Personal Information. Although Google Analytics plants a persistent Cookie on your web browser to identify you as a unique user the next time you visit the Site, the Cookie cannot be used by anyone but Google. Google’s ability to use and share information collected by Google Analytics about your visits to the Site is restricted by the Google Analytics Terms of Use and the Google Privacy Policy.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(f) Log files. As is true of most websites, we gather certain information automatically and store it in log files. This information includes IP addresses, browser type, Internet service provider (“ISP”), referring/exit pages, operating system, date/time stamp, and clickstream data. We use this information to analyze trends, administer the Site, track users’ movements around the Site, gather demographic information about our user base as a whole, and better tailor our Service to our users’ needs. For example, some of the information may be collected so that when you visit the Site or the Service again, it will recognize you and the information could then be used to serve advertisements and other information appropriate to your interests. Except as noted in this Privacy Policy, we do not link this automatically-collected data to Personal Information.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(g) Marketing and Web Surveys. From time to time, we may conduct online research surveys through email invitations, pop-up surveys and online focus groups. When participating in a survey, we may ask you to enter Personal Information. The Personal Information you submit in a survey may be used by us for research and measurement purposes, as described below, including to measure the effectiveness of content, advertising or programs. When our market research surveys collect Personal Information we will not knowingly accept participants who are under the age of 13.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(h) Payment. When an individual submits their details to open a payment account or make a payment.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(i) Public Forums. Pixel Pirate Studio may feature public forums where users with similar issues, interests, or conditions can share information and support one another or where users can post questions for experts to answer. Our forums are open to the public and should not be considered private. Any information (including Personal Information) you share in any online forum is by design open to the public and is not private. You should think carefully before posting any Personal Information in any public forum. What you post can be seen, disclosed to or collected by third parties and may be used by others in ways we cannot control or predict, including to contact you for unauthorized purposes. As with any public forum on any site, the information you post may also show up in third-party search engines. If you mistakenly post Personal Information in our Public Forums and would like it removed, you can send us an email to request that we remove it by using the Contact Us link. In some cases, we may not be able to remove your Personal Information.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(j) Uploads. When you upload or generate user content, such as photos, videos, text, comments, using our Service.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(k) Social Media Features. Our Site may include social media features, such as the Facebook Like button. These features may collect your IP address and which page you are visiting on our Site, and may set a cookie to enable the feature to function properly. Social media features are either hosted by a third party or hosted directly on our Site. Your interactions with these features are governed by the privacy policy of the company providing them.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(l) Phishing. It has become increasingly common for unauthorized individuals to send e-mail messages to consumers, purporting to represent a legitimate company such as a bank or on-line merchant, requesting that the consumer provide personal, often sensitive information. Sometimes, the domain name of the e-mail address from which the e-mail appears to have been sent, and the domain name of the web site requesting such information, appears to be the domain name of a legitimate, trusted company. In reality, such sensitive information is received by an unauthorized individual to be used for purposes of identity theft. This illegal activity is known as “phishing”. If you receive an e-mail or other correspondence requesting that you provide any sensitive information (including your password or credit card information) via e-mail or to a Web site that does not seem to be affiliated with us, or that otherwise seems suspicious to you, please do not provide such information, and report such request to us at contact@pixelpiratestudio.com.</p>
                  <p className="text-[18px] font-normal leading-[100%]">(m) Third Party Links. Our Services may contain links to third party websites. The fact that we link to a website is not an endorsement, authorization or representation of our affiliation with that third party. We do not exercise control over third party websites. These other websites may place their own cookies or other files on your computer, collect data or solicit personally identifiable information from you. If you submit personal information to any of those sites, your information is governed by their privacy policies. Other sites follow different rules regarding the use or disclosure of the personally identifiable information you submit to them. We encourage you to read the privacy policies or statements of the other websites you visit. This Privacy Policy does not apply to information collected on external websites that may be linked to or through the Site.</p>

                <p className="text-[18px] font-normal leading-[100%]">
                  7.2. We understand that there are many circumstances in which we may collect information, and we work hard to ensure that you are always aware when your Personal Information is being collected.
                </p>
              </div>
            </div>

            {/* Section 8: Security */}
            <div className="space-y-4">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">8. THE SAFETY & SECURITY OF PERSONAL INFORMATION</h2>
              <div className="space-y-3 pl-4">
                <p className="text-[18px] font-normal leading-[100%]">
                  8.1.Data Hosting. We are committed to protecting the security of your Personal Information. We use a variety of industry-standard security technologies and procedures to help protect your Personal Information from unauthorized access, use, or disclosure.We also require you to enter a password to access your Account information. Please do not disclose your Account password to unauthorized people. No method of transmission over the Internet, or method of electronic storage, is 100% secure, however. Therefore, while we use reasonable efforts to protect your Personal Information, we cannot guarantee its absolute security.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  8.2.Third Party Use. We are not responsible for the privacy or security practices of any third party; this includes third parties to whom we are permitted to disclose your Personal Information in accordance with this policy or any applicable laws.  The collection and use of your information by these third parties may be subject to separate privacy and security policies.  We cannot control and are not responsible for the privacy and security of your Personal Information once it is provided to a third party by you or in accordance with your requests or directions.

                </p>
                <p className="text-[18px] font-normal leading-[100%]">8.3. Unauthorized Access. If you suspect any misuse, loss of, or unauthorized access to your Personal Information, you should let us know immediately at contact@pixelpiratestudio.com.</p>
                <p className="text-[18px] font-normal leading-[100%]">  8.4. Authorized Use. We are not liable for any loss, damage, or claim arising out of another person’s use of the Personal Information where we were authorized to provide that person with the Personal Information.
                </p> 
                <p className="text-[18px] font-normal leading-[100%]">8.5. Data Sent to Us.  From time to time, you may send Personal Information to us electronically.  The transmission of information via the Internet is not completely secure.  Therefore, we cannot guarantee the security of the data sent to us electronically and transmission of the data is entirely at your own risk.
                </p>

              </div>
            </div>

            {/* Section 9: When We Contact Users */}
            <div className="space-y-4">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">9. WHEN WE CONTACT USERS</h2>
              <div className="space-y-3 pl-4">
                <p className="text-[18px] font-normal leading-[100%]">
                  9.1 Service Announcements. On rare occasions it is necessary to send out a strictly Service related announcement. For instance, if our Service is temporarily suspended for maintenance we might send users an email. Generally, users may not opt-out of these communications, though they can deactivate their Account.However, these communications are not promotional in nature.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  9.2. Customer Service. We communicate with users on a regular basis to provide requested Service and in regards to issues relating to their Account.
                </p>
              </div>
            </div>

            {/* Section 10: When Information is Used */}
            <div className="space-y-4">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">10. WHEN PERSONAL INFORMATION IS USED & DISCLOSED</h2>
              <div className="space-y-3 pl-4">
                <p className="text-[18px] font-normal leading-[100%]">
                  10.1. Time Period. We may retain your Data as long as you continue to use our Service. You may close your Account by contacting us, but we may retain Personal or Non-Personal Information for an additional period as is permitted or required under applicable laws. Even after we delete your Personal Information, it may persist on backup or archival media for an additional period of time.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">
                  10.2.Agents, Consultants, and Trusted Third Parties. Like many businesses, we sometimes have companies perform certain business-related functions for us. These companies include our marketing agencies, database service providers, backup and disaster recovery service providers, email service providers, and others. When we engage another company, we may provide them with information including Personal Information, so they can perform their designated functions.  They are not permitted to use your Personal Information for other purposes.
                </p>
                <p className="text-[18px] font-normal leading-[100%]">10.3.Business Operations. Your information is used to operate our business. These business operations may include:
                </p>
                <div className="pl-4 space-y-2">
    <p className="text-[18px] font-normal leading-[100%]">
      (a) The provision of Service between you and us;
    </p>
    <p className="text-[18px] font-normal leading-[100%]">
      (b) Verifying your identity;
    </p>
    <div className="space-y-2">
      <p className="text-[18px] font-normal leading-[100%]">
        (c) Communicating with you about:
      </p>
      <div className="pl-4 space-y-1">
        <p className="text-[18px] font-normal leading-[100%]">
          i. Your relationship with us;
        </p>
        <p className="text-[18px] font-normal leading-[100%]">
          ii. Our goods and services;
        </p>
        <p className="text-[18px] font-normal leading-[100%]">
          iii. Our own marketing and promotions to users and prospects;
        </p>
        <p className="text-[18px] font-normal leading-[100%]">
          iv. Competitions, surveys and questionnaires.
        </p>
      </div>
    </div>
  </div>
              </div>
            </div>

            <p className="text-[18px] font-normal leading-[100%]">10.4. Corporate Restructuring. We may share some or all of your Personal Information in connection with or during negotiation of any merger, financing, acquisition or dissolution transaction or proceeding involving sale, transfer, divestiture, or disclosure of all or a portion of our business or assets. In the event of an insolvency, bankruptcy, or receivership, Personal Information may also be transferred as a business asset. If another company acquires our company, business, or assets, that company will possess the Personal Information collected by us and will assume the rights and obligations regarding your Personal Information as described in this Privacy Policy.</p>
            <p className="text-[18px] font-normal leading-[100%]">10.5. IP Address. We use your IP address to help diagnose problems with our server, and to administer our website. We do not link your IP address which accesses our website to any Personal Information. We use tracking information to determine which areas our Site users visit based on traffic to those areas. PIXEL PIRATE STUDIO does not track what individual users read, but rather how often each page is visited. This helps us maintain a superior and informative website for you.</p>
            <p className="text-[18px] font-normal leading-[100%]">10.6. Improve Customer Service. Information you provide helps us respond to your customer service requests and to support your needs more efficiently.</p>
            <p className="text-[18px] font-normal leading-[100%]">10.7. Payments. We may use the information users provide about themselves when placing an order only to provide Service to that order. We do not share this information with outside parties except to the extent necessary to provide the Service.</p>
            <p className="text-[18px] font-normal leading-[100%]">10.8. Personalize Your Experience. We may use information in the aggregate to understand how our users as a group use the Service.</p>
            <p className="text-[18px] font-normal leading-[100%]">10.9. Public Profile. Certain portions of the information you provide to us may also be displayed in your Profile. As an essential element of the Service, some of the Personal Information you explicitly provide to us when you register or update your Profile is displayed on your Profile. Once you have posted information publicly, while you will still be able to edit and delete it on the Site, you will not be able to edit or delete such information cached, collected, and stored elsewhere by others (e.g., search engines).</p>
            <p className="text-[18px] font-normal leading-[100%]">10.10. Site Improvement. We may use feedback you provide to improve our products and Service.</p>
            <p className="text-[18px] font-normal leading-[100%]">10.11. Social Networking Sites (SNSs). Our Service may enable you to post content to SNSs. If you choose to do this, we will provide information to such SNSs in accordance with your elections. You acknowledge and agree that you are solely responsible for your use of those websites and that it is your responsibility to review the terms of use and privacy policy of the third party provider of such SNSs. We will not be responsible or liable for: (i) the availability or accuracy of such SNSs; (ii) the content, products or services on or availability of such SNSs; or (iii) your use of any such SNSs.</p>
            <p className="text-[18px] font-normal leading-[100%]">10.12. User Testimonials and Feedback. We often receive testimonials and comments from users who have had positive experiences with our Service. We occasionally publish such content. When we publish this content, we may identify our users by their first and last name and may also indicate their home city. We obtain the user’s consent prior to posting his or her name along with the testimonial. In addition, we may post user feedback on the Site from time to time. We will share your feedback with your first name and last initial only. If we choose to post your first and last name along with your feedback, we will obtain your consent prior to posting your full name with your feedback. If you make any comments on a blog or forum associated with your Site, you should be aware that any Personal Information you submit there can be read, collected, or used by other users of these forums, and could be used to send you unsolicited messages. We are not responsible for the Personal Information you choose to submit in these blogs and forums.</p>
            <p className="text-[18px] font-normal leading-[100%]">10.13. Disclosure. There are a few circumstances where we must disclose an individual’s information:</p>
            <div className="pl-4 space-y-2">
    <p className="text-[18px] font-normal leading-[100%]">
      (a) Where we reasonably believe that an individual may be engaged in fraudulent, deceptive, or unlawful activity that a governmental authority should know about, or to enforce our Terms of Use and investigate potential violations of the Terms of Use;
    </p>
    <p className="text-[18px] font-normal leading-[100%]">
      (b) In response to lawful requests by public authorities, including to meet national security or law enforcement requirements;
    </p>
    <p className="text-[18px] font-normal leading-[100%]">
      (c) To protect our rights, property, or personal safety or those of another user or any member of the public;
    </p>
    <p className="text-[18px] font-normal leading-[100%]">
      (d) As required by any law;
    </p>
    <p className="text-[18px] font-normal leading-[100%]">
      (e) In the event we sell our business and may need to transfer Personal Information to a new owner; or
    </p>
    <p className="text-[18px] font-normal leading-[100%]">
      (f) In special cases, such as in response to a physical threat to you or others.
    </p>
    </div>
            <p className="text-[18px] font-normal leading-[100%]">11. YOUR CALIFORNIA PRIVACY RIGHTS</p>
            <p className="text-[18px] font-normal leading-[100%]">11.1 California Civil Code Section § 1798.83 permits users of our software and Service that are California residents to request certain information regarding our disclosure of personal information to third parties for their direct marketing purposes. We do not share any consumer personal information with third parties for marketing purposes without consent.  California users who wish to request further information about our compliance with this law or have questions or concerns about our privacy practices may send an e-mail to contact@pixelpiratestudio.com. Please be aware that when you ask us for these things, we will take steps to verify that you are authorized to make the request..</p>
            <p className="text-[18px] font-normal leading-[100%]">12. HOW TO UPDATE INFORMATION</p>
            <p className="text-[18px] font-normal leading-[100%]">12.1. Your information can be updated by you in the Site. For any question on how to do it or if you have issues in doing so, please contact us at contact@pixelpiratestudio.com. It is your responsibility to provide us with accurate and truthful information. We cannot be liable for any information that is provided to us that is incorrect</p>
            <p className="text-[18px] font-normal leading-[100%]">13. YOUR CHOICES REGARDING INFORMATION</p>
            <p className="text-[18px] font-normal leading-[100%]">13.1. Email Communications. We will periodically send you free newsletters and e-mails that directly promote the use of our Site or Service. When you receive newsletters or promotional communications from us, you may indicate a preference to stop receiving further communications from us and you will have the opportunity to “opt-out” by following the unsubscribe instructions provided in the e-mail you receive or by contacting us directly (please see contact information below). Despite your indicated e-mail preferences, we may send you Service-related communications, including notices of any updates to our Terms of Use or Privacy Policy.</p>
            <p className="text-[18px] font-normal leading-[100%]">13.2. Cookies. If you decide at any time that you no longer wish to accept Cookies from our Service for any of the purposes described above, then you can instruct your browser, by changing its settings, to stop accepting Cookies or to prompt you before accepting a Cookie from the websites you visit. Consult your browser’s technical information. If you do not accept Cookies, however, you may not be able to use all portions of the Service or all functionality of the Service. If you have any questions about how to disable or modify Cookies, please let us know at the contact information provided below.</p>
            <p className="text-[18px] font-normal leading-[100%]">13.3. De-Linking SNS. If you decide at any time that you no longer wish to have your SNS account (e.g., Facebook) linked to your Account, then you may de-link the SNS account in the “preferences” section in your Account settings. You may also manage the sharing of certain Personal Information with us when you connect with us through an SNS, such as through Facebook Connect. Please refer to the privacy settings of the SNS to determine how you may adjust our permissions and manage the interactivity between the Service and your social media account or mobile device.</p>
            <p className="text-[18px] font-normal leading-[100%]">13.4. Changing or Deleting your Personal Information. You may change any of your Personal Information in your Account by editing your profile within your Account or by sending an e-mail to us at contact@pixelpiratestudio.com. You may request deletion of your Personal Information by us, and we will use commercially reasonable efforts to honor your request, but please note that we may be required to keep such information and not delete it (or to keep this information for a certain time, in which case we will comply with your deletion request only after we have fulfilled such requirements). When we delete any information, it will be deleted from the active database, but may remain in our archives. We may also retain your information for fraud or similar purposes.</p>
            <p className="text-[18px] font-normal leading-[100%]">14. COMPLAINTS AND DISPUTES</p>
            <p className="text-[18px] font-normal leading-[100%]">14.1. If you have a complaint about our handling of your Personal Information, address your complaint in writing to contact@pixelpiratestudio.com.</p>
            <p className="text-[18px] font-normal leading-[100%]">14.2. If we have a dispute over handling of your Personal Information, we will first attempt to resolve the issue directly between us.</p>
            <p className="text-[18px] font-normal leading-[100%]">14.3. If we become aware of any unauthorized access to your Personal Information we will inform you at the earliest practical opportunity, once we have established what was accessed and how it was accessed.</p>
            <p className="text-[18px] font-normal leading-[100%]">15. INTERNATIONAL PRIVACY LAWS</p>
            <p className="text-[18px] font-normal leading-[100%]">15.1. This Site is intended for use only in the United States. If you are visiting the Service from outside the United States, please be aware that you may be sending information (including Personal Information) to the United States, where some of our servers are located. That information may then be transferred within the United States or back out of the United States, depending on the type of information and how it is stored by us. We hold and process your Personal Information in accordance with privacy laws in the United States and this Privacy Policy. Please note that privacy laws in the United States may not be the same as, and in some cases may be less protective than, the privacy laws in your country, and while in the United States Personal Information may be subject to lawful access requests by government agencies.</p>
            <p className="text-[18px] font-normal leading-[100%]">16. EUROPEAN USERS</p>
            <p className="text-[18px] font-normal leading-[100%]">16.1. Data protection law in Europe requires a “lawful basis” for collecting and retaining personal information from citizens or residents of the European Economic Area. Our lawful bases include:</p>
            <div className="pl-4 space-y-2">
              <p className="text-[18px] font-normal leading-[100%]">  (a) Performing the contract we have with you: In certain circumstances, we need your Personal Information to comply with our contractual obligation to deliver the Services, enable creators to establish and display their projects, and enable backers to find and make pledges to them.</p>
              <p className="text-[18px] font-normal leading-[100%]">(b) Legal compliance: Sometimes the law says we need to collect and use your data. For example, tax laws require us to retain records of pledges and payments made through our Services.</p>
              <p className="text-[18px] font-normal leading-[100%]">(c) Legitimate interests: This is a technical term in data protection law which essentially means we have a good and fair reason to use your data and we do so in ways which do not hurt your interests and rights. We sometimes require your data to pursue our legitimate interests in a way that might reasonably be expected as part of running our business and that does not materially impact your rights, freedom or interests. For example, we use identity, device, and location information to prevent fraud and abuse and to keep the Services secure. We may also send you promotional communications about our Services, subject to your right to control whether we do so.</p>
              <p className="text-[18px] font-normal leading-[100%]">(d) We analyze how users interact with our Site so we can understand better what elements of the design are working well and which are not working so well. This allows us to improve and develop the quality of the online experience we offer all our users.</p>
            </div>
            <p className="text-[18px] font-normal leading-[100%]">16.2 Data Protection Authority. Subject to applicable law, if you are a citizen or resident of the European Economic Area, you also have the right to object to Pixel Pirate Studio’s use of your personal information and to lodge a complaint with your local data protection authority.</p>
            <p className="text-[18px] font-normal leading-[100%]">17. ADDITIONS TO THIS POLICY</p>
            <p className="text-[18px] font-normal leading-[100%]">17.1. If we change this Privacy Policy, we will post updates on the Service or Application (the “Modifications”). Modifications are effective thirty (30) days following the “Updated” date, or the date communicated in any other notice to you. Please review this policy periodically for changes, and especially before you provide any Personal Information. By continuing to use our Service after the effective date of any Modifications to this Privacy Policy, you accept those Modifications. If any Modification to this Privacy Policy is not acceptable to you, you should cease accessing, browsing, and otherwise using the Service.</p>
            




            {/* Contact Information */}
            <div className="space-y-4 pt-8">
              <h2 className="text-[18px] font-normal leading-[100%] mb-4">CONTACTING US</h2>
              <p className="text-[18px] font-normal leading-[100%]">
                If you have any questions about this Privacy Policy or your dealings with the Site or the Application, please contact us at: contact@pixelpiratestudio.com
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
    
  );
};

export default PrivacyPolicyModal;