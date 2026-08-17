import type { Page } from '../components/Navigation'
import { agents } from '../lib/data'

interface AboutPageProps {
  navigate: (page: Page, id?: string) => void
}

const STATS = [
  { value: '1,240+', label: 'Active Listings' },
  { value: '15', label: 'Years of Service' },
  { value: '8', label: 'Cities Covered' },
  { value: '₱12B+', label: 'Properties Sold' },
]

const VALUES = [
  {
    title: 'Local Expertise',
    text: 'Every agent on our team lives and works in Clark and Pampanga, giving clients ground-level insight no outside brokerage can match.',
  },
  {
    title: 'Transparent Process',
    text: 'From first viewing to closing, we walk buyers and sellers through every step with clear pricing, honest timelines, and no hidden fees.',
  },
  {
    title: 'Curated Listings',
    text: 'We personally vet every development we represent, working only with reputable developers and verified titles.',
  },
]

export default function AboutPage({ navigate }: AboutPageProps) {
  return (
    <div className="min-h-screen bg-cream">
      {/* Page Header */}
      <div className="bg-charcoal pt-24 pb-16 px-6 lg:px-12">
        <div className="max-w-screen-2xl mx-auto">
          <nav className="flex items-center gap-2 text-[11px] font-display text-white/40 mb-4">
            <button onClick={() => navigate('home')} className="hover:text-white/70 transition-colors">Home</button>
            <span>/</span>
            <span className="text-white/60">About</span>
          </nav>
          <p className="text-gold text-[11px] font-display font-semibold tracking-[0.3em] uppercase mb-4">
            Who We Are
          </p>
          <h1 className="font-serif text-white text-3xl lg:text-5xl max-w-2xl leading-tight mb-4">
            Helping Pampanga find home since 2009.
          </h1>
          <p className="text-white/55 font-display text-sm max-w-xl leading-relaxed">
            Clark Estates is a boutique real estate brokerage focused exclusively on Clark, Pampanga,
            and the surrounding growth corridors of Central Luzon.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="bg-white border-b border-line">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-line">
            {STATS.map((stat) => (
              <div key={stat.label} className="px-6 py-10 text-center">
                <p className="font-serif text-3xl lg:text-4xl text-charcoal mb-1">{stat.value}</p>
                <p className="text-[11px] font-display tracking-[0.15em] uppercase text-warm-gray">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Story */}
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          <div>
            <p className="text-gold text-[11px] font-display font-semibold tracking-[0.3em] uppercase mb-4">
              Our Story
            </p>
            <h2 className="font-serif text-charcoal text-2xl lg:text-3xl mb-5 leading-tight">
              Built by locals, for people who love this region.
            </h2>
            <div className="space-y-4 text-warm-gray font-display text-sm leading-relaxed">
              <p>
                What started as a two-person brokerage helping expats and returning OFWs find condos near
                the Clark Freeport Zone has grown into Pampanga's trusted name in premium real estate.
              </p>
              <p>
                Today our team of licensed agents represents developments across Angeles City, Mabalacat,
                San Fernando, and Porac, working with both first-time buyers and institutional investors.
              </p>
              <p>
                We remain independently owned and locally operated, which means every recommendation comes
                from people who actually know these streets, these developers, and these communities.
              </p>
            </div>
          </div>

          <div className="grid gap-6">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-white p-6 lg:p-8 border-l-2 border-gold">
                <h3 className="font-serif text-charcoal text-lg mb-2">{v.title}</h3>
                <p className="text-warm-gray font-display text-sm leading-relaxed">{v.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Team teaser */}
      <div className="bg-white border-t border-line">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 py-16 lg:py-20">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              <p className="text-gold text-[11px] font-display font-semibold tracking-[0.3em] uppercase mb-3">
                Meet the Team
              </p>
              <h2 className="font-serif text-charcoal text-2xl lg:text-3xl">Agents who know the ground.</h2>
            </div>
            <button
              onClick={() => navigate('agent', agents[0]?.id)}
              className="gold-underline text-xs font-display font-semibold tracking-[0.12em] uppercase text-charcoal self-start md:self-auto"
            >
              View All Agents →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
            {agents.slice(0, 4).map((a) => (
              <button
                key={a.id}
                onClick={() => navigate('agent', a.id)}
                className="text-left group"
              >
                <div className="overflow-hidden mb-3" style={{ aspectRatio: '3/4' }}>
                  <img
                    src={a.image}
                    alt={a.name}
                    className="w-full h-full object-cover img-zoom transition-transform group-hover:scale-105 duration-500"
                    loading="lazy"
                  />
                </div>
                <p className="font-display font-semibold text-sm text-charcoal">{a.name}</p>
                <p className="text-xs font-display text-warm-gray">{a.title}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-charcoal">
        <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 py-16 lg:py-20 text-center">
          <h2 className="font-serif text-white text-2xl lg:text-3xl mb-4">Ready to find your place?</h2>
          <p className="text-white/50 font-display text-sm mb-8 max-w-md mx-auto">
            Browse active listings or speak with one of our agents about your requirements.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate('properties')}
              className="px-7 py-3.5 bg-gold text-white text-xs font-display font-semibold tracking-[0.12em] uppercase hover:bg-gold-dark transition-colors"
            >
              Browse Properties
            </button>
            <button
              onClick={() => navigate('agent', agents[0]?.id)}
              className="px-7 py-3.5 border border-white/25 text-white text-xs font-display font-semibold tracking-[0.12em] uppercase hover:bg-white/10 transition-colors"
            >
              Talk to an Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
