import { useState, useEffect, useRef } from 'react'
import { condominiums, formatPrice } from '../lib/data'
import { useLiveProperties } from '../lib/useLiveProperties'
import PropertyCard from '../components/PropertyCard'
import type { Page } from '../components/Navigation'
import type { ToastType } from '../components/Toast'

interface CondominiumPageProps {
  navigate: (page: Page, id?: string) => void
  toast: (msg: string, type?: ToastType) => void
}

function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold: 0.1 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return { ref, visible }
}

type UnitStatus = 'Available' | 'Reserved' | 'Sold' | 'Not for Sale'

type Unit = {
  id: string
  number: string
  floor: number
  tower: string
  type: string
  area: number
  bedrooms: number
  bathrooms: number
  price: number
  status: UnitStatus
  view: string
}

function generateUnits(condoId: string): Unit[] {
  const towers = ['Tower A', 'Tower B']
  const unitTypes = [
    { type: 'Studio', area: 28, bedrooms: 0, bathrooms: 1, base: 3800000 },
    { type: '1 Bedroom', area: 48, bedrooms: 1, bathrooms: 1, base: 5500000 },
    { type: '2 Bedroom', area: 76, bedrooms: 2, bathrooms: 2, base: 8800000 },
    { type: '3 Bedroom', area: 125, bedrooms: 3, bathrooms: 2, base: 14000000 },
  ]
  const statuses: UnitStatus[] = ['Available', 'Available', 'Available', 'Reserved', 'Sold', 'Not for Sale']
  const views = ['City View', 'Garden View', 'Mountain View', 'Pool View']
  const units: Unit[] = []
  let idx = 0

  towers.forEach((tower) => {
    for (let floor = 3; floor <= 12; floor++) {
      for (let pos = 1; pos <= 4; pos++) {
        const typeData = unitTypes[pos - 1]
        const statusSeed = (idx * 7 + floor * 3 + pos * 11) % statuses.length
        const priceMod = 1 + (floor - 3) * 0.02 + (parseInt(condoId) * 0.05)
        units.push({
          id: `${condoId}-${tower[7]}-${floor}-${pos}`,
          number: `${tower[7]}${floor.toString().padStart(2, '0')}${pos.toString().padStart(2, '0')}`,
          floor,
          tower,
          type: typeData.type,
          area: typeData.area,
          bedrooms: typeData.bedrooms,
          bathrooms: typeData.bathrooms,
          price: Math.round(typeData.base * priceMod / 100000) * 100000,
          status: statuses[statusSeed],
          view: views[(idx * 3 + floor) % views.length],
        })
        idx++
      }
    }
  })
  return units
}

const STATUS_COLORS: Record<UnitStatus, string> = {
  Available: 'bg-emerald-100 border-emerald-300 hover:bg-emerald-200 text-emerald-800',
  Reserved: 'bg-amber-100 border-amber-300 text-amber-800 cursor-default',
  Sold: 'bg-red-100 border-red-200 text-red-400 cursor-default line-through',
  'Not for Sale': 'bg-parchment border-line text-warm-gray cursor-default',
}

const STATUS_DOT: Record<UnitStatus, string> = {
  Available: 'bg-emerald-500',
  Reserved: 'bg-amber-500',
  Sold: 'bg-red-400',
  'Not for Sale': 'bg-line-dark',
}

function UnitExplorer({ condoId, toast }: { condoId: string; toast: (msg: string, t?: ToastType) => void }) {
  const allUnits = generateUnits(condoId)
  const towers = ['Tower A', 'Tower B']
  const floors = Array.from({ length: 10 }, (_, i) => 12 - i)

  const [selectedTower, setSelectedTower] = useState('Tower A')
  const [selectedFloor, setSelectedFloor] = useState<number | null>(null)
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null)

  const floorUnits = allUnits.filter(
    (u) => u.tower === selectedTower && (selectedFloor === null || u.floor === selectedFloor)
  )

  const displayFloors = selectedFloor !== null
    ? [selectedFloor]
    : floors

  const availableCount = allUnits.filter((u) => u.tower === selectedTower && u.status === 'Available').length

  return (
    <div className="bg-white rounded-2xl border border-line/70 shadow-sm overflow-hidden">
      {/* Explorer Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border-b border-line">
        <div>
          <p className="text-[10px] font-display font-semibold tracking-[0.2em] uppercase text-gold mb-1">Interactive</p>
          <h3 className="font-serif text-charcoal text-xl">Unit Explorer</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {/* Tower Selector */}
          <div className="flex items-center gap-0.5 bg-parchment/60 rounded-full p-1">
            {towers.map((t) => (
              <button
                key={t}
                onClick={() => { setSelectedTower(t); setSelectedFloor(null); setSelectedUnit(null) }}
                className={`px-4 py-1.5 rounded-full text-xs font-display font-semibold tracking-[0.1em] uppercase transition-all ${
                  selectedTower === t ? 'bg-navy text-white shadow-sm' : 'text-warm-gray hover:text-charcoal'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-3 px-3">
            {(['Available', 'Reserved', 'Sold'] as UnitStatus[]).map((s) => (
              <div key={s} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} />
                <span className="text-[10px] font-display text-warm-gray">{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3">
        {/* Floor grid */}
        <div className="lg:col-span-2 p-5 border-r border-line overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-display text-warm-gray">
              {availableCount} units available in {selectedTower}
            </p>
            {selectedFloor && (
              <button
                onClick={() => { setSelectedFloor(null); setSelectedUnit(null) }}
                className="text-[10px] font-display text-gold hover:text-gold-dark underline"
              >
                ← All Floors
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2 min-w-[400px]">
            {displayFloors.map((floor) => {
              const fUnits = allUnits.filter((u) => u.tower === selectedTower && u.floor === floor)
              return (
                <div key={floor} className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedFloor(selectedFloor === floor ? null : floor)}
                    className={`w-10 h-8 flex-shrink-0 rounded-lg text-[11px] font-display font-semibold transition-colors ${
                      selectedFloor === floor
                        ? 'bg-navy text-white'
                        : 'bg-parchment text-warm-gray hover:bg-line'
                    }`}
                  >
                    {floor}F
                  </button>
                  <div className="flex gap-1.5 flex-1">
                    {fUnits.map((unit) => (
                      <button
                        key={unit.id}
                        onClick={() => {
                          if (unit.status === 'Available') {
                            setSelectedFloor(floor)
                            setSelectedUnit(unit)
                          }
                        }}
                        className={`flex-1 h-10 rounded-lg border text-[9px] font-display font-semibold transition-all ${STATUS_COLORS[unit.status]} ${
                          selectedUnit?.id === unit.id ? 'ring-2 ring-gold ring-offset-1' : ''
                        }`}
                        title={`${unit.number} — ${unit.type} — ${unit.status}`}
                      >
                        <div>{unit.number}</div>
                        <div className="text-[8px] opacity-70">{unit.type.split(' ')[0]}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Unit Detail Panel */}
        <div className="p-5">
          {selectedUnit ? (
            <div className="animate-fade-in">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[10px] font-display tracking-[0.2em] uppercase text-gold mb-1">Selected Unit</p>
                  <h4 className="font-serif text-charcoal text-2xl">{selectedUnit.number}</h4>
                  <p className="text-xs font-display text-warm-gray mt-0.5">{selectedUnit.tower} · Floor {selectedUnit.floor}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-[9px] font-display font-semibold tracking-[0.1em] uppercase ${
                  selectedUnit.status === 'Available' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {selectedUnit.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-5">
                {[
                  { label: 'Unit Type', value: selectedUnit.type },
                  { label: 'Floor Area', value: `${selectedUnit.area} sqm` },
                  ...(selectedUnit.bedrooms > 0 ? [{ label: 'Bedrooms', value: String(selectedUnit.bedrooms) }] : []),
                  { label: 'Bathrooms', value: String(selectedUnit.bathrooms) },
                  { label: 'View', value: selectedUnit.view },
                  { label: 'Floor', value: `${selectedUnit.floor}th` },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg bg-parchment">
                    <p className="text-[9px] font-display tracking-[0.12em] uppercase text-warm-gray mb-0.5">{label}</p>
                    <p className="text-xs font-display font-semibold text-charcoal">{value}</p>
                  </div>
                ))}
              </div>

              <div className="border-t border-line pt-4 mb-4">
                <p className="text-[10px] font-display text-warm-gray mb-1">Price</p>
                <p className="font-serif text-charcoal text-2xl">{formatPrice(selectedUnit.price, 'For Sale')}</p>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => toast(`Reservation request sent for Unit ${selectedUnit.number}!`)}
                  className="py-3 rounded-full bg-gold text-white text-xs font-display font-semibold tracking-[0.12em] uppercase shadow-sm hover:bg-navy hover:shadow-md transition-all"
                >
                  Reserve This Unit
                </button>
                <button
                  onClick={() => toast(`Inquiry sent for Unit ${selectedUnit.number}.`, 'info')}
                  className="py-3 rounded-full border border-line text-xs font-display font-semibold tracking-[0.12em] uppercase text-charcoal hover:border-navy transition-colors"
                >
                  Send Inquiry
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-12 h-12 rounded-full bg-parchment flex items-center justify-center mb-4">
                <span className="text-warm-gray text-lg">⊞</span>
              </div>
              <p className="font-display text-sm text-charcoal font-semibold mb-1">Select a Unit</p>
              <p className="text-xs font-display text-warm-gray max-w-[180px]">
                Click any available (green) unit on the floor grid to view details.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CondominiumPage({ navigate, toast }: CondominiumPageProps) {
  const [activeCondo, setActiveCondo] = useState(condominiums[0])
  const { properties } = useLiveProperties()
  const condoProps = properties.filter((p) => p.type === 'Condominium')
  const { ref: r1, visible: v1 } = useReveal()
  const { ref: r2, visible: v2 } = useReveal()
  const { ref: r3, visible: v3 } = useReveal()

  const statusColor = (s: string) =>
    s === 'Ready for Occupancy' ? 'bg-emerald-600 text-white' :
    s === 'Completed' ? 'bg-charcoal text-white' :
    s === 'Pre-Selling' ? 'bg-gold text-white' :
    'bg-blue-700 text-white'

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative h-[72vh] min-h-[500px] flex items-end overflow-hidden bg-navy">
        <div className="absolute inset-0 overflow-hidden">
          <img
            src="/clark-view.png"
            alt="Clark condominium skyline"
            className="animate-hero-zoom w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/92 via-navy/45 to-navy/20" />
        </div>
        <div className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-12 pb-14 w-full">
          <nav className="flex items-center gap-2 text-[11px] font-display text-white/40 mb-6">
            <button onClick={() => navigate('home')} className="hover:text-white/70 transition-colors">Home</button>
            <span>/</span>
            <span className="text-white/60">Condominiums</span>
          </nav>
          <p className="text-gold text-[11px] font-display font-semibold tracking-[0.3em] uppercase mb-3 animate-fade-up">
            Condominium Developments
          </p>
          <h1 className="font-serif text-white animate-fade-up delay-1" style={{ fontSize: 'clamp(2rem, 4.5vw, 3.8rem)' }}>
            Premium vertical living<br />across Clark and Pampanga.
          </h1>
          <p className="text-white/55 font-display text-sm mt-3 animate-fade-up delay-2 max-w-md">
            Explore condominium developments from the Philippines' top developers. Discover available units, floor plans, and amenities.
          </p>
        </div>
      </section>

      {/* Development Tabs */}
      <div className="bg-white/95 backdrop-blur-md border-b border-line/60 sticky top-16 z-30 shadow-[0_8px_24px_-16px_rgba(15,31,61,0.18)]">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className="flex gap-2 overflow-x-auto py-3">
            {condominiums.map((condo) => (
              <button
                key={condo.id}
                onClick={() => setActiveCondo(condo)}
                className={`flex-shrink-0 px-5 py-2 rounded-full text-[11px] font-display font-semibold tracking-[0.1em] uppercase transition-all ${
                  activeCondo.id === condo.id
                    ? 'bg-navy text-white shadow-sm'
                    : 'bg-parchment/60 text-warm-gray hover:text-charcoal'
                }`}
              >
                {condo.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Development Detail */}
      <section className="bg-white pb-0">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-0">
            <div className="relative overflow-hidden lg:col-span-3" style={{ minHeight: '440px' }}>
              <img
                key={activeCondo.id}
                src={activeCondo.image}
                alt={activeCondo.name}
                className="absolute inset-0 w-full h-full object-cover animate-fade-in"
              />
              <div className="absolute top-4 left-4">
                <span className={`px-3 py-1 rounded-full shadow-sm text-[10px] font-display font-semibold tracking-[0.1em] uppercase ${statusColor(activeCondo.status)}`}>
                  {activeCondo.status}
                </span>
              </div>
            </div>
            <div className="lg:col-span-2 p-8 lg:p-10 xl:p-14 flex flex-col justify-center bg-parchment">
              <p className="text-[10px] font-display tracking-[0.2em] uppercase text-warm-gray mb-1">{activeCondo.developer}</p>
              <h2 className="font-serif text-charcoal text-3xl lg:text-4xl mb-2">{activeCondo.name}</h2>
              <p className="text-warm-gray font-display text-sm flex items-center gap-1.5 mb-5">
                <span className="text-gold text-[10px]">◆</span>
                {activeCondo.location}
              </p>
              <p className="text-charcoal font-display text-sm leading-relaxed mb-5">{activeCondo.description}</p>
              <div className="mb-5 py-5 border-t border-b border-line">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="font-serif text-2xl text-charcoal">
                      {activeCondo.floorRange ?? activeCondo.floors ?? '—'}
                    </p>
                    <p className="text-[9px] font-display tracking-[0.12em] uppercase text-warm-gray mt-0.5">Floors</p>
                  </div>
                  <div>
                    <p className="font-serif text-2xl text-charcoal">
                      {activeCondo.areaRange ?? activeCondo.units ?? '—'}
                    </p>
                    <p className="text-[9px] font-display tracking-[0.12em] uppercase text-warm-gray mt-0.5">
                      {activeCondo.areaRange ? 'Unit Size' : 'Total Units'}
                    </p>
                  </div>
                  <div>
                    <p className="font-serif text-lg text-charcoal leading-tight">
                      {formatPrice(activeCondo.startingPrice, activeCondo.priceMode === 'rent' ? 'For Rent' : 'For Sale')}
                    </p>
                    <p className="text-[9px] font-display tracking-[0.12em] uppercase text-warm-gray mt-0.5">
                      {activeCondo.priceMode === 'rent' ? 'Estimated starting rent' : 'Starting From'}
                    </p>
                  </div>
                </div>
                {(activeCondo.buildingCount != null || activeCondo.unitMix) && (
                  <p className="text-xs font-display text-warm-gray mt-3">
                    {[
                      activeCondo.buildingCount != null ? `${activeCondo.buildingCount} Buildings` : null,
                      activeCondo.unitMix,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </p>
                )}
              </div>
              <div className="mb-5">
                <p className="text-[9px] font-display tracking-[0.2em] uppercase text-warm-gray mb-2">Amenities</p>
                <div className="flex flex-wrap gap-1.5">
                  {activeCondo.amenities.map((a) => (
                    <span key={a} className="px-3 py-1.5 rounded-full bg-white text-[10px] font-display text-warm-gray shadow-sm">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => toast(`Inquiry sent for ${activeCondo.name}!`)}
                  className="flex-1 py-3 rounded-full bg-gold text-white text-xs font-display font-semibold tracking-[0.12em] uppercase shadow-sm hover:bg-navy hover:shadow-md transition-all"
                >
                  Inquire Now
                </button>
                <button
                  onClick={() => { const el = document.getElementById('unit-explorer'); el?.scrollIntoView({ behavior: 'smooth' }) }}
                  className="flex-1 py-3 rounded-full border border-navy text-navy text-xs font-display font-semibold tracking-[0.12em] uppercase hover:bg-navy hover:text-white transition-colors"
                >
                  Explore Units
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Amenity Gallery */}
      <section className="py-6 px-6 lg:px-12 bg-white">
        <div className="max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-4 gap-3">
            {[
              'https://images.unsplash.com/photo-1776361984975-84bbbb539f80?w=500&h=340&fit=crop&auto=format',
              'https://images.unsplash.com/photo-1776363497229-616cc7a541fe?w=500&h=340&fit=crop&auto=format',
              'https://images.unsplash.com/photo-1784704161960-26770b684595?w=500&h=340&fit=crop&auto=format',
              'https://images.unsplash.com/photo-1743638082396-58706d3bdffb?w=500&h=340&fit=crop&auto=format',
            ].map((img, i) => (
              <div key={i} className="overflow-hidden rounded-xl img-zoom-container" style={{ aspectRatio: '4/3' }}>
                <img src={img} alt={`Amenity ${i + 1}`} className="img-zoom w-full h-full object-cover" loading="lazy" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Unit Types */}
      <section ref={r1} className="py-16 lg:py-24 bg-cream">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className={`mb-10 transition-all duration-700 ${v1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">Configuration</p>
            <h2 className="font-serif text-charcoal text-2xl lg:text-3xl">Available Unit Types</h2>
          </div>
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 transition-all duration-700 delay-100 ${v1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {[
              { type: 'Studio', area: '24–35 sqm', price: '₱3.8M', available: 24, beds: '—' },
              { type: '1 Bedroom', area: '42–58 sqm', price: '₱5.5M', available: 38, beds: '1' },
              { type: '2 Bedroom', area: '68–95 sqm', price: '₱8.8M', available: 16, beds: '2' },
              { type: '3 Bedroom', area: '110–165 sqm', price: '₱14M', available: 6, beds: '3' },
            ].map((unit) => (
              <div key={unit.type} className="bg-white rounded-2xl border border-line/70 p-6 card-lift hover:border-gold/50 cursor-pointer group">
                <p className="text-[9px] font-display tracking-[0.15em] uppercase text-warm-gray mb-1">Unit Type</p>
                <h3 className="font-serif text-charcoal text-xl mb-4">{unit.type}</h3>
                <div className="space-y-2 mb-4 p-3 bg-parchment/60 rounded-lg">
                  <div className="flex justify-between text-xs font-display border-b border-line/70 pb-1.5">
                    <span className="text-warm-gray">Area</span>
                    <span className="text-charcoal">{unit.area}</span>
                  </div>
                  <div className="flex justify-between text-xs font-display border-b border-line/70 pb-1.5">
                    <span className="text-warm-gray">From</span>
                    <span className="text-charcoal font-semibold">{unit.price}</span>
                  </div>
                  <div className="flex justify-between text-xs font-display">
                    <span className="text-warm-gray">Available</span>
                    <span className={`font-semibold ${unit.available < 10 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {unit.available} units
                    </span>
                  </div>
                </div>
                <button className="w-full py-2 rounded-full text-[10px] font-display font-semibold tracking-[0.12em] uppercase border border-line text-warm-gray group-hover:border-gold group-hover:text-gold transition-colors">
                  View Floor Plan
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Unit Explorer */}
      <section id="unit-explorer" ref={r2} className="py-16 lg:py-24 bg-white">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className={`flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8 transition-all duration-700 ${v2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div>
              <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">Browse Availability</p>
              <h2 className="font-serif text-charcoal text-2xl lg:text-3xl">Unit Availability</h2>
              <p className="text-warm-gray font-display text-sm mt-2">
                Select a tower and floor to see unit availability. Click a green unit to view details.
              </p>
            </div>
          </div>
          <div className={`transition-all duration-700 delay-150 ${v2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <UnitExplorer condoId={activeCondo.id} toast={toast} />
          </div>
        </div>
      </section>

      {/* Available Listings */}
      <section ref={r3} className="py-16 lg:py-24 bg-cream">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className={`flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 transition-all duration-700 ${v3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div>
              <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">Listings</p>
              <h2 className="font-serif text-charcoal text-2xl lg:text-3xl">Available Units for Sale</h2>
            </div>
            <button
              onClick={() => navigate('properties')}
              className="group text-xs font-display font-semibold tracking-[0.15em] uppercase text-charcoal hover:text-navy transition-colors flex items-center gap-2"
            >
              All Properties
              <span className="w-7 h-7 rounded-full bg-parchment flex items-center justify-center group-hover:bg-gold group-hover:text-white transition-colors">→</span>
            </button>
          </div>
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 transition-all duration-700 delay-150 ${v3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {condoProps.slice(0, 6).map((p) => (
              <PropertyCard key={p.id} property={p} onClick={(id) => navigate('property', id)} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-16 lg:py-20">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 text-center">
          <p className="text-gold text-[11px] font-display font-semibold tracking-[0.3em] uppercase mb-3">Reserve Your Unit</p>
          <h2 className="font-serif text-white text-2xl lg:text-3xl mb-4">
            Secure your place in Clark's<br />most prestigious developments.
          </h2>
          <p className="text-white/50 font-display text-sm max-w-md mx-auto mb-8">
            Speak with our condominium specialists for reservation, payment terms, and full availability.
          </p>
          <button
            onClick={() => toast("Request sent! A specialist will contact you within 24 hours.")}
            className="px-8 py-3.5 rounded-full bg-gold text-white text-xs font-display font-semibold tracking-[0.15em] uppercase shadow-sm hover:bg-white hover:text-navy hover:shadow-md transition-all"
          >
            Talk to a Specialist
          </button>
        </div>
      </section>
    </div>
  )
}
