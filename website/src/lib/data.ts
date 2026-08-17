export type PropertyType = 'Condominium' | 'House & Lot' | 'Land' | 'Commercial' | 'Townhouse'
export type PropertyStatus = 'For Sale' | 'For Rent' | 'Pre-Selling'

export type Property = {
  id: string
  title: string
  location: string
  city: string
  type: PropertyType
  status: PropertyStatus
  price: number
  bedrooms?: number
  bathrooms?: number
  area: number
  lotArea?: number
  parking?: number
  floors?: string
  image: string
  images: string[]
  featured?: boolean
  isNew?: boolean
  developer?: string
  description: string
  amenities: string[]
  features: string[]
}

export type Condominium = {
  id: string
  name: string
  location: string
  developer: string
  startingPrice: number
  /** 'rent' shows startingPrice as "₱X/mo — Estimated starting rent". Defaults to 'sale'. */
  priceMode?: 'sale' | 'rent'
  status: 'Pre-Selling' | 'Under Construction' | 'Ready for Occupancy' | 'Completed'
  image: string
  units?: number
  floors?: number
  /** Display text for a floor range, e.g. "10–15 Floors" — used when floors isn't a single number. */
  floorRange?: string
  /** Display text for a unit area range, e.g. "40–113 sqm". */
  areaRange?: string
  /** Display text for the unit type mix, e.g. "Studio • 2BR • 3BR". */
  unitMix?: string
  /** Number of buildings/towers in the development. */
  buildingCount?: number
  description: string
  amenities: string[]
}

export type Agent = {
  id: string
  name: string
  title: string
  phone: string
  email: string
  image: string
  specialization: string[]
  listings: number
  experience: number
  bio: string
}

export const properties: Property[] = [
  {
    id: '1',
    title: 'The Grand Meridian',
    location: 'Clark Freeport Zone, Pampanga',
    city: 'Clark',
    type: 'Condominium',
    status: 'For Sale',
    price: 8500000,
    bedrooms: 2,
    bathrooms: 2,
    area: 75,
    parking: 1,
    floors: '12th–18th Floor',
    image: 'https://images.unsplash.com/photo-1750420556288-d0e32a6f517b?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1750420556288-d0e32a6f517b?w=1400&h=900&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1562438668-bcf0ca6578f0?w=1400&h=900&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1775146089517-79a8ac943a7b?w=1400&h=900&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1776361984975-84bbbb539f80?w=1400&h=900&fit=crop&auto=format',
    ],
    featured: true,
    isNew: true,
    developer: 'Ayala Land Premier',
    description: 'The Grand Meridian is an iconic residential tower in the heart of Clark Freeport Zone. Each residence is crafted with premium finishes, floor-to-ceiling windows, and an open-plan layout that maximizes natural light and panoramic views of the Clark skyline and surrounding mountains.',
    amenities: ['Infinity Pool', 'Sky Lounge', 'Fitness Center', 'Co-working Space', 'Concierge', 'Valet Parking', "Children's Play Area", 'Function Hall'],
    features: ['Floor-to-ceiling Windows', 'Imported Marble Flooring', 'Fully Fitted Kitchen', 'Smart Home System', 'Private Balcony', 'Built-in Wardrobes'],
  },
  {
    id: '2',
    title: 'Villa Serena Estate',
    location: 'Forbes Park Village, Angeles City',
    city: 'Angeles City',
    type: 'House & Lot',
    status: 'For Sale',
    price: 22500000,
    bedrooms: 4,
    bathrooms: 4,
    area: 280,
    lotArea: 450,
    parking: 2,
    image: 'https://images.unsplash.com/photo-1714492401036-ddb08443285f?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1714492401036-ddb08443285f?w=1400&h=900&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1775146089517-79a8ac943a7b?w=1400&h=900&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1642541070065-3912f347e7c6?w=1400&h=900&fit=crop&auto=format',
    ],
    featured: true,
    developer: 'Crown Asia',
    description: 'An extraordinary family residence in the prestigious Forbes Park Village of Angeles City. Villa Serena Estate combines contemporary architecture with lush tropical landscaping. The expansive grounds feature a private pool, manicured gardens, and generous entertainment spaces suited for the most discerning buyer.',
    amenities: ['Private Pool', 'Landscaped Garden', 'Covered Garage', 'Security System', 'Backup Generator', 'CCTV'],
    features: ['High Ceilings (4m)', 'Engineered Hardwood Floors', "Chef's Kitchen with Island", 'Master Suite with Walk-in Closet', 'Home Office', 'Outdoor Entertainment Terrace'],
  },
  {
    id: '3',
    title: 'The Pinnacle Suites',
    location: 'Clark Freeport Zone, Pampanga',
    city: 'Clark',
    type: 'Condominium',
    status: 'For Sale',
    price: 5800000,
    bedrooms: 1,
    bathrooms: 1,
    area: 48,
    parking: 1,
    image: 'https://images.unsplash.com/photo-1562438668-bcf0ca6578f0?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1562438668-bcf0ca6578f0?w=1400&h=900&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1750420556288-d0e32a6f517b?w=1400&h=900&fit=crop&auto=format',
    ],
    isNew: true,
    description: 'A sophisticated 1-bedroom residence at The Pinnacle Suites, ideal for young professionals seeking a premium urban lifestyle in Clark Freeport Zone. Features a smart open-plan layout with high-quality finishes throughout.',
    amenities: ['Rooftop Pool', 'Gym', 'Café & Restaurant', 'Concierge', '24/7 Security'],
    features: ['Open-plan Living', 'Premium Kitchen Appliances', 'Study Nook', 'High-speed Fiber Connection'],
  },
  {
    id: '4',
    title: 'Clark Executive Residences',
    location: 'Clark Freeport Zone, Pampanga',
    city: 'Clark',
    type: 'Condominium',
    status: 'For Rent',
    price: 38000,
    bedrooms: 2,
    bathrooms: 2,
    area: 85,
    parking: 1,
    image: 'https://images.unsplash.com/photo-1642541070065-3912f347e7c6?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1642541070065-3912f347e7c6?w=1400&h=900&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1562438668-bcf0ca6578f0?w=1400&h=900&fit=crop&auto=format',
    ],
    description: 'A premium fully furnished 2-bedroom executive suite available for lease. Ideal for corporate executives and expatriates. Features high-end appliances, fast fiber internet, and building concierge services.',
    amenities: ['Lap Pool', 'Fitness Center', 'Business Center', 'Concierge', 'Covered Parking'],
    features: ['Fully Furnished', 'Premium Appliances', 'Fiber Internet', 'Air Conditioning', 'Balcony with City View'],
  },
  {
    id: '5',
    title: 'Arayat Mountain Reserve',
    location: 'San Roque, Arayat, Pampanga',
    city: 'Arayat',
    type: 'Land',
    status: 'For Sale',
    price: 12000000,
    area: 20000,
    image: 'https://images.unsplash.com/photo-1496116013258-67a0855f9f82?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1496116013258-67a0855f9f82?w=1400&h=900&fit=crop&auto=format',
    ],
    description: 'A rare 2-hectare classified reserve nestled in the scenic foothills of Mt. Arayat. An ideal investment for private estates, wellness retreats, or agro-tourism developments. Clean title with road access.',
    amenities: [],
    features: ['Clean Title', 'Paved Road Access', 'Mountain View', 'Fertile Terrain', 'Near Protected Area'],
  },
  {
    id: '6',
    title: 'The Boulevard Penthouse',
    location: 'Clark Freeport Zone, Pampanga',
    city: 'Clark',
    type: 'Condominium',
    status: 'For Sale',
    price: 18500000,
    bedrooms: 3,
    bathrooms: 3,
    area: 165,
    parking: 2,
    floors: 'Top Floor (32F)',
    image: 'https://images.unsplash.com/photo-1776363497229-616cc7a541fe?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1776363497229-616cc7a541fe?w=1400&h=900&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1776361984975-84bbbb539f80?w=1400&h=900&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1775146089517-79a8ac943a7b?w=1400&h=900&fit=crop&auto=format',
    ],
    featured: true,
    description: "A rare penthouse offering at The Boulevard — Clark's most prestigious address. This exceptional 3-bedroom residence occupies the entire top floor with a private rooftop terrace, plunge pool, and 360-degree panoramic views of Clark and the Pampanga mountain range.",
    amenities: ['Private Rooftop Terrace', 'Plunge Pool', 'Home Automation', 'Private Elevator Access', 'Wine Storage', 'Sky Garden'],
    features: ['360° Panoramic Views', 'Double-height Ceilings', 'Gourmet Kitchen', 'Walk-in Wardrobes', 'Private Study', 'Powder Room'],
  },
  {
    id: '7',
    title: 'Mabalacat Heritage Villas',
    location: 'Ciudad Grande, Mabalacat City',
    city: 'Mabalacat',
    type: 'House & Lot',
    status: 'Pre-Selling',
    price: 9800000,
    bedrooms: 3,
    bathrooms: 2,
    area: 180,
    lotArea: 200,
    parking: 1,
    image: 'https://images.unsplash.com/photo-1670946637333-7db60b7b9a7a?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1670946637333-7db60b7b9a7a?w=1400&h=900&fit=crop&auto=format',
    ],
    isNew: true,
    developer: 'Megaworld Corporation',
    description: 'An exclusive collection of modern heritage-inspired villas in a master-planned gated community in Mabalacat City. Each villa features contemporary Kapampangan architectural elements with premium modern finishes and a private garden.',
    amenities: ['Clubhouse', 'Swimming Pool', 'Basketball Court', '24/7 Security', 'Landscaped Parks'],
    features: ['Heritage-inspired Facade', 'Private Garden', 'Open Kitchen', 'Lanai', 'Carport'],
  },
  {
    id: '8',
    title: 'Clark Commercial Plaza',
    location: 'Clark Freeport Zone, Pampanga',
    city: 'Clark',
    type: 'Commercial',
    status: 'For Sale',
    price: 14500000,
    area: 120,
    parking: 2,
    image: 'https://images.unsplash.com/photo-1743638082396-58706d3bdffb?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1743638082396-58706d3bdffb?w=1400&h=900&fit=crop&auto=format',
    ],
    description: 'A prime commercial retail and office unit at the newly completed Clark Commercial Plaza. Strategically located along the main boulevard, ideal for multinational companies, retail brands, and professional service offices.',
    amenities: ['Common Lobby', 'Elevator Access', 'Loading Bay', 'CCTV Security', 'Fiber Internet Ready'],
    features: ['Turnover Condition', 'Fire Suppression System', 'Air Handling Unit', 'Floor-to-ceiling Glass Facade'],
  },
  {
    id: '9',
    title: 'Porac Valley Estate',
    location: 'Inararo, Porac, Pampanga',
    city: 'Porac',
    type: 'Land',
    status: 'For Sale',
    price: 6500000,
    area: 10000,
    image: 'https://images.unsplash.com/photo-1476410872551-7bfbf7540c9e?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1476410872551-7bfbf7540c9e?w=1400&h=900&fit=crop&auto=format',
    ],
    description: 'A 1-hectare classified lot in the tranquil foothills of Porac, with sweeping valley views and proximity to Clark. Ideal for private residential estate development or agro-tourism investment.',
    amenities: [],
    features: ['Titled', 'Paved Road Access', 'Valley View', 'Flat Terrain', '20 min from Clark'],
  },
  {
    id: '10',
    title: 'Angeles Grand Townhouse',
    location: 'Balibago, Angeles City',
    city: 'Angeles City',
    type: 'Townhouse',
    status: 'For Sale',
    price: 7200000,
    bedrooms: 3,
    bathrooms: 2,
    area: 145,
    lotArea: 80,
    parking: 1,
    image: 'https://images.unsplash.com/photo-1784704161960-26770b684595?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1784704161960-26770b684595?w=1400&h=900&fit=crop&auto=format',
    ],
    description: 'A beautifully designed 3-level townhouse in a secure gated community in Angeles City. Features include a private rooftop deck, premium kitchen, and spacious bedrooms with built-in wardrobes. Walking distance to malls and dining.',
    amenities: ['Community Pool', "Children's Playground", '24/7 Guard', 'Visitor Parking'],
    features: ['Rooftop Deck', 'Modular Kitchen', 'Built-in Wardrobes', 'Narra Wood Accents', 'Smart Door Lock'],
  },
  {
    id: '11',
    title: 'Centralis Sky Residences',
    location: 'Clark Freeport Zone, Pampanga',
    city: 'Clark',
    type: 'Condominium',
    status: 'Pre-Selling',
    price: 5200000,
    bedrooms: 1,
    bathrooms: 1,
    area: 42,
    parking: 1,
    image: 'https://images.unsplash.com/photo-1737939711208-7878ad113cf7?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1737939711208-7878ad113cf7?w=1400&h=900&fit=crop&auto=format',
    ],
    isNew: true,
    developer: 'Ayala Land',
    description: "Centralis Sky Residences is Ayala Land's landmark development in the Clark Freeport Zone, offering thoughtfully designed studios and 1-bedroom units with exceptional connectivity and world-class amenities.",
    amenities: ['Infinity Pool', 'Roof Deck', 'Gym', 'Concierge', 'Retail Podium'],
    features: ['Smart Home Ready', 'Premium Finishes', 'City Views', 'Efficient Layout'],
  },
  {
    id: '12',
    title: 'San Fernando Luxury Estate',
    location: 'San Agustin, City of San Fernando',
    city: 'San Fernando',
    type: 'House & Lot',
    status: 'For Sale',
    price: 35000000,
    bedrooms: 5,
    bathrooms: 5,
    area: 500,
    lotArea: 800,
    parking: 3,
    image: 'https://images.unsplash.com/photo-1776361984975-84bbbb539f80?w=900&h=600&fit=crop&auto=format',
    images: [
      'https://images.unsplash.com/photo-1776361984975-84bbbb539f80?w=1400&h=900&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1775146089517-79a8ac943a7b?w=1400&h=900&fit=crop&auto=format',
    ],
    featured: true,
    description: 'The finest estate in San Fernando, Pampanga. This extraordinary 5-bedroom residence sits on 800 sqm of manicured grounds with a resort-style pool, full entertainment wing, and a separate guest house. A truly exceptional offering for the most discerning buyer.',
    amenities: ['Resort Pool', 'Guest House', 'Entertainment Wing', 'Gym', 'Outdoor Kitchen', 'Motor Court'],
    features: ['Grand Reception Hall', 'Formal Dining', 'Full Bar', 'Home Theater', 'Staff Quarters', 'Generator'],
  },
]

export const condominiums: Condominium[] = [
  {
    id: '1',
    name: "D'Heights Monterrace Suites",
    location: 'Clark Freeport Zone, Pampanga',
    developer: "D'Heights",
    // TODO: placeholder price carried over — replace with the real starting price.
    startingPrice: 5200000,
    status: 'Completed',
    image: '/dheights-monterrace.png',
    floorRange: '10–15 Floors',
    areaRange: '40–113 sqm',
    unitMix: 'Studio • 2BR • 3BR',
    description: 'A completed low-density residential community in Clark Freeport Zone, offering Studio to 3-bedroom units with mountain views and resort-style amenities.',
    amenities: ['Swimming Pool', 'Mountain Views', 'Balcony'],
  },
  {
    id: '2',
    name: 'The Sharp Clark Hills',
    location: 'Clark Freeport Zone, Pampanga',
    developer: 'Premium Condominium',
    startingPrice: 28000,
    priceMode: 'rent',
    status: 'Ready for Occupancy',
    image: '/sharp-clark-hills.jpg',
    units: 552,
    floors: 21,
    buildingCount: 5,
    description: 'Premium living in the heart of Clark.',
    // TODO: amenities carried over from the previous entry — replace with the real list.
    amenities: ['Pool Deck', 'Gym', 'Game Room', 'Mall Podium', 'Lobby Lounge', 'Retail Arcade'],
  },
  {
    id: '3',
    name: 'Aperito Tower Clark',
    location: 'The Villages, Clark Freeport Zone',
    developer: 'Premium Condominium',
    startingPrice: 100000,
    priceMode: 'rent',
    // TODO: status not specified — defaulted to Pre-Selling since renders (not finished photos) were provided.
    status: 'Pre-Selling',
    image: '/aperito-tower.jpg',
    units: 152,
    floors: 25,
    buildingCount: 2,
    description: 'Luxury living, redefined in Clark.',
    // TODO: amenities carried over from the previous entry — replace with the real list.
    amenities: ['Lap Pool', 'Sky Lounge', 'Private Cinema', 'Wine Cellar', 'Cigar Lounge', 'Butler Service'],
  },
]

export const agents: Agent[] = [
  {
    id: '1',
    name: 'Maria Santos',
    title: 'Senior Property Consultant',
    phone: '+63 917 123 4567',
    email: 'maria.santos@clarkestates.ph',
    image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=500&h=500&fit=crop&auto=format',
    specialization: ['Luxury Condominiums', 'Pre-Selling', 'Investments'],
    listings: 28,
    experience: 9,
    bio: 'Maria has been a top-producing property consultant in Central Luzon for over 9 years, specializing in luxury condominiums and investment-grade properties across Clark and Pampanga.',
  },
  {
    id: '2',
    name: 'Juan dela Cruz',
    title: 'Commercial Real Estate Specialist',
    phone: '+63 918 234 5678',
    email: 'juan.delacruz@clarkestates.ph',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=500&fit=crop&auto=format',
    specialization: ['Commercial Properties', 'Industrial', 'Land Acquisition'],
    listings: 15,
    experience: 12,
    bio: 'With 12 years in commercial real estate across Pampanga, Juan specializes in office spaces, retail units, and industrial properties within the Clark Freeport Zone.',
  },
  {
    id: '3',
    name: 'Ana Reyes',
    title: 'Luxury Property Advisor',
    phone: '+63 919 345 6789',
    email: 'ana.reyes@clarkestates.ph',
    image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=500&h=500&fit=crop&auto=format',
    specialization: ['Luxury Homes', 'House & Lot', 'Expat Relocation'],
    listings: 22,
    experience: 7,
    bio: 'Ana is the go-to advisor for high-net-worth individuals and expatriate executives seeking premium residential properties across Pampanga. Known for white-glove, personalized service.',
  },
]

export function formatPrice(price: number, status: PropertyStatus): string {
  if (status === 'For Rent') {
    return `₱${price.toLocaleString()}/mo`
  }
  if (price >= 1000000) {
    const m = price / 1000000
    return `₱${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  return `₱${price.toLocaleString()}`
}

export const CITIES = ['All Locations', 'Clark', 'Angeles City', 'Mabalacat', 'San Fernando', 'Porac', 'Arayat']
export const PROPERTY_TYPES: PropertyType[] = ['Condominium', 'House & Lot', 'Land', 'Commercial', 'Townhouse']
export const PROPERTY_STATUSES: PropertyStatus[] = ['For Sale', 'For Rent', 'Pre-Selling']
