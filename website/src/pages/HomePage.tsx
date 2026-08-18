import { useState, useEffect, useRef } from 'react'
import PropertyCard from '../components/PropertyCard'
import ImageCarousel from '../components/ImageCarousel'
import { condominiums, agents, formatPrice } from '../lib/data'
import { useLiveProperties } from '../lib/useLiveProperties'
import type { Page } from '../components/Navigation'

const CLARK_SHOWCASE_IMAGES = [
  { src: '/clark-view.png', alt: 'Clark city skyline at sunset' },
  { src: '/tech-hub.jpg', alt: 'Clark Tech Hub' },
  { src: '/han-casino.jpg', alt: 'Hann Casino Resort, Clark' },
  { src: '/clark-cdc-view.jpg', alt: 'Clark Development Corporation park' },
  { src: '/arayat-view.jpg', alt: 'View of Mt. Arayat from Clark' },
]

interface HomePageProps {
  navigate: (page: Page, id?: string) => void
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, visible }
}

function HeroSection({ navigate }: { navigate: HomePageProps['navigate'] }) {
  const [activeTab, setActiveTab] = useState<'Buy' | 'Rent'>('Buy')
  const [location, setLocation] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [priceRange, setPriceRange] = useState('')

  return (
    <section className="relative h-[88vh] min-h-[600px] flex items-center overflow-hidden bg-charcoal">
      {/* Hero image */}
      <div className="absolute inset-0 overflow-hidden">
        <img
          src="/cover.png"
          alt="Clark, Pampanga skyline"
          className="animate-hero-zoom w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal/35 via-charcoal/15 to-charcoal/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-charcoal/20 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-12 w-full pt-20">
        <div className="max-w-2xl">
          <p className="animate-fade-up text-gold text-[11px] font-display font-semibold tracking-[0.3em] uppercase mb-4">
            Premium Real Estate in Clark
          </p>
          <h1 className="animate-fade-up delay-1 font-serif text-white leading-[1.08] mb-5"
            style={{ fontSize: 'clamp(2.5rem, 5.5vw, 4.5rem)' }}
          >
            Find a Place<br />Worth Coming<br />Home To.
          </h1>
          <p className="animate-fade-up delay-2 text-white/65 text-base font-display leading-relaxed max-w-lg mb-10">
            Discover exceptional condominiums, residences, land, and commercial properties across Clark and Pampanga.
          </p>
        </div>

        {/* Search Bar */}
        <div className="animate-fade-up delay-3 w-full max-w-4xl">
          <div
            className="bg-black/30 backdrop-blur-xl border border-white/20"
            style={{ boxShadow: '0 32px 80px -12px rgba(0,0,0,0.5)' }}
          >
            {/* Tabs */}
            <div className="flex border-b border-white/15">
              {(['Buy', 'Rent'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-7 py-3.5 text-sm font-display font-semibold tracking-[0.1em] uppercase transition-colors ${
                    activeTab === tab
                      ? 'text-white border-b-2 border-gold -mb-px'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Inputs */}
            <div className="flex flex-col md:flex-row">
              <div className="flex-1 px-5 py-4 border-b md:border-b-0 md:border-r border-white/15">
                <label className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-white/70 mb-2">
                  Location
                </label>
                <select
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full text-base font-display font-medium text-white bg-transparent outline-none appearance-none cursor-pointer"
                >
                  <option value="" className="text-charcoal">All Locations</option>
                  <option className="text-charcoal">Clark Freeport Zone</option>
                  <option className="text-charcoal">Angeles City</option>
                  <option className="text-charcoal">Mabalacat City</option>
                  <option className="text-charcoal">San Fernando</option>
                  <option className="text-charcoal">Porac</option>
                  <option className="text-charcoal">Arayat</option>
                </select>
              </div>

              <div className="flex-1 px-5 py-4 border-b md:border-b-0 md:border-r border-white/15">
                <label className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-white/70 mb-2">
                  Property Type
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value)}
                  className="w-full text-base font-display font-medium text-white bg-transparent outline-none appearance-none cursor-pointer"
                >
                  <option value="" className="text-charcoal">Any Type</option>
                  <option className="text-charcoal">Condominium</option>
                  <option className="text-charcoal">House & Lot</option>
                  <option className="text-charcoal">Land</option>
                  <option className="text-charcoal">Commercial</option>
                  <option className="text-charcoal">Townhouse</option>
                </select>
              </div>

              <div className="flex-1 px-5 py-4 border-b md:border-b-0 md:border-r border-white/15">
                <label className="block text-xs font-display font-semibold tracking-[0.15em] uppercase text-white/70 mb-2">
                  Price Range
                </label>
                <select
                  value={priceRange}
                  onChange={(e) => setPriceRange(e.target.value)}
                  className="w-full text-base font-display font-medium text-white bg-transparent outline-none appearance-none cursor-pointer"
                >
                  <option value="" className="text-charcoal">Any Price</option>
                  <option className="text-charcoal">Under ₱5M</option>
                  <option className="text-charcoal">₱5M – ₱10M</option>
                  <option className="text-charcoal">₱10M – ₱20M</option>
                  <option className="text-charcoal">₱20M – ₱50M</option>
                  <option className="text-charcoal">Above ₱50M</option>
                </select>
              </div>

              <button
                onClick={() => navigate('properties')}
                className="px-8 py-4 bg-gold text-white font-display font-semibold text-sm tracking-[0.1em] uppercase hover:bg-gold-dark transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                Search Properties
                <span>→</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-fade-in delay-5 flex flex-col items-center gap-2">
        <div className="w-px h-12 bg-gradient-to-b from-transparent to-white/30" />
        <p className="text-white/30 text-[9px] font-display tracking-[0.2em] uppercase">Scroll</p>
      </div>
    </section>
  )
}

function StatsBar() {
  const { ref, visible } = useReveal()
  const stats = [
    { value: '1,240+', label: 'Active Listings' },
    { value: '15', label: 'Years of Service' },
    { value: '8', label: 'Cities Covered' },
    { value: '₱12B+', label: 'Properties Sold' },
  ]

  return (
    <div ref={ref} className="bg-gray-100">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-200">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={`px-8 py-7 lg:py-9 text-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <p className="font-serif text-3xl lg:text-4xl text-charcoal mb-1">{stat.value}</p>
              <p className="text-[11px] font-display tracking-[0.15em] uppercase text-warm-gray">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function FeaturedSection({ navigate }: { navigate: HomePageProps['navigate'] }) {
  const { ref, visible } = useReveal()
  const { properties } = useLiveProperties()
  const featured = properties.filter((p) => p.featured).slice(0, 4)
  const [main, ...supporting] = featured

  if (!main) return null

  return (
    <section ref={ref} className="py-20 lg:py-28 bg-cream">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className={`flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div>
            <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">
              Featured Properties
            </p>
            <h2 className="font-serif text-charcoal" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}>
              Exceptional spaces,<br />carefully selected.
            </h2>
          </div>
          <button
            onClick={() => navigate('properties')}
            className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-charcoal hover:text-gold transition-colors flex items-center gap-2 md:mb-2"
          >
            View All Properties <span>→</span>
          </button>
        </div>

        {/* Editorial Grid */}
        <div className={`grid grid-cols-1 lg:grid-cols-5 gap-5 lg:gap-6 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          {/* Large featured */}
          <div className="lg:col-span-3">
            <PropertyCard property={main} onClick={(id) => navigate('property', id)} variant="large" />
          </div>

          {/* Supporting grid */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-5 lg:gap-6">
            {supporting.slice(0, 2).map((p) => (
              <PropertyCard key={p.id} property={p} onClick={(id) => navigate('property', id)} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function DiscoverClark({ navigate }: { navigate: HomePageProps['navigate'] }) {
  const { ref, visible } = useReveal()

  return (
    <section ref={ref} className="relative overflow-hidden bg-parchment">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[520px]">
          {/* Text */}
          <div
            className={`flex flex-col justify-center py-16 lg:py-24 pr-0 lg:pr-16 transition-all duration-700 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}
          >
            <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-4">
              Why Clark?
            </p>
            <h2 className="font-serif text-charcoal leading-tight mb-6" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.8rem)' }}>
              Live Where Opportunity<br />Meets Lifestyle.
            </h2>
            <p className="text-warm-gray font-display leading-relaxed text-sm mb-6 max-w-md">
              Clark Freeport Zone is Central Luzon's premier business, tourism, and residential hub. With world-class infrastructure, international schools, and direct flights across Asia, Clark offers a quality of life found in few places in the Philippines.
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3.5 mb-8">
              {[
                'Clark International Airport',
                'Business & Investment Hub',
                'Modern Residential Communities',
                'Shopping & Entertainment',
                'Parks & Green Spaces',
                'Golf & Leisure',
                'World-Class Hotels & Resorts',
                'Adventure & Family Attractions',
                'History & Heritage',
                'Live–Work–Play Lifestyle',
              ].map((item, i) => (
                <li
                  key={item}
                  className={`flex items-start gap-2.5 text-xs font-display text-warm-gray transition-all duration-500 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'}`}
                  style={{ transitionDelay: visible ? `${300 + i * 90}ms` : '0ms' }}
                >
                  <span className="text-gold mt-0.5 flex-shrink-0">◆</span>
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => navigate('properties')}
              className="self-start px-7 py-3 border border-charcoal text-xs font-display font-semibold tracking-[0.15em] uppercase text-charcoal hover:bg-charcoal hover:text-white transition-all"
            >
              Explore Clark Properties
            </button>
          </div>

          {/* Image */}
          <div
            className={`relative min-h-[340px] lg:min-h-0 transition-all duration-700 delay-200 ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
          >
            <div className="absolute inset-0 lg:-inset-0 overflow-hidden">
              <ImageCarousel images={CLARK_SHOWCASE_IMAGES} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function CondominiumSection({ navigate }: { navigate: HomePageProps['navigate'] }) {
  const { ref, visible } = useReveal()

  return (
    <section ref={ref} className="py-20 lg:py-28 bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
        <div className={`flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div>
            <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">
              Condominium Developments
            </p>
            <h2 className="font-serif text-charcoal" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}>
              Premium living,<br />delivered.
            </h2>
          </div>
          <button
            onClick={() => navigate('condominiums')}
            className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-charcoal hover:text-gold transition-colors flex items-center gap-2 md:mb-2"
          >
            All Developments <span>→</span>
          </button>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 delay-150 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {condominiums.map((condo, i) => (
            <article
              key={condo.id}
              className="group cursor-pointer overflow-hidden bg-white card-lift border border-line"
              onClick={() => navigate('condominiums')}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="relative overflow-hidden img-zoom-container" style={{ aspectRatio: '3/2' }}>
                <img
                  src={condo.image}
                  alt={condo.name}
                  className="img-zoom w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-charcoal/70 via-charcoal/20 to-transparent" />
                <div className="absolute top-4 left-4">
                  <span className={`px-2.5 py-1 text-[9px] font-display font-semibold tracking-[0.1em] uppercase ${
                    condo.status === 'Ready for Occupancy' ? 'bg-emerald-600 text-white' :
                    condo.status === 'Completed' ? 'bg-charcoal text-white' :
                    condo.status === 'Pre-Selling' ? 'bg-gold text-white' :
                    'bg-blue-700 text-white'
                  }`}>
                    {condo.status}
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white/70 text-[10px] font-display tracking-wide mb-1">{condo.developer}</p>
                  <h3 className="text-white text-lg font-serif leading-tight">{condo.name}</h3>
                </div>
              </div>

              <div className="p-5">
                <p className="text-xs font-display text-warm-gray flex items-center gap-1 mb-3">
                  <span className="text-gold text-[9px]">◆</span>
                  {condo.location}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[10px] font-display text-warm-gray tracking-wide mb-0.5">
                      {condo.priceMode === 'rent' ? 'Estimated starting rent' : 'Starting From'}
                    </p>
                    <p className="text-xl font-serif text-charcoal">
                      {formatPrice(condo.startingPrice, condo.priceMode === 'rent' ? 'For Rent' : 'For Sale')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-display text-warm-gray mb-0.5">
                      {condo.floorRange ?? (condo.floors != null ? `${condo.floors} Floors` : '')}
                    </p>
                    <p className="text-[10px] font-display text-warm-gray">
                      {condo.areaRange ?? (condo.units != null ? `${condo.units} Units` : '')}
                    </p>
                  </div>
                </div>
                {(condo.buildingCount != null || condo.unitMix) && (
                  <p className="text-[10px] font-display text-warm-gray tracking-wide mb-3">
                    {[
                      condo.buildingCount != null ? `${condo.buildingCount} Buildings` : null,
                      condo.unitMix,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {condo.amenities.slice(0, 3).map((a) => (
                    <span key={a} className="px-2 py-0.5 bg-parchment text-[9px] font-display text-warm-gray tracking-wide">
                      {a}
                    </span>
                  ))}
                  {condo.amenities.length > 3 && (
                    <span className="px-2 py-0.5 bg-parchment text-[9px] font-display text-warm-gray">
                      +{condo.amenities.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function LocationsSection({ navigate }: { navigate: HomePageProps['navigate'] }) {
  const { ref, visible } = useReveal()

  const locations = [
    {
      name: 'Clark Freeport Zone',
      count: 48,
      image: '/free-port.png',
      tag: 'Most Popular',
      locKey: 'clark',
    },
    {
      name: 'Angeles City',
      count: 32,
      image: '/angeles-view.jpg',
      locKey: 'angeles',
    },
    {
      name: 'Mabalacat City',
      count: 18,
      image: '/dau-view.png',
      locKey: 'mabalacat',
    },
    {
      name: 'San Fernando',
      count: 24,
      image: '/azure.jpg',
      locKey: 'san-fernando',
    },
  ]

  return (
    <section ref={ref} className="py-20 lg:py-28 bg-cream">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
        <div className={`mb-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">
            Browse by Location
          </p>
          <h2 className="font-serif text-charcoal" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}>
            Find your city.
          </h2>
        </div>

        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 delay-150 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {locations.map((loc, i) => (
            <button
              key={loc.name}
              onClick={() => navigate('location', (loc as any).locKey)}
              className="group relative overflow-hidden img-zoom-container text-left"
              style={{ aspectRatio: '3/4', transitionDelay: `${i * 60}ms` }}
            >
              <img
                src={loc.image}
                alt={loc.name}
                className="img-zoom absolute inset-0 w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/80 via-charcoal/30 to-transparent" />
              <div className="absolute top-3 left-3">
                {loc.tag && (
                  <span className="px-2 py-0.5 bg-gold text-white text-[9px] font-display font-semibold tracking-[0.1em] uppercase">
                    {loc.tag}
                  </span>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-white font-serif text-lg leading-tight mb-1">{loc.name}</h3>
                <p className="text-white/60 text-xs font-display">{loc.count} properties</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

function AgentsSection({ navigate }: { navigate: HomePageProps['navigate'] }) {
  const { ref, visible } = useReveal()

  return (
    <section ref={ref} className="py-20 lg:py-28 bg-white">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
        <div className={`flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div>
            <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">
              Our Agents
            </p>
            <h2 className="font-serif text-charcoal" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}>
              Expert guidance,<br />personalized for you.
            </h2>
          </div>
          <button
            onClick={() => navigate('properties')}
            className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-charcoal hover:text-gold transition-colors flex items-center gap-2 md:mb-2"
          >
            Meet All Agents <span>→</span>
          </button>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 delay-150 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {agents.map((agent, i) => (
            <article
              key={agent.id}
              className="border border-line p-6 hover:border-gold-dark transition-colors group cursor-pointer"
              onClick={() => navigate('agent', agent.id)}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-16 h-16 overflow-hidden flex-shrink-0">
                  <img
                    src={agent.image}
                    alt={agent.name}
                    className="w-full h-full object-cover img-zoom group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                </div>
                <div>
                  <h3 className="text-base font-display font-semibold text-charcoal">{agent.name}</h3>
                  <p className="text-[11px] font-display text-warm-gray mt-0.5">{agent.title}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {agent.specialization.slice(0, 2).map((s) => (
                      <span key={s} className="px-1.5 py-0.5 bg-parchment text-[9px] font-display text-warm-gray">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-xs font-display text-warm-gray leading-relaxed mb-4 line-clamp-3">
                {agent.bio}
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-line">
                <div>
                  <p className="text-[11px] font-display text-warm-gray">{agent.listings} Listings</p>
                  <p className="text-[11px] font-display text-warm-gray">{agent.experience} Years Exp.</p>
                </div>
                <button className="px-4 py-2 border border-charcoal text-[10px] font-display font-semibold tracking-[0.12em] uppercase text-charcoal hover:bg-charcoal hover:text-white transition-colors">
                  Contact
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

function CTABanner({ navigate }: { navigate: HomePageProps['navigate'] }) {
  const { ref, visible } = useReveal()

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1776363497229-616cc7a541fe?w=1600&h=600&fit=crop&auto=format"
          alt="Luxury living"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-charcoal/80" />
      </div>
      <div
        className={`relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-12 py-20 lg:py-28 text-center transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
      >
        <p className="text-gold text-[11px] font-display font-semibold tracking-[0.3em] uppercase mb-4">
          Ready to Find Your Home?
        </p>
        <h2 className="font-serif text-white mb-4" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3.2rem)' }}>
          Let us guide you to<br />your perfect property.
        </h2>
        <p className="text-white/60 font-display text-sm max-w-md mx-auto mb-8">
          Speak with one of our expert consultants today. We know every corner of Clark and Pampanga.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate('properties')}
            className="px-8 py-3.5 bg-gold text-white text-xs font-display font-semibold tracking-[0.15em] uppercase hover:bg-gold-dark transition-colors"
          >
            Browse Properties
          </button>
          <button className="px-8 py-3.5 border border-white/40 text-white text-xs font-display font-semibold tracking-[0.15em] uppercase hover:border-white/80 transition-colors">
            Talk to an Agent
          </button>
        </div>
      </div>
    </section>
  )
}

function LatestListings({ navigate }: { navigate: HomePageProps['navigate'] }) {
  const { ref, visible } = useReveal()
  const { properties } = useLiveProperties()
  const latest = properties.filter((p) => p.isNew).slice(0, 3)

  return (
    <section ref={ref} className="py-20 lg:py-28 bg-parchment">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
        <div className={`flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12 transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
          <div>
            <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">
              Just Listed
            </p>
            <h2 className="font-serif text-charcoal" style={{ fontSize: 'clamp(1.8rem, 3.5vw, 3rem)' }}>
              New arrivals.
            </h2>
          </div>
          <button
            onClick={() => navigate('properties')}
            className="text-xs font-display font-semibold tracking-[0.15em] uppercase text-charcoal hover:text-gold transition-colors flex items-center gap-2 md:mb-2"
          >
            All New Listings <span>→</span>
          </button>
        </div>
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 transition-all duration-700 delay-150 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {latest.map((p) => (
            <PropertyCard key={p.id} property={p} onClick={(id) => navigate('property', id)} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default function HomePage({ navigate }: HomePageProps) {
  return (
    <div>
      <HeroSection navigate={navigate} />
      <StatsBar />
      <FeaturedSection navigate={navigate} />
      <DiscoverClark navigate={navigate} />
      <CondominiumSection navigate={navigate} />
      <LatestListings navigate={navigate} />
      <LocationsSection navigate={navigate} />
      <AgentsSection navigate={navigate} />
      <CTABanner navigate={navigate} />
    </div>
  )
}
