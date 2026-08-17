import { useState, useEffect } from 'react'
import { agents, formatPrice } from '../lib/data'
import { useLiveProperties } from '../lib/useLiveProperties'
import PropertyCard from '../components/PropertyCard'
import type { Page } from '../components/Navigation'

interface PropertyDetailPageProps {
  propertyId: string
  navigate: (page: Page, id?: string) => void
}

export default function PropertyDetailPage({ propertyId, navigate }: PropertyDetailPageProps) {
  const { properties } = useLiveProperties()
  const property = properties.find((p) => p.id === propertyId) || properties[0]
  const agent = agents[0]
  const related = properties.filter((p) => p.id !== property.id && p.city === property.city).slice(0, 3)

  const [activeImage, setActiveImage] = useState(0)
  const [activeTab, setActiveTab] = useState<'description' | 'features' | 'amenities'>('description')
  const [inquiryOpen, setInquiryOpen] = useState(false)
  const [viewingOpen, setViewingOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: `I am interested in ${property.title}. Please contact me with more details.` })

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setActiveImage(0)
    setImgLoaded(false)
  }, [propertyId])

  const statusColors: Record<string, string> = {
    'For Sale': 'bg-charcoal text-white',
    'For Rent': 'bg-charcoal-800 text-white',
    'Pre-Selling': 'bg-gold text-white',
  }

  const formatRef = () => `CE-${property.id.padStart(4, '0')}-${property.city.replace(' ', '').toUpperCase().slice(0, 3)}`

  return (
    <div className="min-h-screen bg-cream">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-line pt-20">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 py-4">
          <nav className="flex items-center gap-2 text-[11px] font-display text-warm-gray">
            <button onClick={() => navigate('home')} className="hover:text-charcoal transition-colors">Home</button>
            <span>/</span>
            <button onClick={() => navigate('properties')} className="hover:text-charcoal transition-colors">Properties</button>
            <span>/</span>
            <span className="text-charcoal truncate max-w-[200px]">{property.title}</span>
          </nav>
        </div>
      </div>

      {/* Gallery + Info */}
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-10">

          {/* Left: Gallery + Details */}
          <div className="lg:col-span-2">

            {/* Main Image */}
            <div className="relative overflow-hidden bg-parchment" style={{ aspectRatio: '16/10' }}>
              {!imgLoaded && <div className="absolute inset-0 skeleton" />}
              <img
                key={activeImage}
                src={property.images[activeImage] || property.image}
                alt={property.title}
                className={`w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImgLoaded(true)}
              />
              {/* Status + Save */}
              <div className="absolute top-4 left-4 flex gap-2">
                <span className={`px-2.5 py-1 text-[10px] font-display font-semibold tracking-[0.1em] uppercase ${statusColors[property.status] || 'bg-charcoal text-white'}`}>
                  {property.status}
                </span>
                {property.isNew && (
                  <span className="px-2.5 py-1 bg-gold text-white text-[10px] font-display font-semibold tracking-[0.1em] uppercase">New</span>
                )}
              </div>
              <button
                onClick={() => setSaved(!saved)}
                className={`absolute top-4 right-4 w-9 h-9 flex items-center justify-center bg-white/90 backdrop-blur-sm hover:bg-white transition-all ${saved ? 'text-red-500' : 'text-charcoal/60'}`}
              >
                {saved ? '♥' : '♡'}
              </button>
              {/* Navigation arrows */}
              {property.images.length > 1 && (
                <>
                  <button
                    onClick={() => { setImgLoaded(false); setActiveImage((i) => (i === 0 ? property.images.length - 1 : i - 1)) }}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur-sm flex items-center justify-center text-charcoal hover:bg-white transition-colors"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => { setImgLoaded(false); setActiveImage((i) => (i === property.images.length - 1 ? 0 : i + 1)) }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 backdrop-blur-sm flex items-center justify-center text-charcoal hover:bg-white transition-colors"
                  >
                    ›
                  </button>
                </>
              )}
              <div className="absolute bottom-3 right-4 text-[10px] font-display text-white/70 bg-black/30 px-2 py-0.5">
                {activeImage + 1} / {property.images.length}
              </div>
            </div>

            {/* Thumbnails */}
            {property.images.length > 1 && (
              <div className="flex gap-2 mt-2">
                {property.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => { setImgLoaded(false); setActiveImage(i) }}
                    className={`flex-1 overflow-hidden transition-all ${activeImage === i ? 'ring-2 ring-gold' : 'opacity-60 hover:opacity-80'}`}
                    style={{ aspectRatio: '3/2' }}
                  >
                    <img src={img} alt={`View ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}

            {/* Property Title + Quick Info */}
            <div className="mt-8 pb-6 border-b border-line">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-display font-semibold tracking-[0.2em] uppercase text-gold mb-1">{property.type}</p>
                  <h1 className="font-serif text-charcoal leading-tight mb-2" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}>
                    {property.title}
                  </h1>
                  <p className="text-warm-gray font-display text-sm flex items-center gap-1.5">
                    <span className="text-gold text-[10px]">◆</span>
                    {property.location}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-serif text-3xl lg:text-4xl text-charcoal">{formatPrice(property.price, property.status)}</p>
                  {property.developer && (
                    <p className="text-xs font-display text-warm-gray mt-1">{property.developer}</p>
                  )}
                  <p className="text-[10px] font-display text-warm-gray mt-1">Ref: {formatRef()}</p>
                </div>
              </div>
            </div>

            {/* Quick Details */}
            <div className="py-6 border-b border-line">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {property.bedrooms && (
                  <div className="text-center py-4 bg-white border border-line">
                    <p className="text-2xl font-serif text-charcoal">{property.bedrooms}</p>
                    <p className="text-[10px] font-display tracking-[0.12em] uppercase text-warm-gray mt-1">Bedrooms</p>
                  </div>
                )}
                {property.bathrooms && (
                  <div className="text-center py-4 bg-white border border-line">
                    <p className="text-2xl font-serif text-charcoal">{property.bathrooms}</p>
                    <p className="text-[10px] font-display tracking-[0.12em] uppercase text-warm-gray mt-1">Bathrooms</p>
                  </div>
                )}
                <div className="text-center py-4 bg-white border border-line">
                  <p className="text-2xl font-serif text-charcoal">{property.area.toLocaleString()}</p>
                  <p className="text-[10px] font-display tracking-[0.12em] uppercase text-warm-gray mt-1">Floor Area sqm</p>
                </div>
                {property.lotArea && (
                  <div className="text-center py-4 bg-white border border-line">
                    <p className="text-2xl font-serif text-charcoal">{property.lotArea.toLocaleString()}</p>
                    <p className="text-[10px] font-display tracking-[0.12em] uppercase text-warm-gray mt-1">Lot Area sqm</p>
                  </div>
                )}
                {property.parking && (
                  <div className="text-center py-4 bg-white border border-line">
                    <p className="text-2xl font-serif text-charcoal">{property.parking}</p>
                    <p className="text-[10px] font-display tracking-[0.12em] uppercase text-warm-gray mt-1">Parking Slots</p>
                  </div>
                )}
                {property.floors && (
                  <div className="text-center py-4 bg-white border border-line col-span-2 sm:col-span-1">
                    <p className="text-sm font-serif text-charcoal leading-tight">{property.floors}</p>
                    <p className="text-[10px] font-display tracking-[0.12em] uppercase text-warm-gray mt-1">Floor Level</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="py-6">
              <div className="flex gap-0 border-b border-line mb-6">
                {(['description', 'features', 'amenities'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-5 py-3 text-[11px] font-display font-semibold tracking-[0.12em] uppercase capitalize transition-colors ${
                      activeTab === tab
                        ? 'text-charcoal border-b-2 border-gold -mb-px'
                        : 'text-warm-gray hover:text-charcoal'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === 'description' && (
                <div className="animate-fade-in">
                  <p className="text-charcoal font-display leading-relaxed text-sm">{property.description}</p>
                </div>
              )}

              {activeTab === 'features' && (
                <div className="animate-fade-in grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {property.features.map((f) => (
                    <div key={f} className="flex items-start gap-2.5 py-2">
                      <span className="text-gold text-[10px] mt-0.5 flex-shrink-0">◆</span>
                      <span className="text-sm font-display text-charcoal">{f}</span>
                    </div>
                  ))}
                  {property.features.length === 0 && (
                    <p className="text-warm-gray font-display text-sm">No feature details available.</p>
                  )}
                </div>
              )}

              {activeTab === 'amenities' && (
                <div className="animate-fade-in">
                  {property.amenities.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {property.amenities.map((a) => (
                        <div key={a} className="flex items-center gap-2.5 px-4 py-3 bg-parchment border border-line">
                          <span className="text-gold text-[10px]">◆</span>
                          <span className="text-xs font-display text-charcoal">{a}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-warm-gray font-display text-sm">No amenity details available.</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: CTA Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 flex flex-col gap-4">

              {/* Price + CTA Card */}
              <div className="bg-white border border-line p-6">
                <p className="text-[10px] font-display tracking-[0.2em] uppercase text-warm-gray mb-1">Asking Price</p>
                <p className="font-serif text-3xl text-charcoal mb-1">{formatPrice(property.price, property.status)}</p>
                {property.status === 'For Rent' && (
                  <p className="text-[11px] font-display text-warm-gray mb-4">Per month, exclusive of utilities</p>
                )}

                <div className="flex flex-col gap-3 mt-4">
                  <button
                    onClick={() => setViewingOpen(true)}
                    className="py-3.5 bg-gold text-white text-xs font-display font-semibold tracking-[0.12em] uppercase hover:bg-gold-dark transition-colors flex items-center justify-center gap-2"
                  >
                    Schedule a Viewing
                  </button>
                  <button
                    onClick={() => setInquiryOpen(true)}
                    className="py-3.5 border border-charcoal text-charcoal text-xs font-display font-semibold tracking-[0.12em] uppercase hover:bg-charcoal hover:text-white transition-colors flex items-center justify-center gap-2"
                  >
                    Send an Inquiry
                  </button>
                </div>

                <div className="mt-4 pt-4 border-t border-line flex items-center justify-center gap-5">
                  <button className="flex items-center gap-1.5 text-[11px] font-display text-warm-gray hover:text-charcoal transition-colors">
                    ↗ Share
                  </button>
                  <button
                    onClick={() => setSaved(!saved)}
                    className={`flex items-center gap-1.5 text-[11px] font-display transition-colors ${saved ? 'text-red-500' : 'text-warm-gray hover:text-charcoal'}`}
                  >
                    {saved ? '♥' : '♡'} {saved ? 'Saved' : 'Save'}
                  </button>
                </div>
              </div>

              {/* Agent Card */}
              <div className="bg-white border border-line p-6">
                <p className="text-[10px] font-display tracking-[0.2em] uppercase text-warm-gray mb-4">Listed By</p>
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-14 h-14 overflow-hidden flex-shrink-0">
                    <img src={agent.image} alt={agent.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-charcoal text-sm">{agent.name}</h3>
                    <p className="text-[11px] font-display text-warm-gray mt-0.5">{agent.title}</p>
                    <div className="flex gap-1 mt-1.5">
                      {agent.specialization.slice(0, 1).map((s) => (
                        <span key={s} className="px-1.5 py-0.5 bg-parchment text-[9px] font-display text-warm-gray">{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <a
                    href={`tel:${agent.phone}`}
                    className="py-2.5 border border-line text-xs font-display text-charcoal hover:border-charcoal transition-colors flex items-center justify-center gap-2"
                  >
                    ☎ {agent.phone}
                  </a>
                  <a
                    href={`mailto:${agent.email}`}
                    className="py-2.5 border border-line text-xs font-display text-charcoal hover:border-charcoal transition-colors flex items-center justify-center gap-2"
                  >
                    ✉ Email Agent
                  </a>
                </div>
              </div>

              {/* Property Details summary */}
              <div className="bg-parchment border border-line p-5">
                <h4 className="text-[10px] font-display tracking-[0.2em] uppercase text-warm-gray mb-3">Property Details</h4>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: 'Reference', value: formatRef() },
                    { label: 'Type', value: property.type },
                    { label: 'Status', value: property.status },
                    { label: 'City', value: property.city },
                    ...(property.developer ? [{ label: 'Developer', value: property.developer }] : []),
                    { label: 'Floor Area', value: `${property.area.toLocaleString()} sqm` },
                    ...(property.lotArea ? [{ label: 'Lot Area', value: `${property.lotArea.toLocaleString()} sqm` }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs font-display border-b border-line pb-2 last:border-0 last:pb-0">
                      <span className="text-warm-gray">{label}</span>
                      <span className="text-charcoal font-medium text-right max-w-[60%]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Properties */}
      {related.length > 0 && (
        <div className="bg-white border-t border-line py-16 lg:py-20">
          <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
            <div className="mb-8">
              <p className="text-[11px] font-display font-semibold tracking-[0.25em] uppercase text-gold mb-2">More in {property.city}</p>
              <h2 className="font-serif text-charcoal text-2xl lg:text-3xl">Similar Properties</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((p) => (
                <PropertyCard key={p.id} property={p} onClick={(id) => navigate('property', id)} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky CTA */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-line p-4 flex gap-3">
        <button
          onClick={() => setInquiryOpen(true)}
          className="flex-1 py-3 border border-charcoal text-xs font-display font-semibold tracking-[0.12em] uppercase text-charcoal"
        >
          Inquire
        </button>
        <button
          onClick={() => setViewingOpen(true)}
          className="flex-1 py-3 bg-gold text-white text-xs font-display font-semibold tracking-[0.12em] uppercase"
        >
          Schedule Viewing
        </button>
      </div>

      {/* Inquiry Modal */}
      {inquiryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm" onClick={() => setInquiryOpen(false)}>
          <div className="bg-white w-full max-w-lg p-8 animate-slide-down" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] font-display tracking-[0.2em] uppercase text-gold mb-1">Inquiry</p>
                <h3 className="font-serif text-charcoal text-xl">{property.title}</h3>
              </div>
              <button onClick={() => setInquiryOpen(false)} className="text-warm-gray hover:text-charcoal text-xl leading-none">✕</button>
            </div>
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); setInquiryOpen(false) }}>
              <div>
                <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-line px-4 py-3 text-sm font-display text-charcoal outline-none focus:border-gold transition-colors"
                  placeholder="Your full name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-line px-4 py-3 text-sm font-display text-charcoal outline-none focus:border-gold transition-colors"
                    placeholder="you@email.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-line px-4 py-3 text-sm font-display text-charcoal outline-none focus:border-gold transition-colors"
                    placeholder="+63 9XX XXX XXXX"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Message</label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border border-line px-4 py-3 text-sm font-display text-charcoal outline-none focus:border-gold transition-colors resize-none"
                />
              </div>
              <button
                type="submit"
                className="py-3.5 bg-gold text-white text-xs font-display font-semibold tracking-[0.15em] uppercase hover:bg-gold-dark transition-colors"
              >
                Send Inquiry
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Viewing Modal */}
      {viewingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm" onClick={() => setViewingOpen(false)}>
          <div className="bg-white w-full max-w-md p-8 animate-slide-down" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] font-display tracking-[0.2em] uppercase text-gold mb-1">Schedule a Viewing</p>
                <h3 className="font-serif text-charcoal text-xl">{property.title}</h3>
              </div>
              <button onClick={() => setViewingOpen(false)} className="text-warm-gray hover:text-charcoal text-xl leading-none">✕</button>
            </div>
            <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); setViewingOpen(false) }}>
              <div>
                <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Your Name *</label>
                <input type="text" required className="w-full border border-line px-4 py-3 text-sm font-display outline-none focus:border-gold" placeholder="Full name" />
              </div>
              <div>
                <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Phone *</label>
                <input type="tel" required className="w-full border border-line px-4 py-3 text-sm font-display outline-none focus:border-gold" placeholder="+63 9XX XXX XXXX" />
              </div>
              <div>
                <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Preferred Date *</label>
                <input type="date" required className="w-full border border-line px-4 py-3 text-sm font-display outline-none focus:border-gold" />
              </div>
              <div>
                <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Preferred Time</label>
                <select className="w-full border border-line px-4 py-3 text-sm font-display outline-none focus:border-gold bg-white">
                  <option>Morning (9AM – 12PM)</option>
                  <option>Afternoon (12PM – 5PM)</option>
                  <option>Evening (5PM – 7PM)</option>
                </select>
              </div>
              <button type="submit" className="py-3.5 bg-gold text-white text-xs font-display font-semibold tracking-[0.15em] uppercase hover:bg-gold-dark transition-colors">
                Confirm Viewing Request
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
