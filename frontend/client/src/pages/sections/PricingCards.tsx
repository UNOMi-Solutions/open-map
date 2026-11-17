import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  ApiError,
  changePlan,
  fetchSubscription,
  type SubscriptionSummary,
} from '@/lib/apiClient';
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
  isLoggedIn?: boolean;
  isVerified?: boolean;
  userEmail?: string;
  currentPlan?: string | null;
  onRequireAuth?: (planName: string) => void;
  /** Fired after an in-place plan switch so the shell can refresh its copy. */
  onPlanChanged?: (plan: string) => void;
}

// Main Pricing Component
export default function PricingCards({
  isOpen: propIsOpen,
  onClose,
  onFreeTrial,
  isLoggedIn = false,
  isVerified = false,
  userEmail,
  currentPlan = null,
  onRequireAuth,
  onPlanChanged,
}: PricingCardsProps) {
  //const [isOpen, setIsOpen] = useState(true);
  const [isYearly, setIsYearly] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);
  // A plan switch the user picked but hasn't confirmed yet. Changing plans
  // bills a real card without passing through Stripe Checkout, so it gets an
  // explicit confirmation rather than firing on the first click.
  const [pendingSwitch, setPendingSwitch] = useState<{
    plan: string;
    planName: string;
    interval: "monthly" | "yearly";
  } | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  // Live Stripe state. Someone who already pays switches their existing
  // subscription rather than checking out again, so we need to know whether
  // one exists before deciding what each button does.
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  // A logged-in user who hasn't verified their email may not buy a paid plan.
  const needsVerification = isLoggedIn && !isVerified;
  const hasPaidSubscription = !!subscription?.isPaid;

  useEffect(() => {
    if (!propIsOpen || !isLoggedIn) return;
    let cancelled = false;
    fetchSubscription()
      .then((data) => {
        if (!cancelled) setSubscription(data);
      })
      .catch(() => {
        // Without this the UI simply falls back to the checkout flow.
      });
    return () => {
      cancelled = true;
    };
  }, [propIsOpen, isLoggedIn]);

  // Once loaded, Stripe is more current than the plan the shell passed down.
  const activePlan = subscription?.plan ?? currentPlan;

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

  // Display label for the plan the user is already subscribed to.
  const currentPlanLabel = activePlan
    ? Object.keys(planKeyByName).find((name) => planKeyByName[name] === activePlan) || null
    : null;

  const selectedInterval: "monthly" | "yearly" = isYearly ? "yearly" : "monthly";

  const planByKey = (key: string | null) =>
    key ? plans.find((p) => planKeyByName[p.name] === key) || null : null;

  const priceFor = (
    plan: { monthlyPrice: number; yearlyPrice: number } | null,
    interval: string | null
  ) => (plan ? (interval === "yearly" ? plan.yearlyPrice : plan.monthlyPrice) : 0);

  /** Normalised so a monthly plan can be compared against a yearly one. */
  const monthlyEquivalent = (
    plan: { monthlyPrice: number; yearlyPrice: number } | null,
    interval: string | null
  ) => (interval === "yearly" ? priceFor(plan, "yearly") / 12 : priceFor(plan, "monthly"));

  /**
   * True when a card represents exactly what the user already pays for. The
   * billing interval counts too, so a monthly subscriber can still move to the
   * yearly price of the same plan.
   */
  const isCurrentSelection = (planKey: string) =>
    !!activePlan &&
    planKey === activePlan &&
    (!hasPaidSubscription || subscription?.interval === selectedInterval);

  const confirmSwitch = async () => {
    if (!pendingSwitch) return;
    const { plan, interval } = pendingSwitch;
    setSwitching(plan);
    setSwitchError(null);
    try {
      const result = await changePlan(plan, interval);
      setSubscription((current) =>
        current
          ? {
              ...current,
              plan: result.plan,
              displayName: result.displayName,
              interval: result.interval,
              currentPeriodEnd: result.currentPeriodEnd,
              cancelAtPeriodEnd: false,
            }
          : current
      );
      onPlanChanged?.(result.plan);
      setPendingSwitch(null);
      setNotice(
        `You're now on the ${result.displayName} plan. The price difference is prorated onto your next invoice.`
      );
    } catch (e) {
      // Keep the dialog open so the user can retry or back out.
      setSwitchError(
        e instanceof ApiError && e.message
          ? e.message
          : "Could not change your plan. Please try again."
      );
    } finally {
      setSwitching(null);
    }
  };

  const handleCheckout = async (planName: string) => {
    const plan = planKeyByName[planName];
    if (!plan) return;
    // Gate every plan behind authentication: a logged-out user is sent to the
    // login/signup flow first and can resume once authenticated.
    if (!isLoggedIn) {
      if (onRequireAuth) {
        onRequireAuth(planName);
      }
      return;
    }
    // Already on exactly this plan and billing interval — nothing to do.
    if (isCurrentSelection(plan)) {
      return;
    }
    const interval: "monthly" | "yearly" = selectedInterval;

    // Existing subscriber picking a different paid plan: change the live
    // subscription rather than checking out again, which would open a second
    // subscription and bill them for both. Confirm before touching their card.
    if (hasPaidSubscription && plan !== "freeTrial") {
      setNotice(null);
      setSwitchError(null);
      setPendingSwitch({ plan, planName, interval });
      return;
    }

    if (plan === "freeTrial") {
      // Downgrading to free means ending the paid subscription, which lives
      // behind an explicit confirmation in Account Settings.
      if (hasPaidSubscription) {
        setNotice(
          "To move to the free trial, unsubscribe from Account Settings. You'll keep your current plan until the end of the billing period."
        );
        return;
      }
      // Free trial has no Stripe price; open the signup modal instead of
      // navigating to a /signup route that doesn't exist in this SPA.
      if (onFreeTrial) {
        onFreeTrial();
      } else {
        handleClose();
      }
      return;
    }
    // Paid plan: block unverified accounts from reaching Stripe. The backend
    // enforces this too, but we stop here to avoid a pointless round trip.
    if (needsVerification) {
      setNotice(
        "Please verify your email before subscribing to a paid plan. Check your inbox for the verification link."
      );
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
          customer_email: userEmail || "jkesana@asu.edu",
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

          {currentPlanLabel && (
            <div className="mb-6 mx-auto max-w-xl rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              You're currently on the{" "}
              <span className="font-semibold">{currentPlanLabel}</span> plan.
              {hasPaidSubscription
                ? " Pick another plan below to upgrade or downgrade — we'll switch your existing subscription and prorate the difference."
                : " You can't purchase it again."}
            </div>
          )}

          {notice && (
            <div className="mb-6 mx-auto max-w-xl rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {notice}
            </div>
          )}

          {needsVerification && !notice && (
            <div className="mb-6 mx-auto max-w-xl rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your email isn't verified yet. Please verify your email before subscribing to a paid
              plan — check your inbox for the verification link.
            </div>
          )}

          <Toggle isYearly={isYearly} onToggle={() => setIsYearly(!isYearly)} />
        </div>

        {/* Pricing Cards */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => {
              const planKey = planKeyByName[plan.name];
              const isCurrent = isCurrentSelection(planKey);
              const isSwitching = switching === planKey;
              // Paid subscribers switch plans in place instead of buying again.
              const canSwitch = hasPaidSubscription && !isCurrent && planKey !== "freeTrial";
              // Same plan, different billing cadence — say so explicitly rather
              // than the vaguer "switch to this plan".
              const isIntervalOnlySwitch = canSwitch && planKey === activePlan;
              const buttonText = isCurrent
                ? "Current Plan"
                : isSwitching
                ? "Switching…"
                : isIntervalOnlySwitch
                ? `Switch to ${selectedInterval} billing`
                : canSwitch
                ? "Switch to this plan"
                : plan.buttonText;
              return (
              <Card
                key={index}
                className={`relative ${
                  isCurrent
                    ? 'bg-white border-green-500 ring-2 ring-green-500'
                    : plan.darkCard
                    ? 'bg-gray-800 text-white border-gray-700'
                    : 'bg-white border-gray-200'
                }`}
              >
                {isCurrent && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-green-500 px-3 py-1 text-xs font-semibold text-white shadow">
                    Current Plan
                  </span>
                )}
                <CardHeader className="text-center font-[Montserrat]">
                <CardTitle className={`font-bold text-[24px] leading-[100%] text-center ${plan.darkCard && !isCurrent ? 'text-gray-200' : 'text-gray-900'}`} style={{ fontFamily: 'Montserrat' }}>
                  {plan.name}
                </CardTitle>
                  <div className={`text-4xl font-montserrat font-black ${plan.darkCard && !isCurrent ? 'text-white' : 'text-gray-900'}`}>
                  {getPrice(plan)}
                  {plan.subtitle && (
                  <div className="text-2xl font-montserrat font-normal mt-1">{plan.subtitle}</div>
              )}
                  </div>
                  
                  <p className={`text-sm ${plan.darkCard && !isCurrent ? 'text-gray-400' : 'text-gray-500'}`}>
                    {plan.description}
                  </p>
                </CardHeader>

                <CardContent className="space-y-4">
                  <button
                    type="button"
                    onClick={() => handleCheckout(plan.name)}
                    disabled={isCurrent || switching !== null}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                      isCurrent
                        ? 'bg-green-100 text-green-700 cursor-not-allowed'
                        : plan.buttonStyle
                    } ${switching !== null && !isCurrent ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {buttonText}
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
                          plan.darkCard && !isCurrent ? 'text-gray-300' : 'text-gray-600'
                        }`}
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              );
            })}
          </div>
        </div>
      </div>

      {pendingSwitch && (() => {
        const fromPlan = planByKey(activePlan);
        const toPlan = planByKey(pendingSwitch.plan);
        const fromInterval = subscription?.interval || "monthly";
        const fromPrice = priceFor(fromPlan, fromInterval);
        const toPrice = priceFor(toPlan, pendingSwitch.interval);
        const isUpgrade =
          monthlyEquivalent(toPlan, pendingSwitch.interval) >
          monthlyEquivalent(fromPlan, fromInterval);
        const busy = switching !== null;

        return (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-xl font-bold text-gray-900">
                {isUpgrade ? "Confirm upgrade" : "Confirm plan change"}
              </h2>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                <div className="text-left">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Current</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {currentPlanLabel || "Free"}
                  </p>
                  <p className="text-xs text-gray-500">
                    ${fromPrice}/{fromInterval === "yearly" ? "yr" : "mo"}
                  </p>
                </div>
                <span className="px-3 text-gray-400">→</span>
                <div className="text-right">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">New</p>
                  <p className="text-sm font-semibold text-gray-900">{pendingSwitch.planName}</p>
                  <p className="text-xs text-gray-500">
                    ${toPrice}/{pendingSwitch.interval === "yearly" ? "yr" : "mo"}
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-gray-600">
                <li>
                  Your new plan starts right away, and we'll charge the card already on file — you
                  won't need to re-enter payment details.
                </li>
                <li>
                  {isUpgrade
                    ? "The price difference for the rest of this billing period is prorated onto your next invoice."
                    : "Unused time on your current plan is credited toward future invoices."}
                </li>
                <li>You can change plans again or unsubscribe at any time.</li>
              </ul>

              {switchError && (
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {switchError}
                </p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPendingSwitch(null);
                    setSwitchError(null);
                  }}
                  disabled={busy}
                  className="flex-1 rounded-lg border border-gray-300 py-3 px-4 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmSwitch}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-blue-600 py-3 px-4 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {busy
                    ? "Switching…"
                    : isUpgrade
                    ? `Upgrade to ${pendingSwitch.planName}`
                    : `Switch to ${pendingSwitch.planName}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}