import React, { useEffect, useState } from 'react';
import { X, MapPin, Trash2, Upload, Save } from 'lucide-react';
import {
  ApiError,
  createProfile,
  deleteProfile,
  listProfiles,
  type SavedProfile,
} from '@/lib/apiClient';

interface ProfilesProps {
  isOpen: boolean;
  onClose: () => void;
  /** Snapshot of the current map state to save as a new profile. */
  getCurrentConfig: () => Record<string, unknown>;
  /** Apply a saved profile's config back onto the map. */
  onLoadProfile: (config: Record<string, unknown>) => void;
  /** Human-readable name of the current plan (e.g. "Premium"), for messaging. */
  planLabel?: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  freeTrial: 'Free Trial',
  premium: 'Premium',
  enterprise: 'Enterprise',
  agency: 'Agency',
};

export default function Profiles({
  isOpen,
  onClose,
  getCurrentConfig,
  onLoadProfile,
}: ProfilesProps) {
  const [profiles, setProfiles] = useState<SavedProfile[]>([]);
  const [limit, setLimit] = useState<number>(1);
  const [count, setCount] = useState<number>(0);
  const [plan, setPlan] = useState<string>('freeTrial');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const atLimit = count >= limit;

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listProfiles();
      setProfiles(data.profiles);
      setLimit(data.limit);
      setCount(data.count);
      setPlan(data.plan);
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 401
          ? 'Please log in to manage your profiles.'
          : 'Could not load your profiles. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setName('');
      setNotice(null);
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please give your profile a name.');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await createProfile(name.trim(), getCurrentConfig());
      setProfiles((prev) => [data.profile, ...prev]);
      setCount(data.count);
      setLimit(data.limit);
      setName('');
      setNotice(`Saved "${data.profile.name}".`);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'PROFILE_LIMIT_REACHED') {
        setError(e.message);
      } else if (e instanceof ApiError && e.status === 401) {
        setError('Please log in to save a profile.');
      } else {
        setError('Could not save your profile. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    setNotice(null);
    try {
      const data = await deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      setCount(data.count);
      setLimit(data.limit);
    } catch {
      setError('Could not delete that profile. Please try again.');
    }
  };

  const handleLoad = (profile: SavedProfile) => {
    onLoadProfile(profile.config || {});
    setNotice(`Loaded "${profile.name}".`);
    onClose();
  };

  if (!isOpen) return null;

  const planLabelText = PLAN_LABELS[plan] || 'Free Trial';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-700 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-gray-700">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-white text-2xl font-semibold">My Profiles</h2>
          <p className="text-gray-400 text-sm mt-1">
            Save the current map setup — layers, filters and pins — and reload it anytime.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-gray-800 px-3 py-1 text-xs text-gray-300">
            <span className="font-semibold text-white">{planLabelText}</span>
            <span>·</span>
            <span>
              {count} / {limit} profile{limit === 1 ? '' : 's'} used
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto">
          {error && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              {error}
            </div>
          )}
          {notice && !error && (
            <div className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm text-green-300">
              {notice}
            </div>
          )}

          {/* Save current setup */}
          <div className="mb-6">
            <label className="block text-sm text-gray-300 mb-2">Save current map as a profile</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={atLimit ? 'Profile limit reached' : 'Profile name'}
                disabled={atLimit || saving}
                maxLength={120}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !atLimit && !saving) handleSave();
                }}
                className="flex-1 px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSave}
                disabled={atLimit || saving || !name.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
            {atLimit && (
              <p className="mt-2 text-xs text-amber-300">
                You've reached the {limit}-profile limit for the {planLabelText} plan. Delete a
                profile or upgrade your plan to save more.
              </p>
            )}
          </div>

          {/* Saved profiles list */}
          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Saved profiles</h3>
            {loading ? (
              <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-gray-500 py-6 text-center">
                No saved profiles yet. Set up the map and save your first one above.
              </p>
            ) : (
              <ul className="space-y-2">
                {profiles.map((profile) => (
                  <li
                    key={profile.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{profile.name}</p>
                        <p className="text-[11px] text-gray-500">
                          Updated {new Date(profile.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleLoad(profile)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Load
                      </button>
                      <button
                        onClick={() => handleDelete(profile.id)}
                        className="inline-flex items-center justify-center p-1.5 rounded-md bg-gray-700 hover:bg-red-600 text-gray-300 hover:text-white transition-colors"
                        aria-label={`Delete ${profile.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
