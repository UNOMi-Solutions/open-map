import React, { useCallback, useEffect, useMemo, useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import SignUp from "./sections/SignUp";
import Login from "./sections/Login";
import Verify from "./sections/Verificaiton";
import Reset from "./sections/ResetPassword";
import ForgotPassword from "./sections/ForgotPassword";
import SideBarMenu from "./sections/SideBarMenu";
import { NavigationMenuSection } from "./sections/NavigationMenuSection";
import SearchPopup from "./sections/SearchPopup";
import PricingCards from "./sections/PricingCards";
import ContactUsform from "./sections/ContactUsform";
import AboutUsModal from "./sections/AboutUs";
import NewsletterPopup from "./sections/NewsLetterPopup";
import SharePopup from "./sections/SharePopup";
import Profiles from "./sections/Profiles";
import AccountSettings from "./sections/AccountSettings";
import EmailChangeVerification from "./sections/EmailChangeVerification";
import {
  ApiError,
  fetchMe,
  getAuthToken,
  setAuthToken,
  type AccountUser,
} from "@/lib/apiClient";
import LeafletMap, {
  ChoroplethMetricKey,
  HouseDistrictPartyMode,
} from "@/components/ui/LeafletMap";
import { ChevronLeft, ChevronRight, Loader } from "lucide-react";
import { X, UserPlusIcon, SettingsIcon } from "lucide-react";
import { AD_SLOTS, BannerAd, VideoAd, adSlotActive } from "@/components/ads";

import {
  HEALTH_ALL_LAYER_IDS,
  HEALTH_WIRED_LAYER_IDS,
} from "@/lib/health-places";
import { SPLC_LAYER_IDS } from "@/lib/splc-hate-map";
import { NASA_PREFIX } from "@/lib/nasaLayers";
import {
  INCIDENT_FILTER_PREFIXES,
  INCIDENT_MENU_ID,
  INCIDENT_TYPE_IDS,
  migrateIncidentLayers,
  selectIncidentType,
  stormCategoryFromLayers,
  stripIncidentSelections,
} from "@/lib/disaster-incidents";
import LoadingBar from "./sections/LoadingBar";
import AdsterraBanner from "@/components/ads/AdsterraBanner";
import {
  snapOnOrBefore,
  type TimelineDatasetMeta,
  type TimelineDateRange,
} from "@/lib/timeline";
import MapTimeline, { type TimelineTrack } from "@/components/ui/MapTimeline";
import MonetagAd from "@/components/ads/MonetagAd";

/** Header label for a dataset that does not name itself: "oil-spills" -> "Oil Spills". */
const timelineLabel = (datasetId: string) =>
  datasetId
    .replace(/^economics-/, "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

/** Economics and NASA show one date at a time; each keeps its own day on the timeline. */
const isSingleDateDataset = (datasetId: string, meta?: TimelineDatasetMeta) =>
  datasetId.startsWith("economics-") || Boolean(meta?.single);

/** Dot, chip and legend-outline colours for single-date datasets, distinct on dark and light. */
const TIMELINE_COLORS = ["#38bdf8", "#f472b6", "#a3e635", "#fbbf24", "#c084fc", "#fb7185", "#34d399", "#fb923c"];

// Last-used days per dataset, kept in this browser so they survive a reload
const TIMELINE_DATES_KEY = "openmap.timelineDates";
function loadSavedTimelineDates(): Record<string, number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(TIMELINE_DATES_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}
function saveTimelineDates(dates: Record<string, number>) {
  try {
    localStorage.setItem(TIMELINE_DATES_KEY, JSON.stringify(dates));
  } catch {
    // private window or storage blocked: the dates still last for this visit
  }
}

const ECONOMICS_LAYER_IDS = new Set([
  "income",
  "high-income-households",
  "unemployment",
  "poverty-stricken-areas",
]);

export default function MainPage() {
  const [progress, setProgress] = useState(0);
  const [isLoading, setLoading] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSignUpOpen, setIsSignUpOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  // Dams filters
  const [socialPovertyYear, setSocialPovertyYear] = useState<number>(2024);
  const [medianIncomeYear, setMedianIncomeYear] = useState<number>(2024);
  const [selectedDamHazard, setSelectedDamHazard] = useState<string>("all");
  const [selectedDamYear, setSelectedDamYear] = useState<string>("all");
  const [selectedInvasiveYear, setSelectedInvasiveYear] = useState<string>("all");
  const [selectedGroundwaterYear, setSelectedGroundwaterYear] =
    useState<string>("all");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("joe@gmail.com");
  // Display name from the account settings page; empty until the user sets one.
  const [userName, setUserName] = useState("");
  // Plan key ("premium" | "enterprise" | "agency" | "freeTrial") for the
  // logged-in user, or null when they have no active subscription.
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [accountPlanResolved, setAccountPlanResolved] = useState(
    () => !getAuthToken(),
  );
  // Whether the logged-in user's email has been verified. Unverified users
  // cannot subscribe to a paid plan.
  const [isVerified, setIsVerified] = useState(false);
  const isPremium = ["premium", "enterprise", "agency"].includes(
    currentPlan ?? "",
  );
  const shouldShowAds = accountPlanResolved && !isPremium;
  // A placement only draws when its slot has an ID (or VITE_AD_PREVIEW is on), so an unfilled slot
  // never leaves an empty box over the legends or the timeline
  const railAdActive = shouldShowAds && adSlotActive(AD_SLOTS.video);
  const bannerAdActive = shouldShowAds && adSlotActive(AD_SLOTS.banner);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  // Remembers a plan a logged-out user tried to select so we can resume the
  // pricing flow after they log in / sign up.
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isNewsletterPopupOpen, setIsNewsletterPopupOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isProfilesOpen, setIsProfilesOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSignUpDropdownOpen, setIsSignUpDropdownOpen] = useState(false);
  const [isPinDropMode, setIsPinDropMode] = useState(false);
  const [mapPins, setMapPins] = useState<
    { id: string; lat: number; lng: number; stateName?: string }[]
  >([]);
  const [selectedLayers, setSelectedLayers] = useState<string[]>([]);
  const [povertyYear, setPovertyYear] = useState<number | null>(null);
  const [povertyLatestYear, setPovertyLatestYear] = useState<number | null>(null);
  const [povertyAvailableYears, setPovertyAvailableYears] = useState<number[]>([]);
  // Every dated layer on the map reports its dates here; the timeline panel is built from them.
  const [timelineDatasets, setTimelineDatasets] = useState<
    Record<string, { range: TimelineDateRange; meta?: TimelineDatasetMeta }>
  >({});
  // Span datasets (oil spills, storms, ...) share one range
  const [timelineRange, setTimelineRange] = useState<TimelineDateRange | null>(null);
  const previousRangeBounds = useRef<TimelineDateRange | null>(null);
  // Single-date datasets (economics, NASA) each keep their own day. Entries stay after a layer is
  // switched off, so switching it back on returns to the day it was last on.
  const [datasetDates, setDatasetDates] = useState<Record<string, number>>(loadSavedTimelineDates);
  const [datasetColors, setDatasetColors] = useState<Record<string, string>>({});

  const rangeBounds = useMemo(() => {
    const ranges = Object.entries(timelineDatasets)
      .filter(([id, d]) => !isSingleDateDataset(id, d.meta))
      .map(([, d]) => d.range);
    return ranges.length
      ? { start: Math.min(...ranges.map((r) => r.start)), end: Math.max(...ranges.map((r) => r.end)) }
      : null;
  }, [timelineDatasets]);
  const singleIds = Object.keys(timelineDatasets).filter((id) => isSingleDateDataset(id, timelineDatasets[id].meta));
  const singleIdsKey = singleIds.join("|");

  // Colours: each single-date dataset keeps its colour while it is on; freed colours are reused
  useEffect(() => {
    setDatasetColors((current) => {
      const next: Record<string, string> = {};
      for (const id of singleIds) if (current[id]) next[id] = current[id];
      for (const id of singleIds) {
        if (next[id]) continue;
        const used = new Set(Object.values(next));
        next[id] = TIMELINE_COLORS.find((c) => !used.has(c)) ?? TIMELINE_COLORS[Object.keys(next).length % TIMELINE_COLORS.length];
      }
      const same = Object.keys(next).length === Object.keys(current).length && Object.keys(next).every((id) => current[id] === next[id]);
      return same ? current : next;
    });
  }, [singleIdsKey]);

  useEffect(() => saveTimelineDates(datasetDates), [datasetDates]);

  // The day each single-date dataset shows: its saved day, else its newest, snapped to real data
  const timelineTracks = useMemo<TimelineTrack[]>(() => {
    const tracks: TimelineTrack[] = [];
    for (const [id, d] of Object.entries(timelineDatasets)) {
      const label = d.meta?.label ?? timelineLabel(id);
      if (isSingleDateDataset(id, d.meta)) {
        const dates = d.meta?.availableDates;
        const min = dates?.[0] ?? d.range.start;
        const max = dates?.[dates.length - 1] ?? d.range.end;
        const saved = datasetDates[id];
        const date = snapOnOrBefore(dates, Math.min(max, Math.max(min, saved ?? max)));
        tracks.push({ id, label, color: datasetColors[id], single: true, min, max, availableDates: dates, value: { start: date, end: date } });
      } else if (rangeBounds && timelineRange) {
        tracks.push({ id, label, single: false, min: rangeBounds.start, max: rangeBounds.end, value: timelineRange });
      }
    }
    return tracks;
  }, [timelineDatasets, datasetDates, datasetColors, rangeBounds, timelineRange]);

  // Per-dataset days for the map layers; a new object only when a day actually changes
  const singleRangesKey = timelineTracks.filter((t) => t.single).map((t) => `${t.id}=${t.value.end}`).join("|");
  const datasetRanges = useMemo(
    () => Object.fromEntries(timelineTracks.filter((t) => t.single).map((t) => [t.id, t.value])),
    [singleRangesKey],
  );
  const datasetColorsKey = JSON.stringify(datasetColors);
  const stableDatasetColors = useMemo(() => datasetColors, [datasetColorsKey]);

  const handleDatasetDateRangeChange = useCallback(
    (datasetId: string, range: TimelineDateRange | null, meta?: TimelineDatasetMeta) => {
      setTimelineDatasets((current) => {
        const existing = current[datasetId];
        if (!range) {
          if (!existing) return current;
          const next = { ...current };
          delete next[datasetId];
          return next;
        }
        const same =
          existing?.range.start === range.start &&
          existing.range.end === range.end &&
          existing.meta?.label === meta?.label &&
          existing.meta?.single === meta?.single &&
          existing.meta?.availableDates?.length === meta?.availableDates?.length;
        return same ? current : { ...current, [datasetId]: { range, meta } };
      });
    },
    [],
  );

  // Keep the span datasets' range inside their combined dates as layers come and go
  useEffect(() => {
    const previous = previousRangeBounds.current;
    previousRangeBounds.current = rangeBounds;
    if (!rangeBounds) {
      setTimelineRange(null);
      return;
    }
    setTimelineRange((current) => {
      if (!current || !previous || (current.start === previous.start && current.end === previous.end)) {
        return rangeBounds;
      }
      const clamp = (t: number) => Math.min(rangeBounds.end, Math.max(rangeBounds.start, t));
      const start = clamp(current.start);
      return { start, end: Math.max(start, clamp(current.end)) };
    });
  }, [rangeBounds?.start, rangeBounds?.end]);

  const SIDEBAR_WIDTH_OPEN = 430;
  // NEW: sidebar open/close
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Landing overlay shown on first load
  const [showLanding, setShowLanding] = useState(true);
  const [choroplethMetric, setChoroplethMetric] =
    useState<ChoroplethMetricKey>("pct_white");
  const [showChoropleth, setShowChoropleth] = useState(false);
  const [selectedAgeGroupId, setSelectedAgeGroupId] = useState<string | null>(null);
  const [selectedRaceCensusId, setSelectedRaceCensusId] = useState<string>("all");
  const [selectedSexId, setSelectedSexId] = useState<string | null>(null);
  // Ref for map container for PDF export
  const mapSectionRef = useRef<HTMLElement>(null);

  // Props for Displaying Police Killing Data
  const [showPoliceKillingData, setShowPoliceKillingData] = useState(false);
  const [showPoliceShootings, setShowPoliceShootings] = useState(false);

  // Props for displaying homicide data
  const [showMurderData, setShowMurderData] = useState(false);
  const [murderCategory, setMurderCategory] = useState<string>("victim");
  const [murderAttribute, setMurderAttribute] = useState<string>("age");

  // Props for displaying arrest data
  const [arrestCategory, setArrestCategory] = useState<string>("Arrestee Sex");
  const [showArrestData, setShowArrestData] = useState(false);

  // Props for missing persons data
  const [showMissingPersonsData, setShowMissingPersonsData] = useState(false);

  // Props for consent age data
  const [showConsentAgeData, setShowConsentAgeData] = useState(false);

  // props for rural access
  const [ruralAccessYear, setRuralAccessYear] = useState(2021);

  const [politicalLayerIds, setPoliticalLayerIds] = useState<string[]>([]);
  const [houseDistrictPartyMode, setHouseDistrictPartyMode] =
    useState<HouseDistrictPartyMode>("both");
  /** CDC PLACES county choropleth; exclusive with census race/age/sex selection */
  const [healthMetricId, setHealthMetricId] = useState<string | null>(null);

  const handlePovertyDataMeta = useCallback(
    (latestYear: number, availableYears: number[]) => {
      setPovertyLatestYear(latestYear);
      setPovertyAvailableYears(availableYears);
    },
    [],
  );
  const handleTimelineChange = useCallback(
    (changes: Record<string, TimelineDateRange>) => {
      const days: Record<string, number> = {};
      for (const [id, range] of Object.entries(changes)) {
        if (isSingleDateDataset(id, timelineDatasets[id]?.meta)) days[id] = range.end;
        else setTimelineRange(range);
      }
      if ("economics-poverty" in days) setPovertyYear(null);
      if (Object.keys(days).length) setDatasetDates((current) => ({ ...current, ...days }));
    },
    [timelineDatasets],
  );

  const toggleMenu = () => setIsMenuOpen((s) => !s);
  const closeMenu = () => setIsMenuOpen(false);

  // Full literal class strings — Tailwind scans source text, so an interpolated
  // `bg-[${...}]` would never emit any CSS and the bars would be invisible.
  const barClass = showLanding
    ? "w-[30px] h-[1px] bg-[#ffffff] rounded-[2px]"
    : "w-[30px] h-[1px] bg-[#0c1022] rounded-[2px]";
  const checkVerify = (() => {
    if (window.location.href.includes("/verify?")) {
      return true;
    } else {
      return false;
    }
  });

  const [isVerifyOpen, setIsVerifyOpen] = useState(checkVerify());

  const checkReset = (() => {
    if (window.location.href.includes("/reset?")) {
      return true;
    } else {
      return false;
    }
  });

  const [isResetOpen, setIsResetOpen] = useState(checkReset());

  const checkEmailChange = (() => window.location.href.includes("/verify-email?"));

  const [isEmailChangeOpen, setIsEmailChangeOpen] = useState(checkEmailChange());

  const handleSearchTrigger = () => {
    setIsSearchOpen(true);
    setIsSignUpDropdownOpen(false);
  };

  // Keyboard shortcuts (Ctrl/Cmd+K for search, Ctrl/Cmd+B for sidebar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        !!target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);

      if (!typing && (e.ctrlKey || e.metaKey)) {
        const key = e.key.toLowerCase();
        if (key === "k") {
          e.preventDefault();
          handleSearchTrigger();
        } else if (key === "b") {
          e.preventDefault();
          setSidebarOpen((s) => !s);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSignUpClick = () => {
    setIsSignUpOpen(true);
    setIsSignUpDropdownOpen(false);
  };
  const toggleSignUpDropdown = () => setIsSignUpDropdownOpen((s) => !s);
  const togglePinDropMode = () => {
    setIsPinDropMode((prev) => !prev);
    setIsSignUpDropdownOpen(false);
  };
  /** Mirrors the server's copy of the account into the shell's UI state. */
  const applyAccount = (user: AccountUser) => {
    setUserName(user.name || "");
    setUserEmail(user.email);
    setCurrentPlan(user.plan ?? null);
    setIsVerified(!!user.verified);
  };

  const handleUserLogin = (
    email: string,
    plan: string | null = null,
    verified: boolean = false
  ) => {
    setAccountPlanResolved(false);
    setIsLoggedIn(true);
    setUserEmail(email);
    setCurrentPlan(plan);
    setIsVerified(verified);
    setIsSignUpOpen(false);
    // The login/verify responses don't carry every account field (e.g. the
    // display name), so pull the full record once the token is stored.
    fetchMe()
      .then(({ user }) => {
        if (user) applyAccount(user);
        setAccountPlanResolved(true);
      })
      .catch((error) => {
        console.error("[MainPage] Account refresh after login failed:", error);
      });
    // If the user was trying to pick a plan before authenticating, bring them
    // back to the pricing screen to finish choosing.
    if (pendingPlan) {
      setPendingPlan(null);
      setIsPricingOpen(true);
    }
  };
  const handleRequirePlanAuth = (_planName: string) => {
    setPendingPlan(_planName);
    setIsPricingOpen(false);
    setIsLoginOpen(true);
  };
  const handlePinDropped = (coords: { lat: number; lng: number }, stateName?: string) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setMapPins((prev) => [...prev, { id, stateName, ...coords }]);
  };

  const handleRemovePin = (id: string) => {
    setMapPins((prev) => prev.filter((pin) => pin.id !== id));
  };

  const handleClearPins = () => {
    setMapPins([]);
  };
  const handleUserLogout = () => {
    setAuthToken(null);
    setIsLoggedIn(false);
    setUserEmail("");
    setUserName("");
    setCurrentPlan(null);
    setAccountPlanResolved(true);
    setIsVerified(false);
    setIsSignUpDropdownOpen(false);
    setIsAccountOpen(false);
    setIsProfilesOpen(false);
  };
  const handlePricingClick = () => {
    setIsPricingOpen(true);
    setIsSignUpDropdownOpen(false);
  };
  const handleContactClick = () => {
    setIsContactOpen(true);
    setIsMenuOpen(false);
  };
  const handleAboutClick = () => {
    setIsAboutOpen(true);
    setIsMenuOpen(false);
  };
  const handleNewsletterClick = () => {
    setIsNewsletterPopupOpen(true);
    setIsMenuOpen(false);
  };

  const handleLayerToggle = (layerId: string, checked: boolean) => {
    if (SPLC_LAYER_IDS.has(layerId)) {
      if (checked) {
        setSelectedLayers((prev) => [
          ...prev.filter(
            (id) => !HEALTH_ALL_LAYER_IDS.has(id) && !SPLC_LAYER_IDS.has(id) && !ECONOMICS_LAYER_IDS.has(id)
          ),
          layerId,
        ]);
        setHealthMetricId(null);
        setSelectedRaceCensusId("all");
        setSelectedAgeGroupId(null);
        setSelectedSexId(null);
        setShowChoropleth(false);
      } else {
        setSelectedLayers((prev) => prev.filter((id) => id !== layerId));
      }
      return;
    }
    if (ECONOMICS_LAYER_IDS.has(layerId)) {
      if (checked) {
        setSelectedLayers((prev) => [
          ...prev.filter(
            (id) => !HEALTH_ALL_LAYER_IDS.has(id) && !SPLC_LAYER_IDS.has(id) && !ECONOMICS_LAYER_IDS.has(id)
          ),
          layerId,
        ]);
        setHealthMetricId(null);
        setSelectedRaceCensusId("all");
        setSelectedAgeGroupId(null);
        setSelectedSexId(null);
        setShowChoropleth(false);
      } else {
        setSelectedLayers((prev) => prev.filter((id) => id !== layerId));
      }
      return;
    }
    if (HEALTH_ALL_LAYER_IDS.has(layerId)) {
      if (checked) {
        setSelectedLayers((prev) => [
          ...prev.filter(
            (id) => !HEALTH_ALL_LAYER_IDS.has(id) && !SPLC_LAYER_IDS.has(id) && !ECONOMICS_LAYER_IDS.has(id)
          ),
          layerId,
        ]);
        if (HEALTH_WIRED_LAYER_IDS.has(layerId)) {
          setHealthMetricId(layerId);
          setSelectedRaceCensusId("all");
          setSelectedAgeGroupId(null);
          setSelectedSexId(null);
          setShowChoropleth(false);
        } else {
          setHealthMetricId(null);
        }
      } else {
        setSelectedLayers((prev) => prev.filter((id) => id !== layerId));
        setHealthMetricId((cur) => (cur === layerId ? null : cur));
      }
      return;
    }
    if (layerId === INCIDENT_MENU_ID) {
      setSelectedLayers((prev) =>
        checked
          ? prev.includes(INCIDENT_MENU_ID)
            ? prev
            : [...prev, INCIDENT_MENU_ID]
          : stripIncidentSelections(prev),
      );
      return;
    }
    if (INCIDENT_TYPE_IDS.has(layerId)) {
      setSelectedLayers((prev) =>
        checked
          ? selectIncidentType(prev, layerId)
          : prev.filter(
              (id) =>
                id !== layerId &&
                !INCIDENT_FILTER_PREFIXES.some((prefix) => id.startsWith(prefix)),
            ),
      );
      return;
    }
    const singleSelectPrefix = [
      "eq-mag:",
      "nri-hz:",
      "vo-alert:",
      "wf-acres:",
      "dr-cat:",
    ].find((p) => layerId.startsWith(p));
    if (singleSelectPrefix) {
      setSelectedLayers((prev) => [
        ...prev.filter((id) => !id.startsWith(singleSelectPrefix)),
        ...(checked ? [layerId] : []),
      ]);
      return;
    }
    setSelectedLayers((prev) =>
      checked ? [...prev, layerId] : prev.filter((id) => id !== layerId)
    );
  };

  const handlePoliticalLayerToggle = (layerId: string, checked: boolean) => {
    setPoliticalLayerIds((prev) =>
      checked ? [...prev, layerId] : prev.filter((id) => id !== layerId)
    );
  };

  /** Clear sidebar map filters (layers, choropleth, crime/social/political). Does not remove dropped pins or pin-drop mode. */
  const handleResetAllFilters = () => {
    setSelectedLayers([]);
    setChoroplethMetric("pct_white");
    setShowChoropleth(false);
    setSelectedAgeGroupId(null);
    setSelectedRaceCensusId("all");
    setSelectedSexId(null);
    setShowPoliceKillingData(false);
    setShowPoliceShootings(false);
    setShowMurderData(false);
    setMurderCategory("victim");
    setMurderAttribute("age");
    setArrestCategory("Arrestee Sex");
    setShowArrestData(false);
    setShowMissingPersonsData(false);
    setShowConsentAgeData(false);
    setPoliticalLayerIds([]);
    setHouseDistrictPartyMode("both");
    setSearchQuery("");
    setHealthMetricId(null);
    setDatasetDates({});
  };

  /** Snapshot of the full map setup, saved as a profile's `config`. */
  const getCurrentConfig = (): Record<string, unknown> => ({
    mapPins,
    selectedLayers,
    choroplethMetric,
    showChoropleth,
    selectedAgeGroupId,
    selectedRaceCensusId,
    selectedSexId,
    showPoliceKillingData,
    showPoliceShootings,
    showMurderData,
    murderCategory,
    murderAttribute,
    arrestCategory,
    showArrestData,
    showMissingPersonsData,
    showConsentAgeData,
    politicalLayerIds,
    houseDistrictPartyMode,
    healthMetricId,
    searchQuery,
  });

  /** Applies a saved profile's config back onto the map, falling back to
   * sensible defaults for any field an older profile may be missing. */
  const applyConfig = (config: Record<string, any>) => {
    const c = config || {};
    setMapPins(Array.isArray(c.mapPins) ? c.mapPins : []);
    const savedPoliticalLayerIds = Array.isArray(c.politicalLayerIds)
      ? c.politicalLayerIds
      : [];
    const savedLayerIds = Array.isArray(c.selectedLayers) ? c.selectedLayers : [];
    setSelectedLayers(
      migrateIncidentLayers(
        savedPoliticalLayerIds.includes("billionaires") &&
          !savedLayerIds.includes("billionaires")
          ? [...savedLayerIds, "billionaires"]
          : savedLayerIds
      )
    );
    setChoroplethMetric(c.choroplethMetric ?? "pct_white");
    setShowChoropleth(!!c.showChoropleth);
    setSelectedAgeGroupId(c.selectedAgeGroupId ?? null);
    setSelectedRaceCensusId(c.selectedRaceCensusId ?? "all");
    setSelectedSexId(c.selectedSexId ?? null);
    setShowPoliceKillingData(!!c.showPoliceKillingData);
    setShowPoliceShootings(!!c.showPoliceShootings);
    setShowMurderData(!!c.showMurderData);
    setMurderCategory(c.murderCategory ?? "victim");
    setMurderAttribute(c.murderAttribute ?? "age");
    setArrestCategory(c.arrestCategory ?? "Arrestee Sex");
    setShowArrestData(!!c.showArrestData);
    setShowMissingPersonsData(!!c.showMissingPersonsData);
    setShowConsentAgeData(!!c.showConsentAgeData);
    setPoliticalLayerIds(
      savedPoliticalLayerIds.filter((id: string) => id !== "billionaires")
    );
    setHouseDistrictPartyMode(c.houseDistrictPartyMode ?? "both");
    setHealthMetricId(c.healthMetricId ?? null);
    setSearchQuery(c.searchQuery ?? "");
    // Make sure the loaded configuration is actually visible.
    setShowLanding(false);
    setSidebarOpen(true);
  };

  // Restore the logged-in session (and plan) on page load using the stored JWT.
  useEffect(() => {
    if (!getAuthToken()) {
      setAccountPlanResolved(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { user } = await fetchMe();
        if (cancelled || !user) return;
        applyAccount(user);
        setIsLoggedIn(true);
        setAccountPlanResolved(true);
      } catch (error) {
        if (error instanceof ApiError && [401, 403].includes(error.status)) {
          setAuthToken(null);
          setAccountPlanResolved(true);
          return;
        }
        console.error("[MainPage] Session restore failed:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Newsletter popup timer
  useEffect(() => {
    const timer = setTimeout(() => setIsNewsletterPopupOpen(true), 60000);
    return () => clearTimeout(timer);
  }, []);

  /** Drop health / SPLC choropleths when user turns on census race / age / sex layers */
  useEffect(() => {
    const censusActive =
      selectedRaceCensusId !== "all" ||
      selectedAgeGroupId != null ||
      selectedSexId != null;
    if (!censusActive) return;
    if (healthMetricId) {
      setHealthMetricId(null);
      setSelectedLayers((prev) =>
        prev.filter((id) => !HEALTH_ALL_LAYER_IDS.has(id))
      );
    }
    setSelectedLayers((prev) =>
      prev.filter((id) => !SPLC_LAYER_IDS.has(id) && !ECONOMICS_LAYER_IDS.has(id))
    );
  }, [selectedRaceCensusId, selectedAgeGroupId, selectedSexId, healthMetricId]);

  /** Population choropleth and SPLC are mutually exclusive for the colored layer */
  const handleTogglePopulationChoropleth = () => {
    setShowChoropleth((v) => {
      const next = !v;
      if (next) {
        setSelectedLayers((prev) =>
          prev.filter((id) => !SPLC_LAYER_IDS.has(id) && !ECONOMICS_LAYER_IDS.has(id))
        );
      }
      return next;
    });
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-dropdown]')) {
        setIsSignUpDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <div className="bg-black w-full overflow-x-hidden">
        <div className="bg-black w-full">
          <div className="relative bg-[#1b1e26]">
            {/* Top right menu and authentication buttons */}
            <div className="absolute top-[20px] right-[65px] flex items-center gap-5 z-40">
              <Button
                onClick={togglePinDropMode}
                className={[
                  "h-[39px] bg-[#06012a] rounded-[29.09px] border border-[#312b7a]",
                  "flex items-center gap-2 font-inter text-white text-[11px] transition-colors",
                  isPinDropMode
                    ? "ring-2 ring-offset-2 ring-[#1ea7ff]/70 ring-offset-[#06012a]"
                    : "",
                ].join(" ")}
                aria-pressed={isPinDropMode}
              >
                <img
                  className="h-[17px] w-[11px] object-contain object-center shrink-0"
                  alt="Drop Pin"
                  src="/figmaAssets/map-pin.png"
                />
                <span>Drop Pin</span>
              </Button>
              <Button
                onClick={handleClearPins}
                disabled={mapPins.length === 0}
                className={[
                  "h-[39px] bg-[#06012a] rounded-[29.09px] border border-[#312b7a]",
                  "flex items-center gap-2 font-inter text-white text-[11px]",
                  mapPins.length === 0
                    ? "opacity-40 cursor-not-allowed"
                    : "hover:bg-[#0a1440]",
                ].join(" ")}
              >
                <img
                  className="w-[16px] h-[16px]"
                  alt="Clear Pins"
                  src="/figmaAssets/x.svg"
                />
                <span>Clear Pins</span>
              </Button>
              {/* Sign Up Button with Dropdown - always visible, matches Login button style */}
              <div className="relative" data-dropdown>
                <Button
                  onClick={toggleSignUpDropdown}
                  className="h-[39px] bg-[#06012a] rounded-[29.09px] border border-[#312b7a] flex items-center gap-2"
                >
                  <img
                    className="w-[22px] h-[17px]"
                    alt="Sign Up"
                    src="/figmaAssets/create-account.svg"
                    style={{ filter: 'brightness(0) saturate(100%) invert(67%) sepia(93%) saturate(1352%) hue-rotate(87deg) brightness(119%) contrast(119%)' }}
                  />
                  <span className="font-inter text-white text-[11px]">{isLoggedIn ? 'Account' : 'Sign Up'}</span>
                </Button>

                {/* Sign Up Dropdown Menu */}
                {isSignUpDropdownOpen && (
                  <div className="absolute top-[45px] right-0 z-50">
                    <div className="bg-gray-700 rounded-lg p-4 w-64 text-white shadow-lg">
                      {/* Sign Up Option */}
                      { !isLoggedIn && (
                      <div
                        className="flex items-center gap-3 mb-3 p-2 hover:bg-gray-600 rounded cursor-pointer transition-colors"
                        onClick={handleSignUpClick}
                      >
                        <img
                          className="w-[18px] h-[18px] opacity-100"
                          alt="Sign Up"
                          src="/figmaAssets/create-account.svg"
                          style={{ filter: 'brightness(0) saturate(100%) invert(67%) sepia(93%) saturate(1352%) hue-rotate(87deg) brightness(119%) contrast(119%)' }}
                        />
                        <span className="text-[10.5px] text-white">Create Account</span>
                      </div>
                      )}

                      {/* User Account Options (when logged in) */}
                      {isLoggedIn && (
                        <>
                          <div className="border-t border-gray-500 my-3"></div>
                          <div className="flex items-center gap-3 mb-4">
                            <img
                              className="w-[13px] h-[16px] opacity-100"
                              alt="User"
                              src="/figmaAssets/user-head.svg"
                            />
                            <div className="min-w-0">
                              {userName && (
                                <p className="text-[10.5px] text-white truncate">{userName}</p>
                              )}
                              <p className="text-[10.5px] text-gray-200 truncate">{userEmail}</p>
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-3 mb-4 p-2 hover:bg-gray-600 rounded cursor-pointer transition-colors"
                            onClick={() => {
                              setIsAccountOpen(true);
                              setIsSignUpDropdownOpen(false);
                            }}
                          >
                            <SettingsIcon className="w-[16px] h-[16px] text-white" />
                            <span className="text-[10.5px] text-white">Account Settings</span>
                          </div>

                          <div
                            className="flex items-center gap-3 mb-4 p-2 hover:bg-gray-600 rounded cursor-pointer transition-colors"
                            onClick={() => {
                              handlePricingClick();
                              setIsSignUpDropdownOpen(false);
                            }}
                          >
                            <img
                              className="w-[13px] h-[16px] opacity-100"
                              alt="Plan"
                              src="/figmaAssets/Plan.svg"
                            />
                            <span className="text-[10.5px] text-white">Plan</span>
                          </div>

                          <div
                            className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-500 p-2 hover:bg-gray-600 rounded cursor-pointer transition-colors"
                            onClick={() => {
                              setIsProfilesOpen(true);
                              setIsSignUpDropdownOpen(false);
                            }}
                          >
                            <UserPlusIcon className="w-[16px] h-[16px] text-white" />
                            <span className="text-[10.5px] text-white">My Profiles</span>
                          </div>

                          <div className="flex items-center gap-3 mb-3 p-2 hover:bg-gray-600 rounded cursor-pointer transition-colors">
                            <img
                              className="w-[18px] h-[18px] opacity-100"
                              alt="Help"
                              src="/figmaAssets/Question.svg"
                            />
                            <span className="text-[10.5px] text-white">Help</span>
                          </div>

                          <div
                            className="flex items-center gap-3 p-2 hover:bg-gray-600 rounded cursor-pointer transition-colors"
                            onClick={() => {
                              handleUserLogout();
                              setIsSignUpDropdownOpen(false);
                            }}
                          >
                            <img
                              className="w-[13px] h-[16px] opacity-100"
                              alt="Logout"
                              src="/figmaAssets/logout.svg"
                            />
                            <span className="text-[10.5px] text-white">Log out</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {/* Login Button */}
              { !isLoggedIn &&
              <Button
                onClick={() => setIsLoginOpen(true)}
                className="h-[39px] bg-[#06012a] rounded-[29.09px] border border-[#312b7a] flex items-center gap-2"
              >
                <img className="w-[22px] h-[17px]" alt="Login" src="/figmaAssets/login.svg" />
                <span className="font-inter text-white text-[11px]">Login</span>
              </Button>
              }

              <button onClick={toggleMenu} className="p-2" aria-label="Open Menu">
                <div className="flex flex-col gap-2 w-[30px] h-[26px] justify-center">
                  <div className={barClass} />
                  <div className={barClass} />
                  <div className={barClass} />
                </div>
              </button>
            </div>


            {/* Slide-out App Menu (your existing modal/drawer) */}
            <SideBarMenu
              isOpen={isMenuOpen}
              onClose={closeMenu}
              onContactClick={handleContactClick}
              onAboutClick={handleAboutClick}
              onNewsletterClick={handleNewsletterClick}
              onPriceClick={handlePricingClick}
            />

            {/* Search overlay */}
            {isSearchOpen && (
              <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setIsSearchOpen(false)} />
            )}
            <SearchPopup
              isOpen={isSearchOpen}
              onClose={() => setIsSearchOpen(false)}
              onLogin={(email, plan, verified) => {
                handleUserLogin(email, plan ?? null, verified ?? false);
                setIsSearchOpen(false);
              }}
              onSwitchToLogin={() => {
                setIsSearchOpen(false);
                setIsLoginOpen(true);
              }}
              onSwitchToSignUp={() => {
                setIsSearchOpen(false);
                setIsSignUpOpen(true);
              }}
            />

            {/* Landing logo / Share button */}
            {showLanding ? (
              <a
                href="/"
                className="absolute top-10 left-20 z-30 inline-flex items-center"
                aria-label="OpenMap home"
              >
                <img
                  src="/figmaAssets/openmap-logo.svg"
                  alt="OpenMap"
                  className="h-[27px] w-auto"
                />
              </a>
            ) : (
              <div
                className="absolute top-[42px] z-30 transition-[left] duration-300"
                style={{ left: sidebarOpen ? 480 : 80 }}
              >
                <Button
                  onClick={() => setIsShareOpen(true)}
                  className="h-[39px] bg-white rounded-[29.09px] border border-[#312b7a] flex items-center gap-2 hover:bg-white"
                >
                  <img className="w-[22px] h-[17px]" alt="Share" src="/figmaAssets/share.svg" />
                  <span className="font-inter text-[#070614] text-[11px] tracking-[0.09em]">Share</span>
                </Button>
              </div>
            )}

            {/* ======= HERO SECTION: full-screen map with slide-in left overlay ======= */}
            <section ref={mapSectionRef} className="relative h-screen w-full overflow-hidden">
              {/* Map layer */}
              <div className="absolute inset-0 z-0">
                <LeafletMap
                  loading={isLoading}
                  setLoading={setLoading}
                  sidebarOffsetPx={sidebarOpen ? SIDEBAR_WIDTH_OPEN : 0}

                  hideInsets={showLanding}
                  pinDropMode={isPinDropMode}
                  pins={mapPins}
                  onPinDrop={handlePinDropped}
                  onPinRemove={handleRemovePin}
                  choroplethMetric={choroplethMetric}
                  showChoropleth={showChoropleth}

                  showPoliceKillingData={showPoliceKillingData}
                  showPoliceShootings={showPoliceShootings}

                  showMurderData={showMurderData}
                  murderCategory={murderCategory}
                  murderAttribute={murderAttribute}

                  arrestCategory={arrestCategory}
                  showArrestData={showArrestData}

                  showMissingPersonsData={showMissingPersonsData}

                  showMassShootings={selectedLayers.includes("mass-shootings")}

                  showConsentAgeData={showConsentAgeData}
                  showArsonData={selectedLayers.includes("arson")}
                  showAlprCameras={selectedLayers.includes("alpr-cameras")}
                  alprFlockOnly={selectedLayers.includes("alpr-flock-only")}
                  showOilSpills={selectedLayers.includes("oil-spills")}
                  showOilDrillingLocations={selectedLayers.includes("oil-drilling-locations")}
                  showNaturalDisasterIncidents={selectedLayers.some((id) => id.startsWith("nd-type:")) || selectedLayers.includes("natural-disaster-incidents")}
                  naturalDisasterIncidentTypes={selectedLayers
                    .filter((id) => id.startsWith("nd-type:"))
                    .map((id) => id.replace("nd-type:", ""))}
                  showHeartDiseaseMortality={selectedLayers.includes("heart-disease")}
                  showNationalRiskIndex={selectedLayers.includes("national-risk-index")}
                  nationalRiskIndexHazard={
                    selectedLayers.find((l) => l.startsWith("nri-hz:"))?.slice("nri-hz:".length) ?? null
                  }
                  stormEventCategory={stormCategoryFromLayers(selectedLayers)}
                  showTornadoes={selectedLayers.includes("ndi-tornado")}
                  showDebrisFlow={selectedLayers.includes("ndi-debris-flow")}
                  showLandslides={selectedLayers.includes("landslides")}
                  showEarthquakes={selectedLayers.includes("earthquakes")}
                  earthquakeMinMagnitude={(() => {
                    const id = selectedLayers.find((l) => l.startsWith("eq-mag:"));
                    return id ? Number(id.slice("eq-mag:".length)) : null;
                  })()}
                  showVolcanoes={selectedLayers.includes("volcanoes")}
                  volcanoMinAlert={
                    selectedLayers.find((l) => l.startsWith("vo-alert:"))?.slice("vo-alert:".length) ?? null
                  }
                  showTsunamis={selectedLayers.includes("tsunamis")}
                  showWildfires={selectedLayers.includes("wildfires")}
                  wildfireMinAcres={(() => {
                    const id = selectedLayers.find((l) => l.startsWith("wf-acres:"));
                    return id ? Number(id.slice("wf-acres:".length)) : null;
                  })()}
                  showDrought={selectedLayers.includes("drought")}
                  droughtCategory={(() => {
                    const id = selectedLayers.find((l) => l.startsWith("dr-cat:"));
                    return id ? Number(id.slice("dr-cat:".length)) : null;
                  })()}
                  showAirQuality={selectedLayers.includes("air-quality")}
                  showPovertyRate={selectedLayers.includes("poverty-rate")}
                  socialPovertyYear={socialPovertyYear}
                  showMedianIncome={selectedLayers.includes("median-income")}
                  medianIncomeYear={medianIncomeYear}
                  showDams={selectedLayers.includes("dams")}
                  selectedDamHazard={selectedDamHazard}
                  selectedDamYear={selectedDamYear}
                  showGroundwaterLevels={selectedLayers.includes("groundwater-levels")}
                  selectedGroundwaterYear={selectedGroundwaterYear}
                  showInvasiveSpecies={selectedLayers.includes("invasive-species")}
                  showInvasivePlants={selectedLayers.includes("invasive-plants")}
                  showInvasiveInsects={selectedLayers.includes("invasive-insects")}
                  showInvasiveMammals={selectedLayers.includes("invasive-mammals")}
                  showInvasiveReptiles={selectedLayers.includes("invasive-reptiles")}
                  showInvasiveBirds={selectedLayers.includes("invasive-birds")}
                  showInvasiveAmphibians={selectedLayers.includes("invasive-amphibians")}
                  selectedInvasiveYear={selectedInvasiveYear}
                  showNoisePollution={selectedLayers.includes("noise-pollution")}
                  showRuralAccess={selectedLayers.includes("rural-access") }
                  showBreastCancerIncidence={selectedLayers.includes("breast-cancer")}
                  ruralAccessYear={ruralAccessYear}
                  onRuralAccessYearChange={setRuralAccessYear}
                  nasaLayerIds={selectedLayers.filter((id) => id.startsWith(NASA_PREFIX))}
                  datasetRanges={datasetRanges}
                  datasetColors={stableDatasetColors}

                  showGHGEmissions={selectedLayers.includes("ghg-emissions")}
                  showWasteTreatmentDisposal={selectedLayers.includes("waste-treatment-disposal")}
                  showDataCenters={selectedLayers.includes("data-centers")}
                  selectedAgeGroupId={selectedAgeGroupId}
                  selectedRaceCensusId={selectedRaceCensusId}
                  selectedSexId={selectedSexId}
                  politicalLayerIds={politicalLayerIds}
                  houseDistrictPartyMode={houseDistrictPartyMode}
                  healthMetricId={healthMetricId}
                  showBillionaires={selectedLayers.includes("billionaires")}
                  showIncome={selectedLayers.includes("income")}
                  showHighIncomeHouseholds={selectedLayers.includes("high-income-households")}
                  showUnemployment={selectedLayers.includes("unemployment")}
                  showPoverty={selectedLayers.includes("poverty-stricken-areas")}
                  povertyYear={povertyYear}
                  povertyAvailableYears={povertyAvailableYears}
                  onPovertyDataMeta={handlePovertyDataMeta}
                  showSplcHateMap={selectedLayers.includes("most-racist")}
                  timelineRange={timelineRange}
                  onDateRangeChange={handleDatasetDateRangeChange}
                  timelineVisible={timelineTracks.length > 0}
                  rightRailAd={
                    railAdActive && !showLanding && !sidebarOpen ? (
                      <div className="map-rail-ad-card">
                        <VideoAd showLabel className="rounded-md bg-white/5 p-2" style={{ minHeight: 280 }} />
                      </div>
                    ) : undefined
                  }
                />
              </div>

              {timelineTracks.length > 0 && (
                <MapTimeline
                  tracks={timelineTracks}
                  onChange={handleTimelineChange}
                  className="fixed bottom-5 right-5 z-[3000] w-[min(24rem,calc(100vw-2.5rem))]"
                />
              )}

              {/* Landing content overlay (full screen) */}
              {showLanding && (
                <>
                  <div className="absolute inset-y-0 left-0 w-full z-10 pointer-events-none">
                    <div className="absolute inset-0 bg-[#041026] opacity-70" />
                    <img
                      src="/figmaAssets/output-onlinepngtools.png"
                      alt=""
                      className="absolute bottom-[-400px] left-[0px] w-[100%] max-w-none opacity-100 z-10"
                      style={{ filter: 'hue-rotate(200deg) saturate(1.2) brightness(1.1)' }}
                    />
                    <img
                      src="/figmaAssets/LandingPage2.png"
                      alt=""
                      className="absolute bottom-[-700px] left-[-190px] w-[80%] max-w-none opacity-100 mix-blend-screen rotate-[40deg] scale-x-[-1] z-10"
                      style={{ filter: 'hue-rotate(200deg) saturate(1.2) brightness(1.1)' }}
                    />
                  </div>
                  <div className="absolute inset-y-0 left-0 w-full z-20">
                    <div className="h-full w-full bg-gradient-to-r from-[#0c1022]/95 via-[#0c1022]/85 to-transparent" />
                    <div className="absolute top-28 left-14 sm:left-28 max-w-2xl pr-6">
                      <h1 className="font-extrabold tracking-tight text-white text-[27px] sm:text-[36px] md:text-[45px] leading-tight">
                        <span className="block whitespace-nowrap">
                          SHINING LIGHT ON <span className="text-[#ff2d2d]">AMERICA'S</span>
                        </span>
                        <span className="block whitespace-nowrap">HIDDEN TRUTHS, ONE MAP.</span>
                      </h1>
                      <p className="mt-6 text-white/80 text-[14px] max-w-xl">
                        From crime to housing, <span className="text-white font-semibold">OpenMap</span> reveals the facts shaping your community and the nation.
                      </p>
                      <button
                        onClick={() => {
                          setShowLanding(false);
                          setSidebarOpen(true);
                        }}
                        className="mt-8 inline-flex items-center px-6 py-3 rounded-full bg-[#1ea7ff] hover:bg-[#1296ea] text-[#ffffff] font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-white/30"
                      >
                        Explore
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* RIGHT-SIDE AD RAIL on the landing screen. On the map itself the same unit sits in the
                  map's right column under the legends (LeafletMap rightRailAd), so they never overlap. */}
              {railAdActive && showLanding && (
                <aside
                  aria-label="Sponsored"
                  className={[
                    "hidden lg:flex flex-col gap-4",
                    "absolute top-28 right-6 z-30",
                    "w-[344px] max-h-[calc(100vh-160px)] overflow-y-auto",
                    "rounded-xl border border-white/15 bg-[#0c1022]/70 backdrop-blur-sm",
                    "p-3 shadow-2xl pointer-events-auto",
                  ].join(" ")}
                >
                  <VideoAd
                    showLabel
                    className="bg-white/5 rounded-md p-2"
                    style={{ minHeight: 280 }}
                  />
                </aside>
              )}

              {/* LEFT OVERLAY SIDEBAR (Slides) */}
              <aside
                className={[
                  "fixed top-0 left-0 h-screen w-[430px]",
                  "bg-[#0c1022]/80 backdrop-blur-sm text-white/90",
                  "border-r border-white/10 shadow-xl",
                  "z-30 overflow-y-auto overflow-x-hidden",
                  "transition-transform duration-300 will-change-transform",
                  "sidebar-scroll",
                  sidebarOpen ? "translate-x-0" : "-translate-x-full",
                ].join(" ")}
                aria-hidden={!sidebarOpen}
                aria-label="Filters and categories"
              >
                <NavigationMenuSection
                  searchQuery={searchQuery}
                  setSearchQuery={setSearchQuery}
                  handleSearchTrigger={handleSearchTrigger}
                  choroplethMetric={choroplethMetric}
                  onChoroplethMetricChange={setChoroplethMetric}
                  showChoropleth={showChoropleth}
                  onToggleChoropleth={handleTogglePopulationChoropleth}

                  showPoliceKillingData={showPoliceKillingData}
                  onTogglePoliceKillingData={() => setShowPoliceKillingData((v) => !v)}
                  showPoliceShootings={showPoliceShootings}
                  onTogglePoliceShootings={() => setShowPoliceShootings((v) => !v)}

                  showMurderData={showMurderData}
                  murderCategory={murderCategory}
                  setMurderCategory={setMurderCategory}
                  murderAttribute={murderAttribute}
                  setMurderAttribute={setMurderAttribute}
                  onToggleMurderData={() => setShowMurderData((v) => !v)}

                  showArrestData={showArrestData}
                  arrestCategory={arrestCategory}
                  setArrestCategory={setArrestCategory}
                  onToggleArrestData={() => setShowArrestData((v) => !v)}
                  onSetChoroplethActive={setShowChoropleth}

                  showMissingPersonsData={showMissingPersonsData}
                  onToggleMissingPersonsData={() => setShowMissingPersonsData((v) => !v)}

                  showConsentAgeData={showConsentAgeData}
                  onToggleConsentAgeData={() => setShowConsentAgeData((v) => !v)}
                  selectedAgeGroupId={selectedAgeGroupId}
                  onSelectedAgeGroupChange={setSelectedAgeGroupId}
                  selectedRaceCensusId={selectedRaceCensusId}
                  onSelectedRaceCensusIdChange={setSelectedRaceCensusId}
                  selectedSexId={selectedSexId}
                  onSelectedSexIdChange={setSelectedSexId}

                  selectedLayers={selectedLayers}
                  onLayerToggle={handleLayerToggle}
                  selectedDamHazard={selectedDamHazard}
                  socialPovertyYear={socialPovertyYear}
                  onSocialPovertyYearChange={setSocialPovertyYear}
                  medianIncomeYear={medianIncomeYear}
                  onMedianIncomeYearChange={setMedianIncomeYear}
                  onSelectedDamHazardChange={setSelectedDamHazard}
                  selectedDamYear={selectedDamYear}
                  onSelectedDamYearChange={setSelectedDamYear}

                  selectedInvasiveYear={selectedInvasiveYear}
                  onSelectedInvasiveYearChange={setSelectedInvasiveYear}
                  selectedGroundwaterYear={selectedGroundwaterYear}
                  onSelectedGroundwaterYearChange={setSelectedGroundwaterYear}
                  povertyYear={povertyYear}
                  povertyLatestYear={povertyLatestYear}
                  povertyAvailableYears={povertyAvailableYears}
                  onPovertyYearChange={setPovertyYear}
                  politicalLayerIds={politicalLayerIds}
                  onPoliticalLayerToggle={handlePoliticalLayerToggle}
                  houseDistrictPartyMode={houseDistrictPartyMode}
                  onHouseDistrictPartyModeChange={setHouseDistrictPartyMode}
                  onResetAllFilters={handleResetAllFilters}
                />
                {/* Sidebar ad slots (banner + video). Hidden for premium users. */}
                {shouldShowAds && (
                  <MonetagAd
                    zoneId="12248955"
                    scriptSrc="https://n6wxm.com/vignette.min.js"
                  />
                )}
              </aside>

              {/* TOGGLE BUTTON */}
              {!showLanding && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen((s) => !s)}
                  aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                  className={[
                    "fixed top-24 z-40",
                    "transition-all duration-300",
                    sidebarOpen ? "left-[438px]" : "left-4",
                    "rounded-full border border-white/10 bg-[#0c1022]/90 text-white",
                    "hover:bg-[#122041]/90 shadow-lg",
                    "h-10 w-10 grid place-items-center",
                    "focus:outline-none focus:ring-2 focus:ring-white/30",
                  ].join(" ")}
                >
                  {sidebarOpen ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
                </button>
              )}
            </section>
            {/* ======= END HERO ======= */}

            {/* Fixed bottom banner ad (hidden on landing screen and for premium users). While the
                timeline is open it ends left of the timeline panel instead of running under it. */}
            {!showLanding && bannerAdActive && !sidebarOpen && (
              <div
                className="fixed bottom-0 left-0 z-30 pointer-events-none flex justify-center pb-2 px-4"
                style={{ right: timelineTracks.length > 0 ? "calc(min(24rem, 100vw - 2.5rem) + 1.25rem)" : 0 }}
              >
                <div className="pointer-events-auto bg-[#0c1022]/85 backdrop-blur-sm border border-white/10 rounded-lg shadow-xl max-w-[900px] w-full p-2">
                  <BannerAd showLabel />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      {isPricingOpen && (
        <PricingCards
          isOpen={isPricingOpen}
          onClose={() => setIsPricingOpen(false)}
          isLoggedIn={isLoggedIn}
          isVerified={isVerified}
          userEmail={userEmail}
          currentPlan={currentPlan}
          onRequireAuth={handleRequirePlanAuth}
          onPlanChanged={setCurrentPlan}
          onFreeTrial={() => {
            setIsPricingOpen(false);
            setIsSignUpOpen(true);
          }}
        />
      )}

      {/* CONTACT US FORM MODAL */}
      {isContactOpen && <ContactUsform isOpen={isContactOpen} onClose={() => setIsContactOpen(false)} />}

      {/* ABOUT US MODAL */}
      {isAboutOpen && <AboutUsModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />}

      {/* Newsletter Popup */}
      {isNewsletterPopupOpen && (
        <NewsletterPopup isOpen={isNewsletterPopupOpen} onClose={() => setIsNewsletterPopupOpen(false)} />
      )}

      {/* Loading Popup */}
      {isLoading && (
        <LoadingBar isOpen={isLoading} onClose={() => setLoading(false)} />
      )}

      {/* Share Popup */}
      <SharePopup
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        mapContainerRef={mapSectionRef}
      />

      {/* Saved Map Profiles */}
      {isProfilesOpen && (
        <Profiles
          isOpen={isProfilesOpen}
          onClose={() => setIsProfilesOpen(false)}
          getCurrentConfig={getCurrentConfig}
          onLoadProfile={applyConfig}
          planLabel={currentPlan}
        />
      )}

      {/* Account Settings */}
      {isAccountOpen && (
        <AccountSettings
          isOpen={isAccountOpen}
          onClose={() => setIsAccountOpen(false)}
          onOpenPlans={() => setIsPricingOpen(true)}
          onAccountUpdated={applyAccount}
          onAccountDeleted={handleUserLogout}
        />
      )}

      {/* Confirmation screen for the "change email" link */}
      {isEmailChangeOpen && (
        <EmailChangeVerification
          isOpen={isEmailChangeOpen}
          onClose={() => setIsEmailChangeOpen(false)}
          onConfirmed={(email) => setUserEmail(email)}
        />
      )}

      {/* Sign Up Modal */}
      {isSignUpOpen && (
        <SignUp
          isOpen={isSignUpOpen}
          onClose={() => setIsSignUpOpen(false)}
          onLogin={(email, plan, verified) => {
            handleUserLogin(email, plan ?? null, verified ?? false);
            setIsLoginOpen(false);
          }}
          onSwitchToLogin={() => setIsLoginOpen(true)}
        />
      )}

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <ForgotPassword
          isOpen={isForgotPasswordOpen}
          onClose={() => setIsForgotPasswordOpen(false)}
          onSwitchToSignUp={() => setIsSignUpOpen(true)}
        />
      )}

      {/* Login Modal */}
      {isLoginOpen && (
        <Login
          isOpen={isLoginOpen}
          onClose={() => {
            setIsLoginOpen(false);
            setPendingPlan(null);
          }}
          onLogin={(email, plan, verified) => {
            handleUserLogin(email, plan ?? null, verified ?? false);
            setIsLoginOpen(false);
          }}
          onSwitchToSignUp={() => setIsSignUpOpen(true)}
          onSwitchToForgot={() => setIsForgotPasswordOpen(true)}
        />
      )}
      {/* Verify Modal */}
      {isVerifyOpen && (
        <Verify
          isOpen={isVerifyOpen}
          onClose={() => setIsVerifyOpen(false)}
          onLogin={(email) => {
            // Reaching this callback means the email was just verified.
            handleUserLogin(email, null, true);
            setIsVerifyOpen(false);
          }}
        />
      )}
      {/* Password Reset Modal */}
      {isResetOpen && (
        <Reset
          isOpen={isResetOpen}
          onClose={() => setIsResetOpen(false)}
        />
      )}
    </>
  );
}
