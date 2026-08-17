import { useState } from 'react'
import type { Property } from '../lib/data'
import { formatPrice } from '../lib/data'
import { isFavorite, toggleFavorite, useFavorites } from '../lib/favorites'

interface PropertyCardProps {
  property: Property
  onClick: (id: string) => void
  variant?: 'default' | 'compact' | 'large'
}

export default function PropertyCard({ property, onClick, variant = 'default' }: PropertyCardProps) {
  useFavorites()
  const saved = isFavorite(property.id)
  const [imgLoaded, setImgLoaded] = useState(false)

  const statusColors: Record<string, string> = {
    'For Sale': 'bg-charcoal text-white',
    'For Rent': 'bg-charcoal-800 text-white',
    'Pre-Selling': 'bg-gold text-white',
  }

  if (variant === 'large') {
    return (
      <article
        className="group cursor-pointer overflow-hidden bg-white card-lift"
        onClick={() => onClick(property.id)}
      >
        <div className="relative overflow-hidden img-zoom-container" style={{ aspectRatio: '16/10' }}>
          {!imgLoaded && <div className="absolute inset-0 skeleton" />}
          <img
            src={property.image}
            alt={property.title}
            className={`img-zoom w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          <div className="absolute top-4 left-4 flex gap-2">
            <span className={`px-2.5 py-1 text-[10px] font-display font-semibold tracking-[0.1em] uppercase ${statusColors[property.status] || 'bg-charcoal text-white'}`}>
              {property.status}
            </span>
            {property.isNew && (
              <span className="px-2.5 py-1 bg-gold text-white text-[10px] font-display font-semibold tracking-[0.1em] uppercase">
                New
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id) }}
            className={`absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/90 backdrop-blur-sm hover:bg-white transition-all ${saved ? 'text-red-500' : 'text-charcoal/60'}`}
            aria-label={saved ? 'Remove from saved' : 'Save property'}
          >
            {saved ? '♥' : '♡'}
          </button>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="text-white/80 text-[10px] font-display tracking-[0.1em] uppercase mb-1">{property.type}</p>
            <h3 className="text-white text-xl font-serif leading-tight mb-1">{property.title}</h3>
            <p className="text-white/75 text-xs font-display flex items-center gap-1">
              <span className="text-gold text-[10px]">◆</span>
              {property.location}
            </p>
          </div>
        </div>
        <div className="p-5 flex items-end justify-between">
          <div>
            <p className="text-2xl font-serif text-charcoal">{formatPrice(property.price, property.status)}</p>
            <div className="flex items-center gap-4 mt-2">
              {property.bedrooms && (
                <span className="text-xs font-display text-warm-gray flex items-center gap-1">
                  <span className="text-[11px]">⊞</span> {property.bedrooms} BR
                </span>
              )}
              {property.bathrooms && (
                <span className="text-xs font-display text-warm-gray flex items-center gap-1">
                  <span className="text-[11px]">◎</span> {property.bathrooms} BA
                </span>
              )}
              <span className="text-xs font-display text-warm-gray">
                {property.area.toLocaleString()} sqm
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-gold text-xs font-display font-medium tracking-wide group-hover:gap-2 transition-all">
            View <span className="transition-transform group-hover:translate-x-1">→</span>
          </div>
        </div>
      </article>
    )
  }

  if (variant === 'compact') {
    return (
      <article
        className="group cursor-pointer flex gap-4 p-4 bg-white hover:bg-parchment transition-colors border-b border-line last:border-0"
        onClick={() => onClick(property.id)}
      >
        <div className="relative overflow-hidden img-zoom-container flex-shrink-0 w-24 h-20">
          {!imgLoaded && <div className="absolute inset-0 skeleton" />}
          <img
            src={property.image}
            alt={property.title}
            className={`img-zoom w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-display font-semibold text-charcoal truncate">{property.title}</h3>
          <p className="text-xs text-warm-gray mt-0.5 truncate">{property.location}</p>
          <p className="text-sm font-serif text-charcoal mt-1">{formatPrice(property.price, property.status)}</p>
        </div>
      </article>
    )
  }

  return (
    <article
      className="group cursor-pointer overflow-hidden bg-white card-lift"
      onClick={() => onClick(property.id)}
    >
      <div className="relative overflow-hidden img-zoom-container" style={{ aspectRatio: '4/3' }}>
        {!imgLoaded && <div className="absolute inset-0 skeleton" />}
        <img
          src={property.image}
          alt={property.title}
          className={`img-zoom w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImgLoaded(true)}
          loading="lazy"
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={`px-2 py-1 text-[9px] font-display font-semibold tracking-[0.1em] uppercase ${statusColors[property.status] || 'bg-charcoal text-white'}`}>
            {property.status}
          </span>
          {property.isNew && (
            <span className="px-2 py-1 bg-gold text-white text-[9px] font-display font-semibold tracking-[0.1em] uppercase">
              New
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id) }}
          className={`absolute top-3 right-3 w-7 h-7 flex items-center justify-center bg-white/90 backdrop-blur-sm hover:bg-white transition-all text-sm ${saved ? 'text-red-500' : 'text-charcoal/60'}`}
          aria-label={saved ? 'Remove from saved' : 'Save property'}
        >
          {saved ? '♥' : '♡'}
        </button>
      </div>

      <div className="p-4">
        <p className="text-[10px] font-display tracking-[0.12em] uppercase text-warm-gray mb-1.5">{property.type}</p>
        <h3 className="text-base font-display font-semibold text-charcoal leading-snug mb-1 group-hover:text-charcoal transition-colors">
          {property.title}
        </h3>
        <p className="text-xs text-warm-gray flex items-center gap-1 mb-3">
          <span className="text-gold text-[9px]">◆</span>
          {property.location}
        </p>

        <div className="flex items-center gap-3 py-3 border-t border-b border-line mb-3">
          {property.bedrooms && (
            <span className="text-[11px] font-display text-warm-gray flex items-center gap-1">
              <span>⊞</span> {property.bedrooms} Bed
            </span>
          )}
          {property.bathrooms && (
            <span className="text-[11px] font-display text-warm-gray flex items-center gap-1">
              <span>◎</span> {property.bathrooms} Bath
            </span>
          )}
          <span className="text-[11px] font-display text-warm-gray">
            {property.area.toLocaleString()} sqm
          </span>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-xl font-serif text-charcoal">{formatPrice(property.price, property.status)}</p>
            {property.developer && (
              <p className="text-[10px] font-display text-warm-gray mt-0.5">{property.developer}</p>
            )}
          </div>
          <span className="text-[11px] font-display text-gold flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
            View <span className="transition-transform group-hover:translate-x-1">→</span>
          </span>
        </div>
      </div>
    </article>
  )
}
