import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  ApiError,
  cancelSubscription,
  deleteAccount,
  fetchMe,
  fetchSubscription,
  requestEmailChange,
  requestPasswordChange,
  resumeSubscription,
  updateAccountName,
  type AccountUser,
  type SubscriptionSummary,
} from '@/lib/apiClient';

interface AccountSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  /** Opens the pricing modal so the user can buy or change a plan. */
  onOpenPlans: () => void;
  /** Lets the app shell (account menu, checkout) mirror the latest account. */
  onAccountUpdated?: (user: AccountUser) => void;
  /** Fired once the account is gone; the shell should log the user out. */
  onAccountDeleted: () => void;
}

/** Which row is expanded into an editor. Only one at a time. */
type EditingSection = 'name' | 'email' | 'plan' | 'delete';

/** The request currently in flight, so only the clicked control shows a spinner. */
type PendingAction = 'name' | 'email' | 'password' | 'cancel' | 'resume' | 'delete';

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Reads the human-readable message off a failed request. */
function messageFor(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.message) return error.message;
  return fallback;
}

const linkClass =
  'text-[11px] text-[#6C8CFF] underline underline-offset-2 hover:text-[#9DB2FF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

/** One `Label: value  Edit` line, with an optional editor panel underneath. */
function Row({
  label,
  value,
  action,
  children,
}: {
  label: string;
  value: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-2">
      <div className="flex items-baseline gap-3">
        <span className="w-[74px] shrink-0 text-[11px] italic text-white/55">{label}</span>
        <span className="flex-1 min-w-0 text-[11px] text-white break-words">{value}</span>
        {action && <span className="shrink-0 text-right">{action}</span>}
      </div>
      {children}
    </div>
  );
}

export default function AccountSettings({
  isOpen,
  onClose,
  onOpenPlans,
  onAccountUpdated,
  onAccountDeleted,
}: AccountSettingsProps) {
  const [account, setAccount] = useState<AccountUser | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editing, setEditing] = useState<EditingSection | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  const applyAccount = (user: AccountUser) => {
    setAccount(user);
    onAccountUpdated?.(user);
  };

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotice(null);
    setEditing(null);

    (async () => {
      try {
        // The plan summary is a separate call because it also reflects live
        // Stripe state (pending cancellation), not just the stored plan key.
        const [me, plan] = await Promise.all([fetchMe(), fetchSubscription()]);
        if (cancelled) return;
        setAccount(me.user);
        setSubscription(plan);
        setNameDraft(me.user.name || '');
        setEmailDraft(me.user.email);
      } catch (e) {
        if (!cancelled) setError(messageFor(e, 'Could not load your account. Please try again.'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const openEditor = (section: EditingSection) => {
    setError(null);
    setNotice(null);
    setEditing((current) => (current === section ? null : section));
    if (section === 'name') setNameDraft(account?.name || '');
    if (section === 'email') {
      setEmailDraft(account?.email || '');
      setEmailPassword('');
    }
    if (section === 'delete') setDeletePassword('');
  };

  const closeEditor = () => {
    setEditing(null);
    setError(null);
  };

  /** Hands off to the pricing modal, which handles both buying and switching. */
  const openPlans = () => {
    onClose();
    onOpenPlans();
  };

  const handleSaveName = async () => {
    setPending('name');
    setError(null);
    try {
      const { user } = await updateAccountName(nameDraft.trim());
      applyAccount(user);
      setEditing(null);
      setNotice('Name updated.');
    } catch (e) {
      setError(messageFor(e, 'Could not update your name. Please try again.'));
    } finally {
      setPending(null);
    }
  };

  const handleChangeEmail = async () => {
    setPending('email');
    setError(null);
    try {
      const res = await requestEmailChange(emailDraft.trim(), emailPassword);
      applyAccount(res.user);
      setEditing(null);
      setEmailPassword('');
      setNotice(res.message);
    } catch (e) {
      setError(messageFor(e, 'Could not change your email. Please try again.'));
    } finally {
      setPending(null);
    }
  };

  // Sends the same reset link the login flow uses, so there's one screen for
  // setting a new password rather than a second, settings-only variant.
  const handleChangePassword = async () => {
    setPending('password');
    setError(null);
    setNotice(null);
    try {
      const res = await requestPasswordChange();
      setNotice(res.message);
    } catch (e) {
      setError(messageFor(e, 'Could not send the reset email. Please try again.'));
    } finally {
      setPending(null);
    }
  };

  const handleUnsubscribe = async () => {
    setPending('cancel');
    setError(null);
    try {
      const res = await cancelSubscription();
      setSubscription((current) =>
        current
          ? { ...current, cancelAtPeriodEnd: true, currentPeriodEnd: res.currentPeriodEnd }
          : current
      );
      setEditing(null);
      const until = formatDate(res.currentPeriodEnd);
      setNotice(
        until
          ? `Subscription cancelled. You keep full access until ${until}.`
          : 'Subscription cancelled. You keep access until the end of your billing period.'
      );
    } catch (e) {
      setError(messageFor(e, 'Could not cancel your subscription. Please try again.'));
    } finally {
      setPending(null);
    }
  };

  const handleResume = async () => {
    setPending('resume');
    setError(null);
    try {
      await resumeSubscription();
      setSubscription((current) => (current ? { ...current, cancelAtPeriodEnd: false } : current));
      setNotice('Your subscription will renew as normal.');
    } catch (e) {
      setError(messageFor(e, 'Could not resume your subscription. Please try again.'));
    } finally {
      setPending(null);
    }
  };

  const handleDelete = async () => {
    setPending('delete');
    setError(null);
    try {
      await deleteAccount(deletePassword);
      onAccountDeleted();
    } catch (e) {
      setError(messageFor(e, 'Could not delete your account. Please try again.'));
    } finally {
      setPending(null);
    }
  };

  if (!isOpen) return null;

  const busy = pending !== null;

  const displayName = account?.name?.trim() || 'Add your name';
  const isPaid = !!subscription?.isPaid;
  const pendingCancel = isPaid && !!subscription?.cancelAtPeriodEnd;
  const renewalDate = formatDate(subscription?.currentPeriodEnd ?? null);

  let planValue = subscription?.displayName || 'Free Trial';
  if (isPaid && subscription?.interval) {
    planValue = `${subscription.displayName} · ${
      subscription.interval === 'yearly' ? 'Yearly' : 'Monthly'
    }`;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-[640px] rounded-[28px] border border-[#221f5c] bg-[#0A0230] px-8 pb-10 pt-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-6 top-6 text-white/80 transition-colors hover:text-white"
          aria-label="Close account settings"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-center text-[15px] font-bold text-white">Account</h2>

        {/* The mock keeps everything in a narrow column centred under the title. */}
        <div className="mx-auto mt-4 w-full max-w-[290px]">
          <div className="h-px w-full bg-white/25" />

          {loading ? (
            <p className="py-10 text-center text-[11px] text-white/50">Loading your account…</p>
          ) : !account ? (
            <p className="py-10 text-center text-[11px] text-red-300">
              {error || 'Could not load your account.'}
            </p>
          ) : (
            <>
              {/* Identity summary */}
              <div className="pt-4">
                <p className="text-[11px] font-semibold text-white">{displayName}</p>
                <p className="text-[11px] text-white/80">{account.email}</p>
                <p className="text-[11px] text-white/80">
                  {planValue}
                  {pendingCancel && renewalDate && ` · ends ${renewalDate}`}
                </p>
                {!account.verified && (
                  <p className="mt-0.5 text-[11px] text-amber-300/90">Email not verified</p>
                )}
                {account.pendingEmail && (
                  <p className="mt-0.5 text-[11px] text-[#6C8CFF]">
                    Pending: {account.pendingEmail}
                  </p>
                )}
              </div>

              {(error || notice) && (
                <p
                  className={`mt-3 text-[11px] leading-relaxed ${
                    error ? 'text-red-300' : 'text-emerald-300'
                  }`}
                >
                  {error || notice}
                </p>
              )}

              <div className="mt-5">
                {/* Name */}
                <Row
                  label="Name:"
                  value={account.name?.trim() || <span className="text-white/40">Not set</span>}
                  action={
                    <button
                      className={linkClass}
                      onClick={() => openEditor('name')}
                      disabled={busy}
                    >
                      {editing === 'name' ? 'Cancel' : 'Edit'}
                    </button>
                  }
                >
                  {editing === 'name' && (
                    <div className="mt-2 space-y-2">
                      <input
                        type="text"
                        value={nameDraft}
                        maxLength={80}
                        autoFocus
                        placeholder="Your name"
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !busy) handleSaveName();
                          if (e.key === 'Escape') closeEditor();
                        }}
                        className="w-full rounded-md border border-[#2f2b70] bg-[#06012A] px-3 py-2 text-[11px] text-white placeholder-white/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#6C8CFF]"
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={busy}
                        className="w-full rounded-md bg-[#3F5BD9] py-2 text-[11px] font-medium text-white transition-colors hover:bg-[#4d6bff] disabled:opacity-50"
                      >
                        {pending === 'name' ? 'Saving…' : 'Save name'}
                      </button>
                    </div>
                  )}
                </Row>

                {/* Email */}
                <Row
                  label="Email:"
                  value={account.email}
                  action={
                    <button
                      className={linkClass}
                      onClick={() => openEditor('email')}
                      disabled={busy}
                    >
                      {editing === 'email' ? 'Cancel' : 'Edit'}
                    </button>
                  }
                >
                  {editing === 'email' && (
                    <div className="mt-2 space-y-2">
                      <p className="text-[10px] leading-relaxed text-white/50">
                        We'll send a confirmation link to the new address. Your email only changes
                        once you open it.
                      </p>
                      <input
                        type="email"
                        value={emailDraft}
                        autoFocus
                        placeholder="New email address"
                        onChange={(e) => setEmailDraft(e.target.value)}
                        className="w-full rounded-md border border-[#2f2b70] bg-[#06012A] px-3 py-2 text-[11px] text-white placeholder-white/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#6C8CFF]"
                      />
                      <input
                        type="password"
                        value={emailPassword}
                        placeholder="Current password"
                        onChange={(e) => setEmailPassword(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !busy) handleChangeEmail();
                          if (e.key === 'Escape') closeEditor();
                        }}
                        className="w-full rounded-md border border-[#2f2b70] bg-[#06012A] px-3 py-2 text-[11px] text-white placeholder-white/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#6C8CFF]"
                      />
                      <button
                        onClick={handleChangeEmail}
                        disabled={busy || !emailDraft.trim() || !emailPassword}
                        className="w-full rounded-md bg-[#3F5BD9] py-2 text-[11px] font-medium text-white transition-colors hover:bg-[#4d6bff] disabled:opacity-50"
                      >
                        {pending === 'email' ? 'Sending…' : 'Send confirmation'}
                      </button>
                    </div>
                  )}
                </Row>

                {/* Password — reuses the login flow's reset email and screen. */}
                <Row
                  label="Password:"
                  value={<span className="tracking-[0.15em]">••••••••••••</span>}
                  action={
                    <button className={linkClass} onClick={handleChangePassword} disabled={busy}>
                      {pending === 'password' ? 'Sending…' : 'Edit'}
                    </button>
                  }
                />

                {/* Plan */}
                <Row
                  label="Plan:"
                  value={
                    <>
                      {planValue}
                      {pendingCancel && renewalDate && (
                        <span className="block text-[10px] text-amber-300/90">
                          Ends {renewalDate}
                        </span>
                      )}
                      {isPaid && !pendingCancel && renewalDate && (
                        <span className="block text-[10px] text-white/40">
                          Renews {renewalDate}
                        </span>
                      )}
                    </>
                  }
                  action={
                    isPaid ? (
                      <span className="flex flex-col items-end gap-1">
                        <button className={linkClass} onClick={openPlans}>
                          Change Plan
                        </button>
                        {pendingCancel ? (
                          <button className={linkClass} onClick={handleResume} disabled={busy}>
                            {pending === 'resume' ? 'Resuming…' : 'Resume'}
                          </button>
                        ) : (
                          <button
                            className={linkClass}
                            onClick={() => openEditor('plan')}
                            disabled={busy}
                          >
                            {editing === 'plan' ? 'Cancel' : 'Unsubscribe'}
                          </button>
                        )}
                      </span>
                    ) : (
                      <button className={linkClass} onClick={openPlans}>
                        View Plans
                      </button>
                    )
                  }
                >
                  {editing === 'plan' && isPaid && (
                    <div className="mt-2 space-y-2 rounded-md border border-amber-400/30 bg-amber-400/10 p-3">
                      <p className="text-[10px] leading-relaxed text-amber-100">
                        You'll keep {subscription?.displayName} access
                        {renewalDate ? ` until ${renewalDate}` : ' until the end of this billing period'}
                        , then your account returns to the free trial. You won't be charged again.
                      </p>
                      <button
                        onClick={handleUnsubscribe}
                        disabled={busy}
                        className="w-full rounded-md bg-amber-500 py-2 text-[11px] font-medium text-black transition-colors hover:bg-amber-400 disabled:opacity-50"
                      >
                        {pending === 'cancel' ? 'Cancelling…' : 'Confirm unsubscribe'}
                      </button>
                    </div>
                  )}
                </Row>
              </div>

              {/* Danger zone */}
              <div className="mt-6 border-t border-white/15 pt-4">
                <button
                  onClick={() => openEditor('delete')}
                  disabled={busy}
                  className="text-[11px] text-red-400 underline underline-offset-2 transition-colors hover:text-red-300 disabled:opacity-40"
                >
                  {editing === 'delete' ? 'Cancel' : 'Delete Account'}
                </button>

                {editing === 'delete' && (
                  <div className="mt-3 space-y-2 rounded-md border border-red-500/30 bg-red-500/10 p-3">
                    <p className="text-[10px] leading-relaxed text-red-200">
                      This permanently deletes your account, your saved profiles and any active
                      subscription. It can't be undone.
                    </p>
                    <input
                      type="password"
                      value={deletePassword}
                      autoFocus
                      placeholder="Confirm your password"
                      onChange={(e) => setDeletePassword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !busy && deletePassword) handleDelete();
                        if (e.key === 'Escape') closeEditor();
                      }}
                      className="w-full rounded-md border border-red-500/40 bg-[#06012A] px-3 py-2 text-[11px] text-white placeholder-white/30 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                    <button
                      onClick={handleDelete}
                      disabled={busy || !deletePassword}
                      className="w-full rounded-md bg-red-600 py-2 text-[11px] font-medium text-white transition-colors hover:bg-red-500 disabled:opacity-50"
                    >
                      {pending === 'delete' ? 'Deleting…' : 'Permanently delete account'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
