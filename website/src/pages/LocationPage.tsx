import { useEffect, useRef, useState } from 'react'
import { condominiums, formatPrice } from '../lib/data'
import { useLiveProperties } from '../lib/useLiveProperties'
import PropertyCard from '../components/PropertyCard'
import type { Page } from '../components/Navigation'
import type { ToastType } from '../components/Toast'

export type LocationKey = 'clark' | 'angeles' | 'mabalacat' | 'san-fernando' | 'porac'

interface LocationPageProps {
  location: LocationKey
  navigate: (page: Page, id?: string) => void
  toast: (msg: string, type?: ToastType) => void
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, visible }
}

const LOCATIONS: Record<LocationKey, {
  name: string
  tagline: string
  description: string
  heroImage: string
  /** 'light' uses a lighter dark-overlay so a bright photo doesn't look dim. Defaults to the standard overlay. */
  heroOverlay?: 'default' | 'light'
  facts: { label: string; value: string }[]
  highlights: string[]
  cityKey: string
  nearbyLocations: { name: string; distance: string; key: LocationKey }[]
}> = {
  clark: {
    name: 'Clark Freeport Zone',
    tagline: 'Live Where Opportunity Meets Lifestyle.',
    description: "Clark Freeport Zone is Central Luzon's premier integrated city for business, aviation, hospitality, and residential living. Formerly the site of a major US Air Force base, Clark has transformed into one of the Philippines' most dynamic economic zones, attracting multinational corporations, five-star hotels, and premium residential developments.",
    heroImage: 'https://images.unsplash.com/photo-1585821478570-da8b54e0e599?w=1920&h=1080&fit=crop&auto=format',
    facts: [
      { label: 'Area', value: '4,400 hectares' },
      { label: 'Distance to NLEX', value: '5 minutes' },
      { label: 'Distance to Manila', value: '80 km' },
      { label: 'International Airport', value: 'Clark International' },
      { label: 'Economic Zone', value: 'SBFZ Special Zone' },
      { label: 'Property Type', value: 'Leasehold / Freehold' },
    ],
    highlights: [
      'Home to Clark International Airport with direct flights to Asia',
      'Special Economic Zone with tax incentives and duty-free privileges',
      'World-class golf courses, casinos, and resort hotels',
      'International schools including British Council-accredited campuses',
      'Premium commercial district with global brands and restaurants',
      'Proximity to Subic Bay Freeport and Manila via NLEX',
    ],
    cityKey: 'Clark',
    nearbyLocations: [
      { name: 'Angeles City', distance: '5 km', key: 'angeles' },
      { name: 'Mabalacat', distance: '8 km', key: 'mabalacat' },
      { name: 'San Fernando', distance: '18 km', key: 'san-fernando' },
    ],
  },
  angeles: {
    name: 'Angeles City',
    tagline: 'The Heart of Pampanga.',
    description: "Angeles City is the commercial and cultural capital of Pampanga, renowned for its vibrant dining scene, rich Kapampangan heritage, and rapidly growing real estate market. Positioned adjacent to Clark Freeport Zone, Angeles enjoys excellent connectivity and a thriving property sector driven by BPOs, retail growth, and expatriate communities.",
    heroImage: '/angeles-view.jpg',
    heroOverlay: 'light',
    facts: [
      { label: 'Population', value: '450,000+' },
      { label: 'City Classification', value: 'Independent Component City' },
      { label: 'Distance to Clark', value: '5 km' },
      { label: 'Known For', value: 'Food, Culture, BPOs' },
      { label: 'Growth Rate', value: '8.2% annually' },
      { label: 'Main Districts', value: 'Balibago, Sto. Rosario' },
    ],
    highlights: [
      'Kapampangan cuisine capital of the Philippines',
      'Robust BPO and technology sector driving rental demand',
      'SM City Angeles, Marquee Mall, and major retail anchors',
      'Excellent public and private schools and universities',
      'Active expat community with international lifestyle amenities',
      'Strong residential appreciation year-on-year',
    ],
    cityKey: 'Angeles City',
    nearbyLocations: [
      { name: 'Clark Freeport', distance: '5 km', key: 'clark' },
      { name: 'Mabalacat', distance: '12 km', key: 'mabalacat' },
      { name: 'San Fernando', distance: '15 km', key: 'san-fernando' },
    ],
  },
  mabalacat: {
    name: 'Mabalacat City',
    tagline: 'Gateway to Clark.',
    description: "Mabalacat City serves as the northern gateway to Clark Freeport Zone, offering a compelling mix of affordability and strategic location. With rapid urbanization fueled by Clark's expansion, Mabalacat has become an attractive destination for property investors seeking value appreciation and rental income from Clark's growing workforce.",
    heroImage: 'https://images.unsplash.com/photo-1670946637333-7db60b7b9a7a?w=1920&h=1080&fit=crop&auto=format',
    facts: [
      { label: 'Area', value: '83.2 sq km' },
      { label: 'Distance to Clark', value: '8 km' },
      { label: 'Key Feature', value: 'NLEX Entry/Exit' },
      { label: 'Designation', value: 'Component City' },
      { label: 'Growth Trend', value: 'Rapidly developing' },
      { label: 'Property Types', value: 'House & Lot, Condo' },
    ],
    highlights: [
      'Direct NLEX access for fast travel to Metro Manila',
      'Affordable land and housing compared to Clark proper',
      'Growing commercial and industrial zone',
      'Increasing demand from Clark and Subic relocations',
      'Master-planned residential communities in development',
      'Proximity to Clark International Airport',
    ],
    cityKey: 'Mabalacat',
    nearbyLocations: [
      { name: 'Clark Freeport', distance: '8 km', key: 'clark' },
      { name: 'Angeles City', distance: '12 km', key: 'angeles' },
      { name: 'San Fernando', distance: '22 km', key: 'san-fernando' },
    ],
  },
  'san-fernando': {
    name: 'City of San Fernando',
    tagline: 'The Capital of Pampanga.',
    description: "As the provincial capital of Pampanga, the City of San Fernando is the administrative, commercial, and cultural center of the region. Known globally for its Giant Lantern Festival, San Fernando offers a well-established urban infrastructure, premium residential enclaves, and a growing property market underpinned by government and commercial development.",
    heroImage: 'https://images.unsplash.com/photo-1511721464821-5641710d5bf2?w=1920&h=1080&fit=crop&auto=format',
    facts: [
      { label: 'Designation', value: 'Provincial Capital' },
      { label: 'Distance to Clark', value: '18 km' },
      { label: 'Distance to Manila', value: '70 km' },
      { label: 'Famous For', value: 'Giant Lantern Festival' },
      { label: 'Infrastructure', value: 'Provincial Government Hub' },
      { label: 'Property', value: 'Wide Mix Available' },
    ],
    highlights: [
      'Provincial capital with robust government and commercial base',
      'World-famous Giant Lantern Festival drawing tourists globally',
      'Major retail destinations including SM City and Robinsons',
      'Several private hospitals and medical centers',
      'Well-connected highway network to Clark and Manila',
      'Established premium residential villages and subdivisions',
    ],
    cityKey: 'San Fernando',
    nearbyLocations: [
      { name: 'Clark Freeport', distance: '18 km', key: 'clark' },
      { name: 'Angeles City', distance: '15 km', key: 'angeles' },
      { name: 'Porac', distance: '15 km', key: 'porac' },
    ],
  },
  porac: {
    name: 'Porac',
    tagline: 'Serenity in the Foothills.',
    description: "Porac is a rapidly growing municipality nestled at the foot of Mt. Pinatubo, offering a serene rural lifestyle within easy reach of Clark. Known for its agricultural landscapes, agro-tourism sites, and eco-tourism destinations, Porac is increasingly sought after for large estate lots, farm developments, and low-density residential communities.",
    heroImage: 'https://images.unsplash.com/photo-1476410872551-7bfbf7540c9e?w=1920&h=1080&fit=crop&auto=format',
    facts: [
      { label: 'Type', value: 'Municipality' },
      { label: 'Distance to Clark', value: '20 km' },
      { label: 'Known For', value: 'Agro-tourism, Eco Farms' },
      { label: 'Terrain', value: 'Foothills & Valleys' },
      { label: 'Land Use', value: 'Agricultural & Residential' },
      { label: 'Land Prices', value: 'Starting ₱650/sqm' },
    ],
    highlights: [
      'Large estate lots at accessible price points',
      'Scenic Mt. Pinatubo lahar terrain and eco-tourism sites',
      'Ideal for agro-tourism resorts and wellness retreats',
      'Low-density, tranquil lifestyle away from urban density',
      'Growing road infrastructure connecting to Clark',
      'Government-supported agricultural investment programs',
    ],
    cityKey: 'Porac',
    nearbyLocations: [
      { name: 'Clark Freeport', distance: '20 km', key: 'clark' },
      { name: 'San Fernando', distance: '15 km', key: 'san-fernando' },
      { name: 'Angeles City', distance: '22 km', key: 'angeles' },
    ],
  },
}

export default function LocationPage({ location, navigate, toast }: LocationPageProps) {
  const loc = LOCATIONS[location]
  const { properties } = useLiveProperties()
  const cityProps = properties.filter((p) => p.city === loc.cityKey).slice(0, 3)
  const cityCondos = condominiums.filter((c) => c.location.toLowerCase().includes(loc.cityKey.toLowerCase())).slice(0, 2)
  const { ref: r1, visible: v1 } = useReveal()
  const { ref: r2, visible: v2 } = useReveal()
  const { ref: r3, visible: v3 } = useReveal()

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location])

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative h-[80vh] min-h-[540px] flex items-end overflow-hidden bg-navy">
        <div className="absolute inset-0">
          <img
            src={loc.heroImage}
            alt={loc.name}
            className="animate-hero-zoom w-full h-full object-cover"
          />
          <div
            className={`absolute inset-0 bg-gradient-to-t ${
              loc.heroOverlay === 'light'
                ? 'from-navy/75 via-navy/20 to-transparent'
                : 'from-navy/95 via-navy/50 to-navy/20'
            }`}
          />
        </div>
        <div className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-12 pb-16 w-full">
          <nav className="flex items-center gap-2 text-[11px] font-display text-white/40 mb-6">
            <button onClick={() => navigate('home')} className="hover:text-white/70 transition-colors">Home</button>
            <span>/</span>
            <span className="text-white/60">Locations</span>
            <span>/</span>
            <span className="text-white/60">{loc.name}</span>
          </nav>
          <p className="text-gold text-[11px] font-display font-semibold tracking-[0.3em] uppercase mb-3 animate-fade-up">
            Location Guide
          </p>
          <h1 className="font-serif text-white animate-fade-up delay-1 mb-4" style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)' }}>
            {loc.tagline}
          </h1>
          <p className="text-white/60 font-display text-sm max-w-lg animate-fade-up delay-2">
            Everything you need to know about living and investing in {loc.name}.
          </p>
        </div>
      </section>

      {/* Quick Facts */}
      <div className="bg-navy border-t border-white/10">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-white/10">
            {loc.facts.map((f) => (
              <div key={f.label} className="px-5 py-6 text-center">
                <p className="font-serif text-white text-sm mb-0.5">{f.value}</p>
                <p className="text-[9px] font-display tracking-[0.12em] uppercase text-white/30">{f.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* About Section */}
      <section ref={r1} className="py-16 lg:py-24 bg-white">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 transition-all duration-700 ${v1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div>
              <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-3">About {loc.name}</p>
              <h2 className="font-serif text-charcoal text-2xl lg:text-3xl mb-5">Why invest here?</h2>
              <p className="text-charcoal font-display text-sm leading-relaxed mb-6">{loc.description}</p>
              <button
                onClick={() => navigate('properties')}
                className="px-7 py-3 rounded-full border border-navy text-xs font-display font-semibold tracking-[0.15em] uppercase text-navy hover:bg-navy hover:text-white shadow-sm hover:shadow-md transition-all"
              >
                View {loc.name} Properties
              </button>
            </div>
            <div>
              <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-4">Highlights</p>
              <ul className="flex flex-col gap-3">
                {loc.highlights.map((h, i) => (
                  <li key={i} className="flex items-start gap-3 py-3 border-b border-line last:border-0">
                    <span className="text-gold text-[10px] mt-0.5 flex-shrink-0">◆</span>
                    <span className="text-sm font-display text-charcoal">{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section ref={r2} className="py-16 lg:py-24 bg-cream">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className={`flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 transition-all duration-700 ${v2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div>
              <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">Properties</p>
              <h2 className="font-serif text-charcoal text-2xl lg:text-3xl">Available in {loc.name}</h2>
            </div>
            <button
              onClick={() => navigate('properties')}
              className="group text-xs font-display font-semibold tracking-[0.15em] uppercase text-charcoal hover:text-navy transition-colors flex items-center gap-2"
            >
              All Properties
              <span className="w-7 h-7 rounded-full bg-parchment flex items-center justify-center group-hover:bg-gold group-hover:text-white transition-colors">→</span>
            </button>
          </div>
          {cityProps.length > 0 ? (
            <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 delay-150 ${v2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              {cityProps.map((p) => (
                <PropertyCard key={p.id} property={p} onClick={(id) => navigate('property', id)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 rounded-2xl border border-line/70 bg-white">
              <p className="text-warm-gray font-display text-sm mb-3">No listings currently available in {loc.name}.</p>
              <button onClick={() => navigate('properties')} className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-gold">
                Browse All Locations →
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Nearby Locations */}
      <section ref={r3} className="py-16 lg:py-20 bg-white">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className={`transition-all duration-700 ${v3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">Explore Nearby</p>
            <h2 className="font-serif text-charcoal text-2xl lg:text-3xl mb-8">Nearby Locations</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {loc.nearbyLocations.map((n) => (
                <button
                  key={n.name}
                  onClick={() => navigate('location' as Page, n.key)}
                  className="group flex items-center justify-between p-5 rounded-2xl bg-parchment/70 hover:bg-parchment card-lift text-left"
                >
                  <div>
                    <h3 className="font-display font-semibold text-charcoal text-sm mb-0.5 group-hover:text-navy transition-colors">{n.name}</h3>
                    <p className="text-[11px] font-display text-warm-gray">{n.distance} from {loc.name.split(' ')[0]}</p>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-warm-gray group-hover:bg-gold group-hover:text-white transition-all group-hover:translate-x-0.5">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-14 lg:py-18">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p className="text-gold text-[11px] font-display font-semibold tracking-[0.25em] uppercase mb-2">Find Your Property</p>
            <h2 className="font-serif text-white text-2xl lg:text-3xl">Ready to explore {loc.name}?</h2>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            <button
              onClick={() => navigate('properties')}
              className="px-7 py-3 rounded-full bg-gold text-white text-xs font-display font-semibold tracking-[0.12em] uppercase shadow-sm hover:bg-white hover:text-navy hover:shadow-md transition-all"
            >
              Browse Properties
            </button>
            <button
              onClick={() => { toast('Request sent! An agent will contact you shortly.') }}
              className="px-7 py-3 rounded-full border border-white/30 text-white text-xs font-display font-semibold tracking-[0.12em] uppercase hover:border-white hover:bg-white/10 transition-all"
            >
              Talk to an Agent
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
