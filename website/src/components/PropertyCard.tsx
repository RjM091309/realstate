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
        className="group cursor-pointer overflow-hidden bg-white rounded-2xl border border-line/70 card-lift"
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
            <span className={`px-3 py-1 rounded-full shadow-sm text-[10px] font-display font-semibold tracking-[0.1em] uppercase ${statusColors[property.status] || 'bg-charcoal text-white'}`}>
              {property.status}
            </span>
            {property.isNew && (
              <span className="px-3 py-1 rounded-full shadow-sm bg-gold text-white text-[10px] font-display font-semibold tracking-[0.1em] uppercase">
                New
              </span>
            )}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id) }}
            className={`absolute top-4 right-4 w-9 h-9 flex items-center justify-center text-3xl transition-all ${saved ? 'text-red-500' : 'text-white'}`}
            style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
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
          <div className="w-10 h-10 rounded-full bg-navy text-white flex items-center justify-center flex-shrink-0 group-hover:bg-gold transition-colors duration-300">
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </div>
      </article>
    )
  }

  if (variant === 'compact') {
    return (
      <article
        className="group cursor-pointer flex gap-4 p-3 bg-white rounded-xl border border-line/70 hover:border-gold/50 card-lift"
        onClick={() => onClick(property.id)}
      >
        <div className="relative overflow-hidden rounded-lg img-zoom-container flex-shrink-0 w-24 h-20">
          {!imgLoaded && <div className="absolute inset-0 skeleton" />}
          <img
            src={property.image}
            alt={property.title}
            className={`img-zoom w-full h-full object-cover transition-opacity duration-500 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
          <span className={`absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-display font-semibold tracking-[0.08em] uppercase ${statusColors[property.status] || 'bg-charcoal text-white'}`}>
            {property.status}
          </span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-[10px] font-display tracking-[0.1em] uppercase text-warm-gray mb-0.5">{property.type}</p>
          <h3 className="text-sm font-display font-semibold text-charcoal truncate">{property.title}</h3>
          <p className="text-xs text-warm-gray mt-0.5 truncate flex items-center gap-1">
            <span className="text-gold text-[9px]">◆</span>
            {property.location}
          </p>
          <p className="text-base font-serif text-charcoal mt-1">{formatPrice(property.price, property.status)}</p>
        </div>
        <div className="flex items-center flex-shrink-0">
          <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-sm group-hover:bg-gold transition-colors duration-300">
            <span className="transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </div>
      </article>
    )
  }

  return (
    <article
      className="group cursor-pointer overflow-hidden bg-white rounded-2xl border border-line/70 card-lift"
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute top-3 left-3 flex gap-1.5">
          <span className={`px-2.5 py-1 rounded-full shadow-sm text-[9px] font-display font-semibold tracking-[0.1em] uppercase ${statusColors[property.status] || 'bg-charcoal text-white'}`}>
            {property.status}
          </span>
          {property.isNew && (
            <span className="px-2.5 py-1 rounded-full shadow-sm bg-gold text-white text-[9px] font-display font-semibold tracking-[0.1em] uppercase">
              New
            </span>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(property.id) }}
          className={`absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-2xl transition-all ${saved ? 'text-red-500' : 'text-white'}`}
          style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
          aria-label={saved ? 'Remove from saved' : 'Save property'}
        >
          {saved ? '♥' : '♡'}
        </button>
      </div>

      <div className="p-4 relative">
        <div className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-gold/40 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
        <p className="text-[10px] font-display tracking-[0.12em] uppercase text-gold-dark mb-1.5">{property.type}</p>
        <h3 className="text-base font-display font-semibold text-charcoal leading-snug mb-1 group-hover:text-navy transition-colors">
          {property.title}
        </h3>
        <p className="text-xs text-warm-gray flex items-center gap-1 mb-3">
          <span className="text-gold text-[9px]">◆</span>
          {property.location}
        </p>

        <div className="flex items-center gap-3 py-2.5 px-3 bg-parchment/70 rounded-lg mb-3">
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
          <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center flex-shrink-0 group-hover:bg-gold transition-colors duration-300">
            <span className="text-sm transition-transform group-hover:translate-x-0.5">→</span>
          </div>
        </div>
      </div>
    </article>
  )
}
