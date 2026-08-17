import { useState, useMemo } from 'react'
import PropertyCard from '../components/PropertyCard'
import { CITIES, PROPERTY_TYPES, type PropertyType } from '../lib/data'
import { useLiveProperties } from '../lib/useLiveProperties'
import type { Page } from '../components/Navigation'

interface PropertiesPageProps {
  navigate: (page: Page, id?: string) => void
}

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'price-asc', label: 'Price: Low to High' },
  { value: 'price-desc', label: 'Price: High to Low' },
  { value: 'area-desc', label: 'Largest Area' },
]

export default function PropertiesPage({ navigate }: PropertiesPageProps) {
  const [city, setCity] = useState('All Locations')
  const [type, setType] = useState<PropertyType | ''>('')
  const [status, setStatus] = useState<'All' | 'For Sale' | 'For Rent' | 'Pre-Selling'>('All')
  const [minBeds, setMinBeds] = useState<number>(0)
  const [maxPrice, setMaxPrice] = useState<number>(100000000)
  const [sort, setSort] = useState('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const { properties, loading } = useLiveProperties()

  const filtered = useMemo(() => {
    let result = [...properties]
    if (city !== 'All Locations') result = result.filter((p) => p.city === city || p.location.includes(city))
    if (type) result = result.filter((p) => p.type === type)
    if (status !== 'All') result = result.filter((p) => p.status === status)
    if (minBeds > 0) result = result.filter((p) => (p.bedrooms ?? 0) >= minBeds)
    result = result.filter((p) => p.price <= maxPrice)

    if (sort === 'price-asc') result.sort((a, b) => a.price - b.price)
    else if (sort === 'price-desc') result.sort((a, b) => b.price - a.price)
    else if (sort === 'area-desc') result.sort((a, b) => b.area - a.area)

    return result
  }, [city, type, status, minBeds, maxPrice, sort])

  const priceLabel = (val: number) =>
    val >= 1000000 ? `₱${(val / 1000000).toFixed(0)}M` : `₱${val.toLocaleString()}`

  const clearFilters = () => {
    setCity('All Locations')
    setType('')
    setStatus('All')
    setMinBeds(0)
    setMaxPrice(100000000)
  }

  const hasFilters = city !== 'All Locations' || type !== '' || status !== 'All' || minBeds > 0 || maxPrice < 100000000

  return (
    <div className="min-h-screen bg-cream">
      {/* Page Header */}
      <div className="bg-charcoal pt-24 pb-10 px-6 lg:px-12">
        <div className="max-w-screen-2xl mx-auto">
          <nav className="flex items-center gap-2 text-[11px] font-display text-white/40 mb-4">
            <button onClick={() => navigate('home')} className="hover:text-white/70 transition-colors">Home</button>
            <span>/</span>
            <span className="text-white/60">Properties</span>
          </nav>
          <h1 className="font-serif text-white text-3xl lg:text-4xl mb-2">Properties</h1>
          <p className="text-white/50 font-display text-sm">Explore premium real estate across Clark and Pampanga</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-16 z-40 bg-white border-b border-line shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 py-4">
            {/* Desktop Filters */}
            <div className="hidden lg:flex items-center gap-4 flex-1 flex-wrap">
              {/* City */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-display tracking-[0.15em] uppercase text-warm-gray">Location</label>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="text-xs font-display text-charcoal bg-transparent outline-none appearance-none pr-4 cursor-pointer border-b border-line pb-0.5"
                >
                  {CITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>

              <div className="w-px h-8 bg-line" />

              {/* Type */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-display tracking-[0.15em] uppercase text-warm-gray">Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as PropertyType | '')}
                  className="text-xs font-display text-charcoal bg-transparent outline-none appearance-none pr-4 cursor-pointer border-b border-line pb-0.5"
                >
                  <option value="">Any Type</option>
                  {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>

              <div className="w-px h-8 bg-line" />

              {/* Status */}
              <div className="flex items-center gap-2">
                {(['All', 'For Sale', 'For Rent', 'Pre-Selling'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`px-3 py-1.5 text-[10px] font-display font-medium tracking-[0.08em] uppercase transition-colors ${
                      status === s
                        ? 'bg-charcoal text-white'
                        : 'text-warm-gray hover:text-charcoal border border-line'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="w-px h-8 bg-line" />

              {/* Beds */}
              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-display tracking-[0.15em] uppercase text-warm-gray">Min Beds</label>
                <select
                  value={minBeds}
                  onChange={(e) => setMinBeds(Number(e.target.value))}
                  className="text-xs font-display text-charcoal bg-transparent outline-none appearance-none pr-4 cursor-pointer border-b border-line pb-0.5"
                >
                  <option value={0}>Any</option>
                  <option value={1}>1+</option>
                  <option value={2}>2+</option>
                  <option value={3}>3+</option>
                  <option value={4}>4+</option>
                </select>
              </div>

              <div className="w-px h-8 bg-line" />

              {/* Price */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-display tracking-[0.15em] uppercase text-warm-gray">Max Price</label>
                  <span className="text-[10px] font-display text-charcoal ml-4">{priceLabel(maxPrice)}</span>
                </div>
                <input
                  type="range"
                  min={1000000}
                  max={100000000}
                  step={1000000}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-32"
                />
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="text-[10px] font-display text-warm-gray hover:text-charcoal underline ml-2"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Mobile: Filter toggle */}
            <div className="flex lg:hidden items-center justify-between gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-line text-xs font-display font-medium tracking-[0.1em] uppercase text-charcoal"
              >
                {showFilters ? '✕ Close' : '⊞ Filters'}
                {hasFilters && <span className="w-1.5 h-1.5 bg-gold rounded-full" />}
              </button>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-xs font-display text-charcoal bg-transparent outline-none border-b border-line pb-0.5 cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {/* Right side: Sort + View */}
            <div className="hidden lg:flex items-center gap-4 ml-auto">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-xs font-display text-charcoal bg-transparent outline-none border-b border-line pb-0.5 cursor-pointer appearance-none"
              >
                {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              <div className="flex gap-1">
                <button
                  onClick={() => setView('grid')}
                  className={`p-2 text-lg transition-colors ${view === 'grid' ? 'text-charcoal' : 'text-line-dark hover:text-warm-gray'}`}
                  aria-label="Grid view"
                >
                  ⊞
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`p-2 text-lg transition-colors ${view === 'list' ? 'text-charcoal' : 'text-line-dark hover:text-warm-gray'}`}
                  aria-label="List view"
                >
                  ≡
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Filter Drawer */}
          {showFilters && (
            <div className="lg:hidden border-t border-line pb-5 pt-4 animate-slide-down">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Location</label>
                  <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full text-sm font-display border border-line py-2 px-3 bg-white outline-none">
                    {CITIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Property Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value as PropertyType | '')} className="w-full text-sm font-display border border-line py-2 px-3 bg-white outline-none">
                    <option value="">Any Type</option>
                    {PROPERTY_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-2">Status</label>
                <div className="flex flex-wrap gap-2">
                  {(['All', 'For Sale', 'For Rent', 'Pre-Selling'] as const).map((s) => (
                    <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 text-[10px] font-display tracking-wide uppercase border ${status === s ? 'bg-charcoal text-white border-charcoal' : 'border-line text-warm-gray'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {hasFilters && (
                  <button onClick={clearFilters} className="flex-1 py-2.5 border border-line text-xs font-display tracking-[0.1em] uppercase text-warm-gray">
                    Clear Filters
                  </button>
                )}
                <button onClick={() => setShowFilters(false)} className="flex-1 py-2.5 bg-charcoal text-white text-xs font-display tracking-[0.1em] uppercase">
                  Show Results
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 py-8">
        {/* Count */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-display text-warm-gray">
            <span className="text-charcoal font-semibold">{filtered.length}</span> {filtered.length === 1 ? 'property' : 'properties'} found
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white overflow-hidden">
                <div className="skeleton" style={{ aspectRatio: '4/3' }} />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-3 w-1/3 rounded" />
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-4xl mb-4">◎</p>
            <h3 className="font-serif text-charcoal text-xl mb-2">No properties found</h3>
            <p className="text-warm-gray font-display text-sm mb-6">
              Try adjusting your filters or exploring nearby locations.
            </p>
            <button
              onClick={clearFilters}
              className="px-6 py-3 border border-charcoal text-xs font-display font-semibold tracking-[0.15em] uppercase text-charcoal hover:bg-charcoal hover:text-white transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className={
            view === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'flex flex-col gap-4'
          }>
            {filtered.map((p) => (
              view === 'list' ? (
                <PropertyCard key={p.id} property={p} onClick={(id) => navigate('property', id)} variant="compact" />
              ) : (
                <PropertyCard key={p.id} property={p} onClick={(id) => navigate('property', id)} />
              )
            ))}
          </div>
        )}

        {/* Load More placeholder */}
        {filtered.length > 0 && (
          <div className="text-center mt-12">
            <button className="px-10 py-3.5 border border-line text-xs font-display font-semibold tracking-[0.15em] uppercase text-warm-gray hover:border-charcoal hover:text-charcoal transition-colors">
              Load More Properties
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
