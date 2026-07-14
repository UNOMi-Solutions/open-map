import React, { useState } from 'react';
import { X } from 'lucide-react';
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}
interface ToggleProps {
  isYearly: boolean;
  onToggle: () => void;
}

// Card components (using your provided structure)
const Card = React.forwardRef <HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`rounded-xl border bg-card text-card-foreground shadow ${className || ''}`}
    {...props}
  />   
));
Card.displayName = "Card";

const CardHeader = React.forwardRef <HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex flex-col space-y-1.5 p-6 ${className || ''}`}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef <HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`font-semibold leading-none tracking-tight ${className || ''}`}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardContent = React.forwardRef <HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={`p-6 pt-0 ${className || ''}`} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`flex items-center p-6 pt-0 ${className || ''}`}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

// Toggle Switch Component
const Toggle = ({ isYearly, onToggle }:ToggleProps) => (
  <div className="flex items-center justify-center space-x-4 mb-8">
    <span className={`text-sm font-medium ${!isYearly ? 'text-gray-600' : 'text-gray-400'}`}>
      Billed Monthly
    </span>
    <button
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        isYearly ? 'bg-gray-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          isYearly ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
    <span className={`text-sm font-medium ${isYearly ? 'text-gray-900' : 'text-gray-500'}`}>
      Billed Yearly
    </span>
  </div>
);

interface PricingCardsProps {
  isOpen: boolean;
  onClose?: () => void;
  onFreeTrial?: () => void;
}

// Main Pricing Component
export default function PricingCards({ isOpen: propIsOpen, onClose, onFreeTrial }: PricingCardsProps) {
  //const [isOpen, setIsOpen] = useState(true);
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      name: 'Free',
      subtitle: '',
      monthlyPrice: 0,
      yearlyPrice: 0, // Free is always free
      description: 'per user',
      features: [
        '1 Profile',
        'New Update Notifications',
        'With Ads'
      ],
      buttonText: 'Start Today',
      buttonStyle: 'border border-blue-500 text-blue-600 hover:bg-blue-50',
      popular: false
    },
    {
      name: 'Premium',
      subtitle: '',
      monthlyPrice: 5,
      yearlyPrice: 48, // Usually discounted yearly price
      description: 'per user',
      features: [
        '1 Profile',
        'New Update Notifications',
        'Advanced Search',
        '24/7 Support',
        'No Ads'
      ],
      buttonText: 'Start Today',
      buttonStyle: 'border border-blue-500 text-blue-600 hover:bg-blue-50',
      popular: false
    },
    {
      name: 'Enterprise',
      subtitle: '',
      monthlyPrice: 29,
      yearlyPrice: 278.00, // Usually discounted yearly price
      description: 'per user',
      features: [
        '10 Profiles',
        'New Update Notifications',
        'Advanced Search',
        '24/7 Support',
        'No Ads'
      ],
      buttonText: 'Start Today',
      buttonStyle: 'bg-blue-600 text-white hover:bg-blue-700',
      popular: false,
      darkCard: true
    },
    {
      name: 'Agency',
      subtitle: '',
      monthlyPrice: 139,
      yearlyPrice: 1330, // Usually discounted yearly price
      description: 'per user',
      features: [
        '100 Profiles',
        'New Update Notifications',
        'Advanced Search',
        '24/7 VIP Support',
        'No Ads'
      ],
      buttonText: 'Start Today',
      buttonStyle: 'border border-blue-500 text-blue-600 hover:bg-blue-50',
      popular: false
    }
  ];
  const getPrice = (plan: { monthlyPrice: number; yearlyPrice: number }) => {
    if (plan.monthlyPrice === 0) return 'Trial';
    
    const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
    return `$${price}`;
  };

  const planKeyByName: Record<string, string> = {
    Free: "freeTrial",
    Premium: "premium",
    Enterprise: "enterprise",
    Agency: "agency",
  };

  const handleCheckout = async (planName: string) => {
    const plan = planKeyByName[planName];
    if (!plan) return;
    const interval = isYearly ? "yearly" : "monthly";
    if (plan === "freeTrial") {
      // Free trial has no Stripe price; open the signup modal instead of
      // navigating to a /signup route that doesn't exist in this SPA.
      if (onFreeTrial) {
        onFreeTrial();
      } else {
        handleClose();
      }
      return;
    }
    try {
      const base = window.location.origin;
      const apiURL = import.meta.env.VITE_API_LINK || "";
      const apiKey = import.meta.env.VITE_API_DEV_KEY || "";
      const res = await fetch(`${apiURL}/api/v1/stripe/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({
          plan,
          interval,
          customer_email: "jkesana@asu.edu",
          successUrl: `${base}/payment-success.html?session_id={CHECKOUT_SESSION_ID}&plan=${plan}&interval=${interval}`,
          cancelUrl: `${base}/payment-cancelled.html`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      console.error("Checkout error", e);
    }
  };

  if (!propIsOpen) return null;
  const handleClose = () => {
    // Call the onClose prop instead of setting internal state
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="relative text-center py-8 px-6 border-b">
          <button
            onClick={handleClose}
            className="absolute top-6 right-6 text-gray-600 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
          
          <h1 className="text-4xl font-montserrat font-black text-gray-900 mb-6">
            Manage Your Plan
          </h1>
          
          <Toggle isYearly={isYearly} onToggle={() => setIsYearly(!isYearly)} />
        </div>

        {/* Pricing Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <Card
                key={index}
                className={`relative ${
                  plan.darkCard 
                    ? 'bg-gray-800 text-white border-gray-700' 
                    : 'bg-white border-gray-200'
                }`}
              >
                <CardHeader className="text-center font-[Montserrat]">
                <CardTitle className={`font-bold text-[24px] leading-[100%] text-center ${plan.darkCard ? 'text-gray-200' : 'text-gray-900'}`} style={{ fontFamily: 'Montserrat' }}>
                  {plan.name}
                </CardTitle>
                  <div className={`text-4xl font-montserrat font-black ${plan.darkCard ? 'text-white' : 'text-gray-900'}`}>
                  {getPrice(plan)}
                  {plan.subtitle && (
                  <div className="text-2xl font-montserrat font-normal mt-1">{plan.subtitle}</div>
              )}
                  </div>
                  
                  <p className={`text-sm ${plan.darkCard ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <button
                    type="button"
                    onClick={() => handleCheckout(plan.name)}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${plan.buttonStyle}`}
                  >
                    {plan.buttonText}
                  </button>

                  <div 
                    className="w-full"
                    style={{
                      borderTop: '1px solid #DDDDDD',
                      width: '100%',
                      height: '0px',
                      opacity: 1
                    }}
                  ></div>

                  <ul className="space-y-3">
                    {plan.features.map((feature, featureIndex) => (
                      <li 
                        key={featureIndex} 
                        className={`text-sm text-center ${
                          plan.darkCard ? 'text-gray-300' : 'text-gray-600'
                        }`}
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}