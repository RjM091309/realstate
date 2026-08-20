import PropertyCard from '../components/PropertyCard'
import { useLiveProperties } from '../lib/useLiveProperties'
import { useFavorites } from '../lib/favorites'
import type { Page } from '../components/Navigation'

interface SavedPageProps {
  navigate: (page: Page, id?: string) => void
}

export default function SavedPage({ navigate }: SavedPageProps) {
  const savedIds = useFavorites()
  const { properties } = useLiveProperties()
  const saved = properties.filter((p) => savedIds.includes(p.id))

  return (
    <div className="min-h-screen bg-cream">
      {/* Page Header */}
      <div className="bg-navy pt-24 pb-10 px-6 lg:px-12">
        <div className="max-w-screen-2xl mx-auto">
          <nav className="flex items-center gap-2 text-[11px] font-display text-white/40 mb-4">
            <button onClick={() => navigate('home')} className="hover:text-white/70 transition-colors">Home</button>
            <span>/</span>
            <span className="text-white/60">Saved</span>
          </nav>
          <h1 className="font-serif text-white text-3xl lg:text-4xl mb-2">Saved Properties</h1>
          <p className="text-white/50 font-display text-sm">Listings you've bookmarked for later</p>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12 py-8">
        {saved.length === 0 ? (
          <div className="text-center py-24 bg-white rounded-2xl border border-line/70">
            <p className="text-4xl mb-4 text-gold">♡</p>
            <h3 className="font-serif text-charcoal text-xl mb-2">No saved properties yet</h3>
            <p className="text-warm-gray font-display text-sm mb-6 max-w-sm mx-auto">
              Tap the heart icon on any listing to save it here for quick access later.
            </p>
            <button
              onClick={() => navigate('properties')}
              className="px-6 py-3 rounded-full bg-navy text-xs font-display font-semibold tracking-[0.15em] uppercase text-white hover:bg-gold transition-colors"
            >
              Browse Properties
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-display text-warm-gray mb-6">
              <span className="text-charcoal font-semibold">{saved.length}</span> {saved.length === 1 ? 'property' : 'properties'} saved
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {saved.map((p) => (
                <PropertyCard key={p.id} property={p} onClick={(id) => navigate('property', id)} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
