import { useState } from 'react'
import { agents } from '../lib/data'
import { useLiveProperties } from '../lib/useLiveProperties'
import PropertyCard from '../components/PropertyCard'
import type { Page } from '../components/Navigation'
import type { ToastType } from '../components/Toast'

interface AgentPageProps {
  agentId: string
  navigate: (page: Page, id?: string) => void
  toast: (msg: string, type?: ToastType) => void
}

const REVIEWS = [
  {
    name: 'Rodrigo Santos',
    date: 'March 2025',
    rating: 5,
    text: 'Maria helped us find our dream condo in Clark within two weeks. Her market knowledge is exceptional and she made the entire process seamless.',
  },
  {
    name: 'Jennifer Lim',
    date: 'January 2025',
    rating: 5,
    text: 'Professional, patient, and genuinely invested in finding the right property for us. We bought a pre-selling unit and the experience was outstanding.',
  },
  {
    name: 'Anthony Cruz',
    date: 'November 2024',
    rating: 4,
    text: 'Very knowledgeable about the Clark area. Helped us understand investment potential for different properties. Highly recommend for first-time buyers.',
  },
]

export default function AgentPage({ agentId, navigate, toast }: AgentPageProps) {
  const agent = agents.find((a) => a.id === agentId) || agents[0]
  const { properties } = useLiveProperties()
  const agentListings = properties.slice(0, 4)
  const [activeTab, setActiveTab] = useState<'listings' | 'about' | 'reviews'>('listings')
  const [contactOpen, setContactOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })

  const stars = (n: number) => Array.from({ length: 5 }, (_, i) => (
    <span key={i} className={i < n ? 'text-gold' : 'text-line'}>★</span>
  ))

  const handleContact = (e: React.FormEvent) => {
    e.preventDefault()
    setContactOpen(false)
    toast(`Message sent to ${agent.name}!`)
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero / Profile Header */}
      <div className="relative overflow-hidden bg-charcoal">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1598258710957-db8614c2881e?w=1600&h=600&fit=crop&auto=format"
            alt="Clark skyline"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/90 to-transparent" />
        </div>

        <div className="relative z-10 max-w-screen-2xl mx-auto px-6 lg:px-12 pt-28 pb-14">
          <nav className="flex items-center gap-2 text-[11px] font-display text-white/40 mb-8">
            <button onClick={() => navigate('home')} className="hover:text-white/70 transition-colors">Home</button>
            <span>/</span>
            <button onClick={() => navigate('properties')} className="hover:text-white/70 transition-colors">Agents</button>
            <span>/</span>
            <span className="text-white/60">{agent.name}</span>
          </nav>

          <div className="flex flex-col md:flex-row items-start md:items-end gap-8">
            {/* Photo */}
            <div className="relative flex-shrink-0">
              <div className="w-28 h-28 lg:w-36 lg:h-36 overflow-hidden border-2 border-gold">
                <img
                  src={agent.image}
                  alt={agent.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-2 -right-2 w-6 h-6 bg-gold flex items-center justify-center">
                <span className="text-white text-[9px] font-display font-bold">✓</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex flex-wrap items-start gap-2 mb-2">
                {agent.specialization.map((s) => (
                  <span key={s} className="px-2.5 py-1 bg-gold/20 border border-gold/30 text-gold text-[9px] font-display font-semibold tracking-[0.1em] uppercase">
                    {s}
                  </span>
                ))}
              </div>
              <h1 className="font-serif text-white text-3xl lg:text-4xl mb-1">{agent.name}</h1>
              <p className="text-white/60 font-display text-sm mb-4">{agent.title} · Clark Estates</p>
              <div className="flex flex-wrap gap-5">
                <div>
                  <p className="font-serif text-white text-2xl">{agent.listings}</p>
                  <p className="text-[10px] font-display tracking-[0.12em] uppercase text-white/40">Active Listings</p>
                </div>
                <div className="w-px bg-white/10" />
                <div>
                  <p className="font-serif text-white text-2xl">{agent.experience}</p>
                  <p className="text-[10px] font-display tracking-[0.12em] uppercase text-white/40">Years Experience</p>
                </div>
                <div className="w-px bg-white/10" />
                <div>
                  <p className="font-serif text-white text-2xl">4.9</p>
                  <p className="text-[10px] font-display tracking-[0.12em] uppercase text-white/40">Rating</p>
                </div>
                <div className="w-px bg-white/10" />
                <div>
                  <p className="font-serif text-white text-2xl">142</p>
                  <p className="text-[10px] font-display tracking-[0.12em] uppercase text-white/40">Sold</p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="flex flex-col gap-3 flex-shrink-0">
              <button
                onClick={() => setContactOpen(true)}
                className="px-6 py-3 bg-gold text-white text-xs font-display font-semibold tracking-[0.12em] uppercase hover:bg-gold-dark transition-colors"
              >
                Send Message
              </button>
              <a
                href={`tel:${agent.phone}`}
                className="px-6 py-3 border border-white/30 text-white text-xs font-display font-semibold tracking-[0.12em] uppercase hover:border-white/60 transition-colors text-center"
              >
                {agent.phone}
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-line sticky top-16 z-30">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className="flex gap-0">
            {(['listings', 'about', 'reviews'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 text-[11px] font-display font-semibold tracking-[0.12em] uppercase capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-charcoal border-b-2 border-gold -mb-px'
                    : 'text-warm-gray hover:text-charcoal'
                }`}
              >
                {tab === 'listings' ? `Listings (${agentListings.length})` : tab === 'reviews' ? `Reviews (${REVIEWS.length})` : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 py-12">
        {activeTab === 'listings' && (
          <div className="animate-fade-in">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-serif text-charcoal text-2xl">Active Listings</h2>
              <p className="text-xs font-display text-warm-gray">{agentListings.length} properties</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {agentListings.map((p) => (
                <PropertyCard key={p.id} property={p} onClick={(id) => navigate('property', id)} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="animate-fade-in max-w-2xl">
            <div className="mb-8">
              <p className="text-[11px] font-display font-semibold tracking-[0.2em] uppercase text-gold mb-3">About</p>
              <h2 className="font-serif text-charcoal text-2xl mb-4">Biography</h2>
              <p className="text-charcoal font-display text-sm leading-relaxed">{agent.bio}</p>
            </div>

            <div className="border-t border-line pt-8 mb-8">
              <p className="text-[11px] font-display font-semibold tracking-[0.2em] uppercase text-gold mb-4">Specializations</p>
              <div className="flex flex-wrap gap-2">
                {agent.specialization.map((s) => (
                  <span key={s} className="px-4 py-2 bg-parchment border border-line text-xs font-display text-charcoal">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t border-line pt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-5 bg-parchment border border-line">
                <p className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray mb-1">Languages</p>
                <p className="text-sm font-display text-charcoal">Filipino, English</p>
              </div>
              <div className="p-5 bg-parchment border border-line">
                <p className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray mb-1">License No.</p>
                <p className="text-sm font-display text-charcoal">PRC-RE-2016-{agent.id}0042</p>
              </div>
              <div className="p-5 bg-parchment border border-line">
                <p className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray mb-1">Email</p>
                <p className="text-sm font-display text-charcoal">{agent.email}</p>
              </div>
              <div className="p-5 bg-parchment border border-line">
                <p className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray mb-1">Phone</p>
                <p className="text-sm font-display text-charcoal">{agent.phone}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'reviews' && (
          <div className="animate-fade-in max-w-2xl">
            <div className="flex items-center gap-6 mb-10 p-6 bg-white border border-line">
              <div className="text-center">
                <p className="font-serif text-5xl text-charcoal">4.9</p>
                <div className="flex gap-0.5 justify-center my-1">{stars(5)}</div>
                <p className="text-[10px] font-display text-warm-gray">{REVIEWS.length} reviews</p>
              </div>
              <div className="flex-1">
                {[5, 4, 3].map((rating) => {
                  const count = REVIEWS.filter((r) => r.rating === rating).length
                  return (
                    <div key={rating} className="flex items-center gap-3 mb-1.5">
                      <span className="text-[10px] font-display text-warm-gray w-4">{rating}</span>
                      <div className="flex-1 h-1.5 bg-parchment">
                        <div
                          className="h-full bg-gold transition-all"
                          style={{ width: `${(count / REVIEWS.length) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-display text-warm-gray w-4">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {REVIEWS.map((r, i) => (
                <div key={i} className="p-6 bg-white border border-line">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-display font-semibold text-charcoal">{r.name}</p>
                      <p className="text-[11px] font-display text-warm-gray">{r.date}</p>
                    </div>
                    <div className="flex gap-0.5">{stars(r.rating)}</div>
                  </div>
                  <p className="text-sm font-display text-charcoal leading-relaxed">{r.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Contact Modal */}
      {contactOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/60 backdrop-blur-sm"
          onClick={() => setContactOpen(false)}
        >
          <div className="bg-white w-full max-w-lg p-8 animate-slide-down" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[10px] font-display tracking-[0.2em] uppercase text-gold mb-1">Contact Agent</p>
                <h3 className="font-serif text-charcoal text-xl">{agent.name}</h3>
              </div>
              <button onClick={() => setContactOpen(false)} className="text-warm-gray hover:text-charcoal text-xl">✕</button>
            </div>
            <form className="flex flex-col gap-4" onSubmit={handleContact}>
              <div>
                <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Your Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full border border-line px-4 py-3 text-sm font-display outline-none focus:border-gold transition-colors"
                  placeholder="Full name"
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
                    className="w-full border border-line px-4 py-3 text-sm font-display outline-none focus:border-gold transition-colors"
                    placeholder="you@email.com"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Phone</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-line px-4 py-3 text-sm font-display outline-none focus:border-gold transition-colors"
                    placeholder="+63 9XX"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-display tracking-[0.15em] uppercase text-warm-gray block mb-1.5">Message *</label>
                <textarea
                  required
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  className="w-full border border-line px-4 py-3 text-sm font-display outline-none focus:border-gold transition-colors resize-none"
                  placeholder="How can I help you?"
                />
              </div>
              <button type="submit" className="py-3.5 bg-gold text-white text-xs font-display font-semibold tracking-[0.15em] uppercase hover:bg-gold-dark transition-colors">
                Send Message
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
