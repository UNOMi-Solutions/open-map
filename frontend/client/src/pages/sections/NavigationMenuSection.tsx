import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  CHOROPLETH_METRICS,
  ChoroplethMetricKey,
  HouseDistrictPartyMode,
} from "@/components/ui/LeafletMap";

import { PoliceKillingQKey } from "@/components/ui/PoliceKillings";
import { CENSUS_AGE_GROUPS } from "@/lib/census-age-groups";

interface NavigationMenuSectionProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  handleSearchTrigger: () => void;
  choroplethMetric: ChoroplethMetricKey;
  onChoroplethMetricChange: (value: ChoroplethMetricKey) => void;
  showChoropleth: boolean;
  onToggleChoropleth: () => void;

  showPoliceKillingData: boolean;
  onTogglePoliceKillingData: () => void;
  PoliceKillingQ: PoliceKillingQKey;
  onPoliceKillingQChange: (value: PoliceKillingQKey) => void;
  PoliceKillingYear: number;
  onPoliceKillingYearChange: (value: number) => void;

  showMurderData: boolean;
  murderCategory: string;
  setMurderCategory: (value: string) => void;
  murderAttribute: string;
  setMurderAttribute: (value: string) => void;
  onToggleMurderData: () => void;

  showArrestData: boolean;
  arrestCategory: string;
  setArrestCategory: (value: string) => void;
  onToggleArrestData: () => void;
  onSetChoroplethActive: (active: boolean) => void;

  showMissingPersonsData: boolean;
  onToggleMissingPersonsData: () => void;
  missingPersonQ: string;
  onMissingPersonQChange: (value: string) => void;
  missingPersonYear: number;
  onMissingPersonYearChange: (value: number) => void;

  showConsentAgeData: boolean;
  onToggleConsentAgeData: () => void;
  selectedLayers?: string[];
  onLayerToggle?: (layerId: string, checked: boolean) => void;
  selectedAgeGroupId: string | null;
  onSelectedAgeGroupChange: (ageGroupId: string | null) => void;
  selectedRaceCensusId: string;
  onSelectedRaceCensusIdChange: (id: string) => void;
  selectedSexId: string | null;
  onSelectedSexIdChange: (id: string | null) => void;

  politicalLayerIds: string[];
  onPoliticalLayerToggle: (layerId: string, checked: boolean) => void;
  houseDistrictPartyMode: HouseDistrictPartyMode;
  onHouseDistrictPartyModeChange: (mode: HouseDistrictPartyMode) => void;
  onResetAllFilters: () => void;
}

export const NavigationMenuSection = ({ 
  searchQuery, 
  setSearchQuery, 
  handleSearchTrigger,
  choroplethMetric,
  onChoroplethMetricChange,
  showChoropleth,
  onToggleChoropleth,

  showPoliceKillingData,
  onTogglePoliceKillingData,
  PoliceKillingQ,
  onPoliceKillingQChange,
  PoliceKillingYear,
  onPoliceKillingYearChange,

  showMurderData,
  murderCategory,
  setMurderCategory,
  murderAttribute,
  setMurderAttribute,
  onToggleMurderData,

  showArrestData,
  arrestCategory,
  setArrestCategory,
  onToggleArrestData,
  onSetChoroplethActive,

  showMissingPersonsData,
  onToggleMissingPersonsData,
  missingPersonQ,
  onMissingPersonQChange,
  missingPersonYear,
  onMissingPersonYearChange,

  showConsentAgeData,
  onToggleConsentAgeData,
  selectedLayers = [],
  onLayerToggle,
  selectedAgeGroupId,
  onSelectedAgeGroupChange,
  selectedRaceCensusId,
  onSelectedRaceCensusIdChange,
  selectedSexId,
  onSelectedSexIdChange,
  politicalLayerIds,
  onPoliticalLayerToggle,
  houseDistrictPartyMode,
  onHouseDistrictPartyModeChange,
  onResetAllFilters,
}: NavigationMenuSectionProps): JSX.Element => {
  // Category data for Environment section
  const environmentItems = [
    { id: "oil-spills", label: "Oil Spills" },
    { id: "data-centers", label: "Data Centers" },
    { id: "natural-disaster-incidents", label: "Natural Disaster Incidents" },
    { id: "air-quality", label: "Air Quality" },
    { id: "ghg-emissions", label: "GHG Emissions" },
    { id: "waste-treatment-disposal", label: "Waste Treatment & Disposal" },
    // { id: "toxic-spills", label: "Toxic Spills" },
    // { id: "toxic-area", label: "Toxic Area" },
  ];

  // Sub-filters for Natural Disaster Incidents (matches backend incident types)
  const naturalDisasterIncidentTypes = [
    { id: "nd-type:Flood", label: "Flood" },
    { id: "nd-type:Fire", label: "Fire" },
    { id: "nd-type:Hurricane", label: "Hurricane" },
    { id: "nd-type:Tornado", label: "Tornado" },
    { id: "nd-type:Severe Storm", label: "Severe Storm" },
    { id: "nd-type:Winter Storm", label: "Winter Storm" },
    { id: "nd-type:Earthquake", label: "Earthquake" },
    { id: "nd-type:Tropical Storm", label: "Tropical Storm" },
    { id: "nd-type:Coastal Storm", label: "Coastal Storm" },
    { id: "nd-type:Snowstorm", label: "Snowstorm" },
    { id: "nd-type:Severe Ice Storm", label: "Severe Ice Storm" },
    { id: "nd-type:Mud/Landslide", label: "Mud/Landslide" },
    { id: "nd-type:Dam/Levee Break", label: "Dam/Levee Break" },
    { id: "nd-type:Straight-Line Winds", label: "Straight-Line Winds" },
    { id: "nd-type:Tropical Depression", label: "Tropical Depression" },
    { id: "nd-type:Biological", label: "Biological" },
    { id: "nd-type:Other", label: "Other" },
  ];

  // Health category items (checkbox state via selectedLayers; map layers not wired yet)
  const healthItems = [
    { id: "heart-disease", label: "Heart Disease" },
    { id: "cancer", label: "Cancer" },
    { id: "breast-cancer", label: "Breast Cancer" },
    { id: "diabetes", label: "Diabetes" },
    // { id: "pre-diabetic", label: "Pre-diabetic" },
    { id: "colon-cancer", label: "Colon Cancer" },
    // { id: "prostate-cancer", label: "Prostate Cancer" },
    // { id: "aids", label: "AIDS" },
    // { id: "hiv", label: "HIV" },
    // { id: "std", label: "STD" },
    { id: "obesity", label: "Obesity" },
    // { id: "smallpox", label: "Small Pox" },
    // { id: "covid-19", label: "Covid 19" },
    { id: "lung-cancer", label: "Lung Cancer" },
    { id: "kidney-disease", label: "Kidney Disease" },
    { id: "smokers", label: "Smokers" },
    // { id: "cannabis-smokers", label: "Cannabis Smokers" },
    // { id: "illegal-hard-drug-use", label: "Illegal/Hard drug use" },
    // { id: "healthy-eating", label: "Healthy eating" },
    { id: "alcoholism", label: "Alcoholism" },
    // { id: "drug-addiction", label: "Drug addiction" },
    { id: "mental-health", label: "Mental Health" },
    { id: "best-healthcare-coverage", label: "Best healthcare coverage" },
    { id: "worst-healthcare-coverage", label: "Worst Healthcare Coverage" },
    { id: "most-out-of-shape-population", label: "Most out of shape population" },
    { id: "healthiest-population", label: "Healthiest Population" },
  ];

  // Real Estate filter options
  const realEstateFilters = [
    { id: "city", label: "City" },
    { id: "county", label: "County" },
    { id: "state", label: "State" },
  ];

  // Real Estate category items
  const realEstateItems = [
    { id: "safest", label: "Safest" },
    { id: "most-crime", label: "Most Crime" },
    { id: "healthiest-environment", label: "Healthiest Environment" },
    { id: "wealthiest", label: "Wealthiest" },
    { id: "disenfranchised", label: "Disenfranchised" },
  ];

  /** Social tab: layer id matches MainPage / SPLC choropleth wiring (`most-racist`). */
  const socialMapItems = [
    {
      id: "most-racist",
      label: "SPLC hate & antigovernment groups (by state HQ)",
    },
  ];

  // Census category items
  const censusItems = [
    { id: "all", label: "All" },
    { id: "black", label: "Black" },
    { id: "latin-hispanic", label: "Latin/ Hispanic" },
    { id: "white", label: "White" },
    { id: "asian", label: "Asian" },
    { id: "east-asian", label: "East Asian" },
    { id: "arab", label: "Arab" },
  ];

  // Sex category items (separate subcategory like age)
  const censusSexItems = [
    { id: "male", label: "Male" },
    { id: "female", label: "Female" },
  ];

  // Crime items
  const crimeItems = [
    // { id: "homicide", label: "Homicide"},
    // { id: "arrests", label: "Arrests" }
  ];

  const politicalTopics = [
    { id: "senators", label: "Senators" },
    // { id: "mayors", label: "Mayors" },
    { id: "house", label: "House of Representatives" },
    // { id: "supreme-court", label: "Supreme Court" },
    { id: "president", label: "President" },
    { id: "vice-president", label: "Vice President" },
    // { id: "governors", label: "Governors" },
    { id: "gerrymandering", label: "Jerry Mandering" },
    { id: "red-blue-district", label: "Red/Blue district (House of Representatives)" },
    { id: "electoral-college", label: "Electoral College (by state)" },
  ];

  const wiredPoliticalMapIds = new Set([
    "senators",
    "governors",
    "president",
    "vice-president",
    "house",
    "supreme-court",
    "gerrymandering",
    "red-blue-district",
    "electoral-college",
  ]);
  const unwiredPoliticalSelections = politicalLayerIds.filter(
    (id) => !wiredPoliticalMapIds.has(id)
  );

  // Collapsed categories
  const collapsedCategories = [
    // { id: "crime", label: "Crime" },
    { id: "police", label: "Police" },
    { id: "health", label: "Health" },
    { id: "economics", label: "Economics" },
    { id: "social", label: "Social" },
    { id: "politics", label: "Politics" },
  ];
  const metricEntries = Object.entries(
    CHOROPLETH_METRICS
  ) as Array<[ChoroplethMetricKey, { label: string; unit: "%" | "yrs" }]>;
  const censusMetricMap: Record<string, ChoroplethMetricKey | null> = {
    all: null,
    white: "pct_white",
    "latin-hispanic": "pct_hispanic",
    black: "pct_black",
    asian: "pct_asian",
    "east-asian": "pct_east_asian",
    arab: "pct_arab",
  };

  const metricToCensusId: Record<ChoroplethMetricKey, string> = {
    pct_white: "white",
    pct_hispanic: "latin-hispanic",
    pct_black: "black",
    pct_asian: "asian",
    pct_east_asian: "east-asian",
    pct_arab: "arab",
    pct_male: "male",
    pct_female: "female",
    median_age: "all",
  };
  const activeCensusId = showChoropleth
    ? metricToCensusId[choroplethMetric]
    : "all";

  /** One category active at a time: gray out others when one is selected */
  const hasRaceSelection = selectedRaceCensusId !== "all";
  const hasAgeSelection = selectedAgeGroupId != null;
  const hasSexSelection = selectedSexId != null;
  const raceSectionDisabled = hasAgeSelection || hasSexSelection;
  const ageSectionDisabled = hasRaceSelection || hasSexSelection;
  const sexSectionDisabled = hasRaceSelection || hasAgeSelection;

  return (
    <div className="absolute inset-0 w-full">
      <div className="absolute inset-0 bg-[#06012A]/80 pointer-events-none" />
      <div className="relative z-10">
      {/* OpenMap Logo */}
      <div className="flex justify-center pt-7">
        <img
          className="h-[35px] w-[175px] object-contain"
          alt="OpenMap Logo"
          src="/figmaAssets/openmap-logo.svg"
        />
      </div>

      {/* Search input */}
      <div className="mt-8 flex items-center justify-center gap-4">
        <Input
          className="h-9 w-[258px] bg-white text-black border border-white"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "Return") {
              e.preventDefault();
              e.stopPropagation();
              handleSearchTrigger();
            }
          }}
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            handleSearchTrigger();
          }}
        >
          <img
            className="w-[20px] h-[20px] filter brightness-0 invert"
            alt="Search"
            src="/figmaAssets/text.svg"
          />
        </button>
      </div>

      <div className="mt-12 px-12 overflow-y-auto overscroll-contain">
        <h2 className="text-[17px] text-white font-semibold font-futura leading-[100%] text-center">
          Search Categories
        </h2>

        <div className="mt-4 flex flex-col items-center gap-2.5">
          <div className="flex items-center justify-center gap-0">
            <Checkbox
              id="hide-unused"
              className="h-4 w-4 border border-white/70 bg-white/10 text-white"
            />
            <label
              htmlFor="hide-unused"
              className="ml-0 pl-2 text-white text-[12px] font-normal font-futura leading-[100%]"
            >
              Hide Unused Tabs
            </label>
          </div>
          <button
            type="button"
            onClick={onResetAllFilters}
            className="text-white text-[12px] font-normal font-futura leading-[100%] border border-white/40 rounded-md px-3 py-1.5 hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/40"
          >
            Reset all filters
          </button>
        </div>
      {/* Scrollable accordion area */}
      <div 
        className="mt-8 ml-6 mr-6 pr-4 overflow-y-auto overscroll-contain"
        style={{ maxHeight: "calc(100vh - 260px)" }}
      >
        <Accordion type="multiple" className="w-full">
        <AccordionItem value="environment" className="border-0">
          <AccordionTrigger className="py-3 hover:no-underline accordion-trigger">
            <div className="flex items-center">
              <ChevronRight className="accordion-arrow" />
              <span className="text-[20.15px] text-white font-normal font-futura leading-[100%]">
                Environment
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-0">
            <div className="ml-4">
              {environmentItems.map((item) => (
                <div key={item.id}>
                  <div className="flex items-center mt-1.5">
                    <Checkbox
                      id={item.id}
                      className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                      checked={selectedLayers.includes(item.id)}
                      onCheckedChange={(checked) => onLayerToggle?.(item.id, checked === true)}
                    />
                    <label
                      htmlFor={item.id}
                      className="ml-[15px] text-white text-[12px] font-normal leading-[100%] [font-family:'Futura PT']"
                    >
                      {item.label}
                    </label>
                  </div>
                  {/* Sub-filters for Natural Disaster Incidents – show only when layer is enabled */}
                  {item.id === "natural-disaster-incidents" && selectedLayers.includes("natural-disaster-incidents") && (
                    <div className="ml-6 mt-2 mb-2">
                      <span className="text-white/70 text-[11px] block mb-1 [font-family:'Futura PT']">
                        Filter by type:
                      </span>
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {naturalDisasterIncidentTypes.map((sub) => (
                          <div key={sub.id} className="flex items-center mt-0.5">
                            <Checkbox
                              id={sub.id}
                              className="h-3.5 w-3.5 border border-white/60 bg-white/10 text-white"
                              checked={selectedLayers.includes(sub.id)}
                              onCheckedChange={(checked) => onLayerToggle?.(sub.id, checked === true)}
                            />
                            <label
                              htmlFor={sub.id}
                              className="ml-2 text-white/90 text-[11px] leading-[100%] [font-family:'Futura PT']"
                            >
                              {sub.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="crime" className="border-0">
          <AccordionTrigger className="py-3 hover:no-underline accordion-trigger">
            <div className="flex items-center">
              <ChevronRight className="accordion-arrow" />
              <span className="text-[20.15px] text-white font-normal font-futura leading-[100%]">
                Crime
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-0">
            <div className="ml-4">
              <div className="mt-2 flex items-center left">
                <Checkbox
                  id="murder-data"
                  checked={showMurderData}
                  onCheckedChange={() =>
                    onToggleMurderData()
                  }                  
                  className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                />

                <span className="ml-[15px] text-white text-[12px] font-normal leading-[100%] [font-family:'Futura_PT_Book]">
                  Homicide
                </span>
                
              </div>

                  { (showMurderData) ? <>
                  <select
                    className="w-full max-w-[240px] rounded-md border border-white/70 bg-white/10 text-white text-[11px] px-2 py-1 mt-2 outline-none focus:ring-1 focus:ring-white/40 focus:border-white"
                    onChange={(e) => {
                        setMurderCategory(
                          e.target.value as string
                        );
                        if(e.target.value == "offense") {
                          setMurderAttribute("weapons");
                        } else {
                          setMurderAttribute("age");
                        }
                      }
                    }
                  >
                      <option className="text-black" value="victim">
                        Victim
                      </option>
                      <option className="text-black" value="offender">
                        Offender
                      </option>
                      <option className="text-black" value="offense">
                        Offense
                      </option>
                  </select>

                  <select
                    className="w-full max-w-[240px] rounded-md border border-white/70 bg-white/10 text-white text-[11px] px-2 py-1 mt-2 outline-none focus:ring-1 focus:ring-white/40 focus:border-white"
                    onChange={(e) =>
                      setMurderAttribute(
                        e.target.value as string
                      )
                    }
                  >

                      { (murderCategory != "offense") ? 
                      <>
                        <option className="text-black" value="age">
                          Age
                        </option>
                        <option className="text-black" value="race">
                          Race
                        </option>
                        <option className="text-black" value="sex">
                          Sex
                        </option>
                        <option className="text-black" value="ethnicity">
                          Ethnicity
                        </option>
                      </>
                   : <>
                        <option className="text-black" value="weapons">
                          Weapons
                        </option>
                        <option className="text-black" value="circumstance">
                          Circumstance
                        </option>
                        <option className="text-black" value="relationship">
                          Relationship
                        </option>
                   </> }

                  </select>
                  </> : null }
            </div>

            <div className="ml-4">
              <div className="mt-2 flex items-center left">
                <Checkbox
                  id="arrest-data"
                  checked={showArrestData}
                  onCheckedChange={() =>
                    onToggleArrestData()
                  }                  
                  className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                />

                <span className="ml-[15px] text-white text-[12px] font-normal leading-[100%] [font-family:'Futura_PT_Book]">
                  Arrests
                </span>
              </div>
                 { (showArrestData) ? <select
                    className="w-full max-w-[240px] rounded-md border border-white/70 bg-white/10 text-white text-[11px] px-2 py-1 outline-none focus:ring-1 focus:ring-white/40 focus:border-white mt-2"
                    onChange={(e) =>
                      setArrestCategory(
                        e.target.value as string
                      )
                    }
                  >
                      <option className="text-black" value="Arrestee Sex">
                        Arrestee Sex
                      </option>
                      <option className="text-black" value="Offense Name">
                        Offense Name
                      </option>
                      <option className="text-black" value="Offense Category">
                        Offense Category
                      </option>
                      <option className="text-black" value="Offense Breakdown">
                        Offense Breakdown
                      </option>
                      <option className="text-black" value="Male Arrests By Age">
                        Male Arrests By Age
                      </option>
                      <option className="text-black" value="Female Arrests By Age">
                        Female Arrests By Age
                      </option>
                  </select> : null }
            </div>

            <div className="ml-4">
              <div className="mt-2 flex items-center left">
                <Checkbox
                  id="missing-persons-data"
                  checked={showMissingPersonsData}
                  onCheckedChange={() =>
                    onToggleMissingPersonsData()
                  }                  
                  className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                />

                <label className="ml-[15px] text-white text-[12px] font-normal leading-[100%] [font-family:'Futura_PT_Book]">
                  Missing Persons
                </label>
              </div>

              {
                (showMissingPersonsData) ? <>
                  <label className="mt-2 block text-[11px] text-white/80">
                    Year
                  </label>
                  <select
                    className="w-full max-w-[240px] rounded-md border border-white/70 bg-white/10 text-white text-[11px] px-2 py-1 mt-2 outline-none focus:ring-1 focus:ring-white/40 focus:border-white"
                    onChange={(e) => {
                      onMissingPersonYearChange(
                        parseInt(e.target.value)
                      )
                    }}
                  >
                    {Array.from(
                      { length: new Date().getFullYear() - 2013 + 1 },
                      (_, i) => {
                        const year = 2013 + i;
                        return (
                          <option className="text-black" key={year} value={year}>
                            {year}
                          </option>
                        );
                      }
                    ).reverse()}
                  </select>
              
                  <select
                    className="w-full max-w-[240px] rounded-md border border-white/70 bg-white/10 text-white text-[11px] px-2 py-1 mt-2 outline-none focus:ring-1 focus:ring-white/40 focus:border-white"
                    onChange={(e) =>
                      onMissingPersonQChange(
                        e.target.value as unknown as string
                      )
                    }
                  >
                      <option className="text-black" value="Q1">
                        Q1
                      </option>
                      <option className="text-black" value="Q2">
                        Q2
                      </option>
                      <option className="text-black" value="Q3">
                        Q3
                      </option>
                      <option className="text-black" value="Q4">
                        Q4
                      </option>
                  </select>
                </> : null
                
              }    

            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="police" className="border-0">
          <AccordionTrigger className="py-3 hover:no-underline accordion-trigger">
            <div className="flex items-center">
              <ChevronRight className="accordion-arrow" />
              <span className="text-[20.15px] text-white font-normal font-futura leading-[100%]">
                Police
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-0">
            <div className="ml-4">
              <div className="mt-2 flex items-center left">
                <Checkbox
                  id="police-killings"
                  checked={showPoliceKillingData}
                  onCheckedChange={() =>
                    onTogglePoliceKillingData()
                  }                  
                  className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                />

                <span className="ml-[15px] text-white text-[12px] font-normal leading-[100%] [font-family:'Futura_PT_Book]">
                  Police Killings
                </span>
              </div>
              {
                (showPoliceKillingData) ? <>
                  <label className="mt-2 block text-[11px] text-white/80">
                    Year
                  </label>
                  <select
                    className="w-full max-w-[240px] rounded-md border border-white/70 bg-white/10 text-white text-[11px] px-2 py-1 mt-2 outline-none focus:ring-1 focus:ring-white/40 focus:border-white"
                    onChange={(e) => {
                      onPoliceKillingYearChange(
                        e.target.value as unknown as number
                      )
                    }}
                  >
                    {Array.from(
                      { length: new Date().getFullYear() - 2013 + 1 },
                      (_, i) => {
                        const year = 2013 + i;
                        return (
                          <option className="text-black" key={year} value={year}>
                            {year}
                          </option>
                        );
                      }
                    ).reverse()}
                  </select>
              
                  <select
                    className="w-full max-w-[240px] rounded-md border border-white/70 bg-white/10 text-white text-[11px] px-2 py-1 mt-2 outline-none focus:ring-1 focus:ring-white/40 focus:border-white"
                    onChange={(e) =>
                      onPoliceKillingQChange(
                        e.target.value as PoliceKillingQKey
                      )
                    }
                  >
                      <option className="text-black" value="Q1">
                        Q1
                      </option>
                      <option className="text-black" value="Q2">
                        Q2
                      </option>
                      <option className="text-black" value="Q3">
                        Q3
                      </option>
                      <option className="text-black" value="Q4">
                        Q4
                      </option>
                  </select>
                </> : null
                
              }
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="social" className="border-0">
          <AccordionTrigger className="py-3 hover:no-underline accordion-trigger">
            <div className="flex items-center">
              <ChevronRight className="accordion-arrow" />
                <span className="text-[20.15px] text-white font-normal font-futura leading-[100%]">
                  Social
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-0">
            <div className="ml-4">
              <div className="mt-2 flex items-center left">
                <Checkbox
                  id="consent-age"
                  checked={showConsentAgeData}
                  onCheckedChange={() =>
                    onToggleConsentAgeData()
                  }                  
                  className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                />

                <span className="ml-[15px] text-white text-[12px] font-normal leading-[100%] [font-family:'Futura_PT_Book]">
                  Age of Consent
                </span>
              </div>

              {socialMapItems.map((item) => (
                <div key={item.id} className="mt-2 flex items-center">
                  <Checkbox
                    id={`social-${item.id}`}
                    checked={selectedLayers.includes(item.id)}
                    onCheckedChange={(c) =>
                      onLayerToggle?.(item.id, c === true)
                    }
                    className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                  />
                  <label
                    htmlFor={`social-${item.id}`}
                    className="ml-[15px] text-white text-[12px] font-normal leading-snug [font-family:'Futura PT]"
                  >
                    {item.label}
                  </label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="health" className="border-0">
          <AccordionTrigger className="py-3 hover:no-underline accordion-trigger">
            <div className="flex items-center">
              <ChevronRight className="accordion-arrow" />
              <span className="text-[20.15px] text-white font-normal font-futura leading-[100%]">
                Health
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-0">
            <div className="ml-4">
              {healthItems.map((item) => (
                <div key={item.id} className="flex items-center mt-1.5">
                  <Checkbox
                    id={item.id}
                    className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                    checked={selectedLayers.includes(item.id)}
                    onCheckedChange={(checked) =>
                      onLayerToggle?.(item.id, checked === true)
                    }
                  />
                  <label
                    htmlFor={item.id}
                    className="ml-[15px] text-white text-[12px] font-normal leading-[100%] [font-family:'Futura PT']"
                  >
                    {item.label}
                  </label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="political" className="border-0">
          <AccordionTrigger className="py-3 hover:no-underline accordion-trigger">
            <div className="flex items-center">
              <ChevronRight className="accordion-arrow" />
              <span className="text-[20.15px] text-white font-normal font-futura leading-[100%]">
                Political
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-0">
            <div className="ml-4 pb-2">
              {politicalTopics.map((item) =>
                item.id === "red-blue-district" ? (
                  <div key={item.id} className="mt-1.5">
                    <div className="flex items-center">
                      <Checkbox
                        id={`political-${item.id}`}
                        className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                        checked={politicalLayerIds.includes(item.id)}
                        onCheckedChange={(checked) =>
                          onPoliticalLayerToggle(item.id, checked === true)
                        }
                      />
                      <label
                        htmlFor={`political-${item.id}`}
                        className="ml-[15px] text-white text-[12px] font-normal leading-[100%] [font-family:'Futura PT']"
                      >
                        {item.label}
                      </label>
                    </div>
                    {politicalLayerIds.includes("red-blue-district") && (
                      <label className="mt-2 ml-7 block">
                        <span className="text-white/70 text-[11px] block mb-1 [font-family:'Futura PT']">
                          Show
                        </span>
                        <select
                          className="w-full max-w-[240px] rounded-md border border-white/70 bg-white/10 text-white text-[11px] px-2 py-1 outline-none focus:ring-1 focus:ring-white/40 focus:border-white"
                          value={houseDistrictPartyMode}
                          onChange={(e) =>
                            onHouseDistrictPartyModeChange(
                              e.target.value as HouseDistrictPartyMode
                            )
                          }
                        >
                          <option className="text-black" value="both">
                            Both (red and blue)
                          </option>
                          <option className="text-black" value="red">
                            Red districts only
                          </option>
                          <option className="text-black" value="blue">
                            Blue districts only
                          </option>
                        </select>
                      </label>
                    )}
                  </div>
                ) : (
                  <div key={item.id} className="flex items-center mt-1.5">
                    <Checkbox
                      id={`political-${item.id}`}
                      className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                      checked={politicalLayerIds.includes(item.id)}
                      onCheckedChange={(checked) =>
                        onPoliticalLayerToggle(item.id, checked === true)
                      }
                    />
                    <label
                      htmlFor={`political-${item.id}`}
                      className="ml-[15px] text-white text-[12px] font-normal leading-[100%] [font-family:'Futura PT']"
                    >
                      {item.label}
                    </label>
                  </div>
                )
              )}
              {politicalLayerIds.includes("senators") && (
                <p className="mt-2 text-white/60 text-[10px] leading-snug max-w-[280px]">
                  Two pins per state (current senators). Refresh data:{" "}
                  <code className="text-white/80">npm run data:senators</code>
                </p>
              )}
              {politicalLayerIds.includes("governors") && (
                <p className="mt-2 text-white/60 text-[10px] leading-snug max-w-[280px]">
                  One pin per state (current governor); green ring on the map. Refresh:{" "}
                  <code className="text-white/80">npm run data:governors</code>
                </p>
              )}
              {(politicalLayerIds.includes("president") ||
                politicalLayerIds.includes("vice-president")) && (
                <p className="mt-2 text-white/60 text-[10px] leading-snug max-w-[280px]">
                  President — gold ring (White House). Vice President — silver-blue ring
                  (Observatory Circle). Turn each on separately or together; president pin
                  stacks above when they overlap. Refresh:{" "}
                  <code className="text-white/80">npm run data:president</code>
                </p>
              )}
              {politicalLayerIds.includes("red-blue-district") && (
                <p className="mt-2 text-white/60 text-[10px] leading-snug max-w-[280px]">
                  119th district shapes (Census); party from current voting members where
                  listed. Vacant seats and non‑R/D members appear slate when &quot;Both&quot;
                  is selected. Refresh:{" "}
                  <code className="text-white/80">npm run data:congressional</code>
                </p>
              )}
              {politicalLayerIds.includes("house") && (
                <p className="mt-2 text-white/60 text-[10px] leading-snug max-w-[280px]">
                  One pin per voting district (50 states only; 435 apportioned seats).
                  Non-voting delegates (D.C., territories) are excluded. Pin count can
                  be under 435 when seats are vacant. Refresh:{" "}
                  <code className="text-white/80">npm run data:congressional</code>
                </p>
              )}
              {politicalLayerIds.includes("supreme-court") && (
                <p className="mt-2 text-white/60 text-[10px] leading-snug max-w-[280px]">
                  Nine current justices; pins use birth/home-state anchors (spread when
                  multiple share a state). Chief Justice stacks above when overlapping.
                  Refresh roster:{" "}
                  <code className="text-white/80">npm run data:scotus</code>
                </p>
              )}
              {politicalLayerIds.includes("gerrymandering") && (
                <p className="mt-2 text-white/60 text-[10px] leading-snug max-w-[280px]">
                  Every current U.S. House district (119th Congress) is drawn from Census shapes
                  so you can see full boundaries—not counties. Violet pins mark educational case
                  spots; tap a district or pin for details. Cases:{" "}
                  <code className="text-white/80">client/public/data/gerrymandering.json</code>
                </p>
              )}
              {politicalLayerIds.includes("electoral-college") && (
                <p className="mt-2 text-white/60 text-[10px] leading-snug max-w-[280px]">
                  2024 presidential results by state: red/blue by statewide winner, darker =
                  larger margin (CNN-style). Contiguous 48 + DC; Alaska &amp; Hawaii same
                  data in corner insets. Data:{" "}
                  <code className="text-white/80">client/public/data/electoral-college-2024.json</code>
                </p>
              )}
              {unwiredPoliticalSelections.length > 0 && (
                <p className="mt-2 text-white/60 text-[10px] leading-snug max-w-[280px]">
                  Map layer for this topic is not wired yet.
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

{/* 
        {collapsedCategories.map((category) => (
          <AccordionItem
            key={category.id}
            value={category.id}
            className="border-0"
          >
            <AccordionTrigger className="py-3 hover:no-underline accordion-trigger">
              <div className="flex items-center">
                <ChevronRight className="accordion-arrow" />
                <span className="text-[17px] text-white font-normal leading-[100%] [font-family:'Futura_PT_Book]">
                {/* <img
                  className="w-1.5 h-[11px] mr-1"
                  alt="Graphics"
                  src="/figmaAssets/graphics-1.svg"
                />
                <span className="text-[22.8px] text-white font-normal leading-[100%] [font-family:'Futura_PT_Book]">
                {category.label}
                </span>
              </div>
            </AccordionTrigger>
          </AccordionItem>
        ))} */}

        <AccordionItem value="census" className="border-0">
          <AccordionTrigger className="py-3 hover:no-underline accordion-trigger">
            <div className="flex items-center">
              <ChevronRight className="accordion-arrow" />
              {/* <span className="text-[17px] text-white font-normal [font-family:'Futura PT]">
              {/* <img
                className="w-[11px] h-1.5 mr-1.5"
                alt="Graphics"
                src="/figmaAssets/graphics.svg"
              /> */}
              <span className="text-[20.15px] text-white font-normal [font-family:'Futura PT]">
                Census
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-0 pb-0">
            <div className="ml-4 pb-24">
              {/* Subcategory: By race */}
              <span className="text-white/70 text-[11px] font-futura block mt-1 mb-1">
                By race
              </span>
              {censusItems.map((item) => {
                const metricKey = censusMetricMap[item.id] ?? null;
                const isActive = selectedRaceCensusId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center mt-1.5 ${raceSectionDisabled ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <Checkbox
                      id={item.id}
                      className="h-4 w-4 border border-white/70 bg-white/10 text-white"
                      checked={isActive}
                      disabled={raceSectionDisabled || (metricKey == null && item.id !== "all")}
                      onCheckedChange={(checked) => {
                        if (item.id === "all") {
                          if (checked) {
                            onSelectedRaceCensusIdChange("all");
                            onSelectedAgeGroupChange(null);
                            onSelectedSexIdChange(null);
                            onSetChoroplethActive(false);
                          }
                          return;
                        }
                        if (!metricKey) return;
                        const next = Boolean(checked);
                        if (next) {
                          onSelectedRaceCensusIdChange(item.id);
                          onChoroplethMetricChange(metricKey);
                          onSelectedAgeGroupChange(null);
                          onSelectedSexIdChange(null);
                          onSetChoroplethActive(true);
                        } else {
                          onSelectedRaceCensusIdChange("all");
                          if (!selectedAgeGroupId && !selectedSexId)
                            onSetChoroplethActive(false);
                        }
                      }}
                    />
                    <label
                      htmlFor={item.id}
                      className="ml-[15px] text-white text-[12px] font-normal leading-[100%] [font-family:'Futura PT]"
                    >
                      {item.label}
                    </label>
                  </div>
                );
              })}
              {/* Subcategory: By age (total population, separate from race) */}
              <span className={`text-white/70 text-[11px] font-futura block mt-4 mb-1 ${ageSectionDisabled ? "opacity-50" : ""}`}>
                By age
              </span>
              {CENSUS_AGE_GROUPS.map((age) => (
                <div
                  key={age.id}
                  className={`flex items-center mt-0.5 ${ageSectionDisabled ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <Checkbox
                    id={`census-age-${age.id}`}
                    className="h-3.5 w-3.5 border border-white/60 bg-white/10 text-white"
                    checked={selectedAgeGroupId === age.id}
                    disabled={ageSectionDisabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onSelectedRaceCensusIdChange("all");
                        onSelectedSexIdChange(null);
                        onSelectedAgeGroupChange(age.id);
                        onSetChoroplethActive(true);
                      } else {
                        onSelectedAgeGroupChange(null);
                        if (selectedRaceCensusId === "all" && !selectedSexId)
                          onSetChoroplethActive(false);
                      }
                    }}
                  />
                  <label
                    htmlFor={`census-age-${age.id}`}
                    className="ml-2 text-white/90 text-[11px] leading-[100%]"
                  >
                    {age.label}
                  </label>
                </div>
              ))}
              {/* Subcategory: By sex */}
              <span className={`text-white/70 text-[11px] font-futura block mt-4 mb-1 ${sexSectionDisabled ? "opacity-50" : ""}`}>
                By sex
              </span>
              {censusSexItems.map((sex) => (
                <div
                  key={sex.id}
                  className={`flex items-center mt-0.5 ${sexSectionDisabled ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <Checkbox
                    id={`census-sex-${sex.id}`}
                    className="h-3.5 w-3.5 border border-white/60 bg-white/10 text-white"
                    checked={selectedSexId === sex.id}
                    disabled={sexSectionDisabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        onSelectedRaceCensusIdChange("all");
                        onSelectedAgeGroupChange(null);
                        onSelectedSexIdChange(sex.id);
                        onSetChoroplethActive(true);
                      } else {
                        onSelectedSexIdChange(null);
                        if (selectedRaceCensusId === "all" && !selectedAgeGroupId)
                          onSetChoroplethActive(false);
                      }
                    }}
                  />
                  <label
                    htmlFor={`census-sex-${sex.id}`}
                    className="ml-2 text-white/90 text-[11px] leading-[100%]"
                  >
                    {sex.label}
                  </label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
        </Accordion>
      </div>
    </div>
    </div>
    </div>
  );
};