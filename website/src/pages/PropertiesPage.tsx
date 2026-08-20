import { useState, useMemo } from 'react'
import PropertyCard from '../components/PropertyCard'
import Dropdown, { DropdownItem } from '../components/Dropdown'
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
      <div className="bg-navy pt-24 pb-10 px-6 lg:px-12">
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
      <div className="sticky top-16 z-40 bg-white/95 backdrop-blur-md border-b border-line/60 shadow-[0_8px_24px_-16px_rgba(15,31,61,0.18)]">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 py-3.5">
            {/* Desktop Filters */}
            <div className="hidden lg:flex items-center gap-2 flex-1 flex-wrap">
              {/* Location */}
              <Dropdown
                triggerClassName="relative flex flex-col gap-0 bg-parchment/60 hover:bg-parchment rounded-full pl-4 pr-8 py-1.5 transition-colors text-left"
                trigger={() => (
                  <>
                    <span className="text-[8px] font-display tracking-[0.16em] uppercase text-warm-gray leading-none block">Location</span>
                    <span className="text-xs font-display font-medium text-charcoal leading-tight block">{city}</span>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[8px] text-gold-dark">▾</span>
                  </>
                )}
              >
                {(close) => (
                  <div className="max-h-72 overflow-y-auto min-w-[180px]">
                    {CITIES.map((c) => (
                      <DropdownItem key={c} active={city === c} onClick={() => { setCity(c); close() }}>{c}</DropdownItem>
                    ))}
                  </div>
                )}
              </Dropdown>

              {/* Type */}
              <Dropdown
                triggerClassName="relative flex flex-col gap-0 bg-parchment/60 hover:bg-parchment rounded-full pl-4 pr-8 py-1.5 transition-colors text-left"
                trigger={() => (
                  <>
                    <span className="text-[8px] font-display tracking-[0.16em] uppercase text-warm-gray leading-none block">Type</span>
                    <span className="text-xs font-display font-medium text-charcoal leading-tight block">{type || 'Any Type'}</span>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[8px] text-gold-dark">▾</span>
                  </>
                )}
              >
                {(close) => (
                  <div className="min-w-[180px]">
                    <DropdownItem active={type === ''} onClick={() => { setType(''); close() }}>Any Type</DropdownItem>
                    {PROPERTY_TYPES.map((t) => (
                      <DropdownItem key={t} active={type === t} onClick={() => { setType(t); close() }}>{t}</DropdownItem>
                    ))}
                  </div>
                )}
              </Dropdown>

              {/* Status */}
              <div className="flex items-center gap-0.5 bg-parchment/60 rounded-full p-1">
                {(['All', 'For Sale', 'For Rent', 'Pre-Selling'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatus(s)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-display font-medium tracking-[0.06em] uppercase transition-all ${
                      status === s
                        ? 'bg-navy text-white shadow-sm'
                        : 'text-warm-gray hover:text-charcoal'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* Beds */}
              <Dropdown
                triggerClassName="relative flex flex-col gap-0 bg-parchment/60 hover:bg-parchment rounded-full pl-4 pr-8 py-1.5 transition-colors text-left"
                trigger={() => (
                  <>
                    <span className="text-[8px] font-display tracking-[0.16em] uppercase text-warm-gray leading-none block">Min Beds</span>
                    <span className="text-xs font-display font-medium text-charcoal leading-tight block">{minBeds === 0 ? 'Any' : `${minBeds}+`}</span>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[8px] text-gold-dark">▾</span>
                  </>
                )}
              >
                {(close) => (
                  <div className="min-w-[100px]">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <DropdownItem key={n} active={minBeds === n} onClick={() => { setMinBeds(n); close() }}>{n === 0 ? 'Any' : `${n}+`}</DropdownItem>
                    ))}
                  </div>
                )}
              </Dropdown>

              {/* Price */}
              <div className="flex flex-col gap-1 bg-parchment/60 rounded-full px-4 py-1.5 min-w-[150px]">
                <div className="flex items-center justify-between">
                  <label className="text-[8px] font-display tracking-[0.16em] uppercase text-warm-gray leading-none">Max Price</label>
                  <span className="text-[10px] font-display font-semibold text-navy ml-4">{priceLabel(maxPrice)}</span>
                </div>
                <input
                  type="range"
                  min={1000000}
                  max={100000000}
                  step={1000000}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {hasFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-[10px] font-display font-medium text-warm-gray hover:text-gold-dark transition-colors ml-1"
                >
                  <span>✕</span> Clear
                </button>
              )}
            </div>

            {/* Mobile: Filter toggle */}
            <div className="flex lg:hidden items-center justify-between gap-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="relative flex items-center gap-2 px-4 py-2 rounded-full border border-line bg-parchment/50 text-xs font-display font-medium tracking-[0.1em] uppercase text-charcoal"
              >
                {showFilters ? '✕ Close' : '⊞ Filters'}
                {hasFilters && <span className="w-1.5 h-1.5 bg-gold rounded-full" />}
              </button>
              <Dropdown
                align="right"
                triggerClassName="relative bg-parchment/50 rounded-full pl-3 pr-7 py-2 text-left"
                trigger={() => (
                  <>
                    <span className="text-xs font-display text-charcoal">{SORT_OPTIONS.find((o) => o.value === sort)?.label}</span>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[8px] text-gold-dark">▾</span>
                  </>
                )}
              >
                {(close) => (
                  <div className="min-w-[170px]">
                    {SORT_OPTIONS.map((o) => (
                      <DropdownItem key={o.value} active={sort === o.value} onClick={() => { setSort(o.value); close() }}>{o.label}</DropdownItem>
                    ))}
                  </div>
                )}
              </Dropdown>
            </div>

            {/* Right side: Sort + View */}
            <div className="hidden lg:flex items-center gap-3 ml-auto">
              <Dropdown
                align="right"
                triggerClassName="relative bg-parchment/60 hover:bg-parchment rounded-full pl-4 pr-7 py-2 transition-colors text-left"
                trigger={() => (
                  <>
                    <span className="text-xs font-display font-medium text-charcoal">{SORT_OPTIONS.find((o) => o.value === sort)?.label}</span>
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[8px] text-gold-dark">▾</span>
                  </>
                )}
              >
                {(close) => (
                  <div className="min-w-[170px]">
                    {SORT_OPTIONS.map((o) => (
                      <DropdownItem key={o.value} active={sort === o.value} onClick={() => { setSort(o.value); close() }}>{o.label}</DropdownItem>
                    ))}
                  </div>
                )}
              </Dropdown>

              <div className="flex items-center gap-0.5 bg-parchment/60 rounded-full p-1">
                <button
                  onClick={() => setView('grid')}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${view === 'grid' ? 'bg-white text-navy shadow-sm' : 'text-warm-gray hover:text-charcoal'}`}
                  aria-label="Grid view"
                >
                  ⊞
                </button>
                <button
                  onClick={() => setView('list')}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${view === 'list' ? 'bg-white text-navy shadow-sm' : 'text-warm-gray hover:text-charcoal'}`}
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
                  <Dropdown
                    triggerClassName="w-full flex items-center justify-between rounded-lg border border-line py-2 px-3 bg-white text-left"
                    trigger={() => (
                      <>
                        <span className="text-sm font-display text-charcoal">{city}</span>
                        <span className="text-[9px] text-gold-dark">▾</span>
                      </>
                    )}
                  >
                    {(close) => (
                      <div className="max-h-56 overflow-y-auto min-w-[160px]">
                        {CITIES.map((c) => (
                          <DropdownItem key={c} active={city === c} onClick={() => { setCity(c); close() }}>{c}</DropdownItem>
                        ))}
                      </div>
                    )}
                  </Dropdown>
                </div>
                <div>
                  <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Property Type</label>
                  <Dropdown
                    triggerClassName="w-full flex items-center justify-between rounded-lg border border-line py-2 px-3 bg-white text-left"
                    trigger={() => (
                      <>
                        <span className="text-sm font-display text-charcoal">{type || 'Any Type'}</span>
                        <span className="text-[9px] text-gold-dark">▾</span>
                      </>
                    )}
                  >
                    {(close) => (
                      <div className="min-w-[160px]">
                        <DropdownItem active={type === ''} onClick={() => { setType(''); close() }}>Any Type</DropdownItem>
                        {PROPERTY_TYPES.map((t) => (
                          <DropdownItem key={t} active={type === t} onClick={() => { setType(t); close() }}>{t}</DropdownItem>
                        ))}
                      </div>
                    )}
                  </Dropdown>
                </div>
              </div>
              <div className="mb-4">
                <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-2">Status</label>
                <div className="flex flex-wrap gap-2">
                  {(['All', 'For Sale', 'For Rent', 'Pre-Selling'] as const).map((s) => (
                    <button key={s} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-full text-[10px] font-display tracking-wide uppercase border transition-colors ${status === s ? 'bg-navy text-white border-navy' : 'border-line text-warm-gray'}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {hasFilters && (
                  <button onClick={clearFilters} className="flex-1 py-2.5 rounded-full border border-line text-xs font-display tracking-[0.1em] uppercase text-warm-gray">
                    Clear Filters
                  </button>
                )}
                <button onClick={() => setShowFilters(false)} className="flex-1 py-2.5 rounded-full bg-navy text-white text-xs font-display tracking-[0.1em] uppercase">
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
              <div key={i} className="bg-white rounded-2xl border border-line/70 overflow-hidden">
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
          <div className="text-center py-24 bg-white rounded-2xl border border-line/70">
            <p className="text-4xl mb-4 text-gold">◎</p>
            <h3 className="font-serif text-charcoal text-xl mb-2">No properties found</h3>
            <p className="text-warm-gray font-display text-sm mb-6">
              Try adjusting your filters or exploring nearby locations.
            </p>
            <button
              onClick={clearFilters}
              className="px-6 py-3 rounded-full bg-navy text-xs font-display font-semibold tracking-[0.15em] uppercase text-white hover:bg-gold transition-colors"
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
            <button className="px-10 py-3.5 rounded-full border border-line bg-white text-xs font-display font-semibold tracking-[0.15em] uppercase text-warm-gray hover:border-gold hover:text-navy shadow-sm hover:shadow-md transition-all">
              Load More Properties
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
