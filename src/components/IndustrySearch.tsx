// src/components/IndustrySearch.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';

// Parse the industry list from the provided data
const INDUSTRIES = [
    'Agriculture',
    'Farming',
    'Ranching',
    'Fisheries',
    'Ranching and Fisheries',
    'Forestry and Logging',
    'Oil, Gas, and Mining',
    'Oil and Gas',
    'Mining',
    'Coal Mining', 
    'Metal Ore Mining',
    'Nonmetallic Mineral Mining',
    'Natural Gas Extraction',
    'Oil Extraction',
    'Utilities',
    'Water, Waste, Steam, and Air Conditioning Services',
    'Water Supply and Irrigation Systems',
    'Steam and Air-Conditioning Supply',
    'Waste Treatment and Disposal',
    'Waste Collection',
    'Air, Water, and Waste Program Management',
    'Hydroelectric Power Generation',
    'Fossil Fuel Electric Power Generation',
    'Nuclear Electric Power Generation',
    'Solar Electric Power Generation',
    'Wind Electric Power Generation',
    'Geothermal Electric Power Generation',
    'Biomass Electric Power Generation',
    'Electric Power Generation',
    'Renewable Energy Power Generation',
    'Construction',
    'Building Construction',
    'Civil Engineering',
    'Utility System Construction',
    'Subdivision of Land',
    'Highway, Street, and Bridge Construction',
    'Building Structure and Exterior Contractors',
    'Building Equipment Contractors',
    'Building Finishing Contractors',
    'Specialty Trade Contractors',
    'Residential Building Construction',
    'Nonresidential Building Construction',
    'Manufacturing',
    'Food and Beverage Manufacturing',
    'Apparel Manufacturing',
    'Leather Product Manufacturing',
    'Animal Feed Manufacturing',
    'Sugar and Confectionery Product Manufacturing',
    'Fruit and Vegetable Preserves Manufacturing',
    'Dairy Product Manufacturing',
    'Meat Products Manufacturing',
    'Seafood Product Manufacturing',
    'Baked Goods Manufacturing',
    'Beverage Manufacturing',
    'Tobacco Manufacturing',
    'Textile Manufacturing',
    'Fashion Accessories Manufacturing',
    'Footwear Manufacturing',
    'Womens Handbag Manufacturing',
    'Oil and Coal Product Manufacturing',
    'Paper and Forest Product Manufacturing',
    'Plastics and Rubber Product Manufacturing',
    'Chemical Manufacturing',
    'Wood Product Manufacturing',
    'Chemical Raw Materials Manufacturing',
    'Artificial Rubber and Synthetic Fiber Manufacturing',
    'Agricultural Chemical Manufacturing',
    'Pharmaceutical Manufacturing',
    'Clay and Refractory Products Manufacturing',
    'Glass Product Manufacturing',
    'Glass, Ceramics and Concrete Manufacturing',
    'Lime and Gypsum Products Manufacturing',
    'Paint, Coating, and Adhesive Manufacturing',
    'Soap and Cleaning Product Manufacturing',
    'Personal Care Product Manufacturing',
    'Robot Manufacturing',
    'Fabricated Metal Products',
    'Machinery Manufacturing',
    'Computers and Electronics Manufacturing',
    'Transportation Equipment Manufacturing',
    'Furniture and Home Furnishings Manufacturing',
    'Primary Metal Manufacturing',
    'Cutlery and Handtool Manufacturing',
    'Boilers, Tanks, and Shipping Container Manufacturing',
    'Construction Hardware Manufacturing',
    'Spring and Wire Product Manufacturing',
    'Industrial Machinery Manufacturing',
    'Commercial and Service Industry Machinery Manufacturing',
    'HVAC and Refrigeration Equipment Manufacturing',
    'Metalworking Machinery Manufacturing',
    'Engines and Power Transmission Equipment Manufacturing',
    'Communications Equipment Manufacturing',
    'Audio and Video Equipment Manufacturing',
    'Renewable Energy Equipment Manufacturing',
    'Semiconductor Manufacturing',
    'Measuring and Control Instrument Manufacturing',
    'Magnetic and Optical Media Manufacturing',
    'Electric Lighting Equipment Manufacturing',
    'Household Appliance Manufacturing',
    'Electrical Equipment Manufacturing',
    'Appliances, Electrical, and Electronics Manufacturing',
    'Motor Vehicle Manufacturing',
    'Motor Vehicle Parts Manufacturing',
    'Aviation and Aerospace Component Manufacturing',
    'Railroad Equipment Manufacturing',
    'Shipbuilding',
    'Household and Institutional Furniture Manufacturing',
    'Office Furniture and Fixtures Manufacturing',
    'Mattress and Blinds Manufacturing',
    'Medical Equipment Manufacturing',
    'Architectural and Structural Metal Manufacturing',
    'Turned Products and Fastener Manufacturing',
    'Metal Treatments',
    'Metal Valve, Ball, and Roller Manufacturing',
    'Agriculture, Construction, Mining Machinery Manufacturing',
    'Defense and Space Manufacturing',
    'Sporting Goods Manufacturing',
    'Automation Machinery Manufacturing',
    'Breweries',
    'Wineries',
    'Distilleries',
    'Printing Services',
    'Wholesale',
    'Internet Marketplace Platforms',
    'Wholesale Motor Vehicles and Parts',
    'Wholesale Furniture and Home Furnishings',
    'Wholesale Building Materials',
    'Wholesale Metals and Minerals',
    'Wholesale Appliances, Electrical, and Electronics',
    'Wholesale Hardware, Plumbing, Heating Equipment',
    'Wholesale Machinery',
    'Wholesale Paper Products',
    'Wholesale Drugs and Sundries',
    'Wholesale Apparel and Sewing Supplies',
    'Wholesale Food and Beverage',
    'Wholesale Raw Farm Products',
    'Wholesale Chemical and Allied Products',
    'Wholesale Petroleum and Petroleum Products',
    'Wholesale Alcoholic Beverages',
    'Wholesale Photography Equipment and Supplies',
    'Wholesale Computer Equipment',
    'Wholesale Recyclable Materials',
    'Wholesale Luxury Goods and Jewelry',
    'Wholesale Footwear',
    'Wholesale Import and Export',
    'Retail',
    'Retail Furniture and Home Furnishings',
    'Retail Appliances, Electrical, and Electronic Equipment',
    'Retail Building Materials and Garden Equipment',
    'Food and Beverage Retail',
    'Retail Health and Personal Care Products',
    'Retail Gasoline',
    'Retail Apparel and Fashion',
    'Retail Motor Vehicles',
    'Retail Luxury Goods and Jewelry',
    'Retail Groceries',
    'Retail Pharmacies',
    'Retail Books and Printed News',
    'Retail Florists',
    'Retail Office Supplies and Gifts',
    'Retail Recyclable Materials & Used Merchandise',
    'Online and Mail Order Retail',
    'Retail Musical Instruments',
    'Retail Office Equipment',
    'Retail Art Supplies',
    'Blogs',
    'Internet News',
    'Transportation, Logistics, Supply Chain and Storage',
    'Airlines and Aviation',
    'Transportation',
    'Maritime Transportation',
    'Rail Transportation',
    'Truck Transportation',
    'Ground Passenger Transportation',
    'Pipeline Transportation',
    'Sightseeing Transportation',
    'Urban Transit Services',
    'Interurban and Rural Bus Services',
    'Taxi and Limousine Services',
    'School and Employee Bus Services',
    'Shuttles and Special Needs Transportation Services',
    'Postal Services',
    'Freight and Package Transportation',
    'Warehousing and Storage',
    'Technology, Information and Media',
    'Media and Telecommunications',
    'Technology, Information and Internet',
    'Social Networking Platforms',
    'Broadcast Media Production and Distribution',
    'Telecommunications',
    'Data Infrastructure and Analytics',
    'Movies and Sound Recording',
    'Animation and Post-production',
    'Sheet Music Publishing',
    'Sound Recording',
    'Radio and Television Broadcasting',
    'Cable and Satellite Programming',
    'Telecommunications Carriers',
    'Satellite Telecommunications',
    'Blockchain Services',
    'Climate Data and Analytics',
    'Information Services',
    'Internet Publishing',
    'Media Production',
    'Wireless Services',
    'Online Audio and Video Media',
    'Telephone Call Centers',
    'Space Research and Technology',
    'Internet SaaS',
    'Internet Startup',
    'Generative AI',
    'Newspaper Publishing',
    'Periodical Publishing',
    'Book Publishing',
    'Software Development',
    'Embedded Software Products',
    'Mobile Software Products',
    'Web Software Products',
    'Computer Networking Products',
    'Video Games',
    'IT System Custom Software Development',
    'Libraries',
    'Financial Services',
    'Credit Intermediation',
    'Capital Markets',
    'Insurance',
    'Funds and Trusts',
    'Securities and Commodity Exchanges',
    'Investment Management',
    'Investment Banking',
    'Insurance Carriers',
    'Insurance and Employee Benefit Funds',
    'Trusts and Estates',
    'Banking',
    'Savings Institutions',
    'Loan Brokers',
    'Venture Capital and Private Equity Principals',
    'Investment Advice',
    'Insurance Agencies and Brokerages',
    'Claims Adjusting, Actuarial Services',
    'Pension Funds',
    'International Trade and Development',
    'Accessible Architecture and Design',
    'Services for Renewable Energy',
    'Fundraising',
    'Conservation Programs',
    'Economic Programs',
    'Architectural Services',
    'Engineering',
    'Robotics Engineering',
    'Real Estate',
    'Real Estate and Equipment Rental Services',
    'Leasing Real Estate',
    'Equipment Rental Services',
    'Leasing Real Estate Agents and Brokers',
    'Housing and Community Development',
    'Community Development and Urban Planning',
    'Consumer Goods Rental',
    'Commercial and Industrial Equipment Rental',
    'Leasing Non-residential Real Estate',
    'Leasing Residential Real Estate',
    'Professional Services',
    'Legal Services',
    'Accounting',
    'Design Services',
    'IT Services and IT Consulting',
    'Business Consulting and Services',
    'Research Services',
    'Marketing Services',
    'Law Practice',
    'Interior Design',
    'Graphic Design',
    'Environmental Services',
    'Think Tanks',
    'Public Relations and Communications Services',
    'Photography',
    'Translation and Localization',
    'Veterinary Services',
    'Surveying and Mapping Services',
    'Engineering Services',
    'IT System Design Services',
    'IT System Operations and Maintenance',
    'Strategic Management Services',
    'Human Resources Services',
    'Advertising Services',
    'Operations Consulting',
    'Administrative and Support Services',
    'Office Administration',
    'Facilities Services',
    'Travel Arrangements',
    'Security and Investigations',
    'Temporary Help Services',
    'Writing and Editing',
    'Janitorial Services',
    'Events Services',
    'Security Systems Services',
    'Landscaping Services',
    'Community Services',
    'Individual and Family Services',
    'Emergency and Relief Services',
    'Child Day Care Services',
    'Accomodation Services',
    'Pet Services',
    'Health and Human Services',
    'Nanotechnology Research',
    'Biotechnology Research',
    'Holding Companies',
    'Staffing and Recruiting',
    'Security Guards and Patrol Services',
    'Education',
    'Primary and Secondary Education',
    'Higher Education',
    'Professional Training and Coaching',
    'Technical and Vocational Training',
    'Secretarial Schools',
    'Fine Arts Schools',
    'Sports and Recreation Instruction',
    'Language Schools',
    'Cosmetology Schools',
    'Barber Schools',
    'Flight Training',
    'E-Learning Providers',
    'Education Administration Programs',
    'Healthcare',
    'Hospitals',
    'Medical Practices',
    'Nursing Homes and Residential Care Facilities',
    'Physicians',
    'Dentists',
    'Medical and Diagnostic Laboratories',
    'Home Health Care Services',
    'Vocational Rehabilitation Services',
    'Chiropractors',
    'Optometrists',
    'Physical, Occupational and Speech Therapists',
    'Family Planning Centers',
    'Ambulance Services',
    'Outpatient Care Centers',
    'Services for the Elderly and Disabled',
    'Public Health',
    'Public Assistance Programs',
    'Performing Arts',
    'Spectator Sports',
    'Museums',
    'Historical Sites',
    'Recreational Facilities',
    'Artists and Writers',
    'Amusement Parks and Arcades',
    'Gambling Facilities and Casinos',
    'Theater Companies',
    'Dance Companies',
    'Musicians',
    'Circuses and Magic Shows',
    'Golf Courses and Country Clubs',
    'Skiing Facilities',
    'Wellness and Fitness Services',
    'Sports Teams and Clubs',
    'Racetracks',
    'Zoos',
    'Botanical Gardens',
    'Hospitality',
    'Food and Beverage Services',
    'Bars, Taverns, and Nightclubs',
    'Restaurants',
    'Hotels and Motels',
    'Bed-and-Breakfasts',
    'Hostels',
    'Homestays',
    'Caterers',
    'Mobile Food Services',
    'Consumer Services',
    'Repair and Maintenance',
    'Personal and Laundry Services',
    'Household Services',
    'Vehicle Repair and Maintenance',
    'Electronic and Precision Equipment Maintenance',
    'Commercial and Industrial Machinery Maintenance',
    'Personal Care Services',
    'Laundry and Drycleaning Services',
    'Religious Institutions',
    'Philanthropic Fundraising Services',
    'Civic and Social Organizations',
    'Political Organizations',
    'Industry Associations',
    'Professional Organizations',
    'Government Administration',
    'Public Policy Offices',
    'Environmental Quality Programs',
    'Military and International Affairs',
    'Executive Offices',
    'Legislative Offices',
    'Administration of Justice',
    'Law Enforcement',
    'Public Safety',
    'Courts of Law',
    'Correctional Institutions',
    'Fire Protection',
];

interface IndustrySearchProps {
  onSelect: (industry: string) => void;
  selectedIndustry: string | null;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function IndustrySearch({
  onSelect,
  selectedIndustry,
  placeholder = "Search for an industry...",
  autoFocus = false
}: IndustrySearchProps) {
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showInput, setShowInput] = useState(!selectedIndustry);
  
  // Focus the input if autoFocus is true
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);
  
  // Add click outside listener to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Search for industries based on the search term
  useEffect(() => {
    if (!searchTerm) {
      setSearchResults([]);
      return;
    }
    
    const filteredResults = INDUSTRIES.filter(industry => 
      industry.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    setSearchResults(filteredResults);
  }, [searchTerm]);

  // Update the component state when selectedIndustry changes from props
  useEffect(() => {
    setShowInput(!selectedIndustry);
  }, [selectedIndustry]);
  
  const handleSelectIndustry = (industry: string) => {
    onSelect(industry);
    setSearchTerm('');
    setSearchResults([]);
    setShowResults(false);
    setShowInput(false);
  };
  
  const handleRemoveSelection = () => {
    onSelect('');
    setShowInput(true);
    if (inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  };
  
  return (
    <div className="space-y-3 relative" ref={searchRef}>
      {/* Selected industry tag */}
      {selectedIndustry && (
        <div className="flex flex-wrap gap-2 my-3">
          <div className="flex items-center gap-1 bg-cerulean-100 text-cerulean-800 px-3 py-1 rounded-full">
            <span className="text-sm">{selectedIndustry}</span>
            <button
              onClick={handleRemoveSelection}
              className="text-cerulean-500 hover:text-cerulean-700 rounded-full"
              aria-label={`Remove ${selectedIndustry}`}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      
      {showInput && (
      <>      
      {/* Search input */}
      <div className="relative">
        <Input
          ref={inputRef}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => setShowResults(true)}
          placeholder={placeholder}
          className="pr-10"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
      </div>
      
      {/* Search results dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg border border-slate-200 max-h-60 overflow-auto">
          {searchResults.length === 0 && searchTerm.length >= 2 && (
            <div className="p-2 text-center text-slate-500">
              No industries found
            </div>
          )}
          
          {searchResults.map(industry => (
            <div 
              key={industry}
              className="p-2 hover:bg-slate-100 cursor-pointer flex items-center gap-2"
              onClick={() => handleSelectIndustry(industry)}
            >
              <div className="flex-1">
                <div className="font-medium">{industry}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      </>
    )}
    </div>
  );
}