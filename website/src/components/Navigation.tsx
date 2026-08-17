import { useState, useEffect } from 'react'
import type { LocationKey } from '../pages/LocationPage'
import { useFavorites } from '../lib/favorites'

export type Page = 'home' | 'properties' | 'property' | 'condominiums' | 'agent' | 'location' | 'about' | 'saved' | 'signin'

interface NavigationProps {
  currentPage: Page
  navigate: (page: Page, id?: string) => void
}

const NAV_LINKS = [
  { label: 'Properties', page: 'properties' as Page },
  { label: 'Condominiums', page: 'condominiums' as Page },
  { label: 'Developments', page: 'condominiums' as Page },
]

const LOCATION_LINKS: { label: string; key: LocationKey }[] = [
  { label: 'Clark Freeport', key: 'clark' },
  { label: 'Angeles City', key: 'angeles' },
  { label: 'Mabalacat', key: 'mabalacat' },
  { label: 'San Fernando', key: 'san-fernando' },
  { label: 'Porac', key: 'porac' },
]

export default function Navigation({ currentPage, navigate }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [locOpen, setLocOpen] = useState(false)
  const savedCount = useFavorites().length

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    const close = () => setLocOpen(false)
    if (locOpen) window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [locOpen])

  const isHome = currentPage === 'home'
  const isTransparent = isHome && !scrolled

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled || !isHome
          ? 'bg-white/96 backdrop-blur-md border-b border-line shadow-sm'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">
        <div className={`flex items-center justify-between transition-all duration-300 ${scrolled ? 'h-16' : 'h-20'}`}>

          {/* Logo */}
          <button
            onClick={() => { navigate('home'); setMenuOpen(false) }}
            className="flex items-center gap-2.5 group"
            aria-label="Clark Estates Home"
          >
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-5 bg-gold" />
              <div className="w-1.5 h-3 bg-gold/50 -ml-0.5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className={`font-display font-semibold tracking-[0.18em] text-xs uppercase transition-colors duration-300 ${isTransparent ? 'text-white' : 'text-charcoal'}`}>
                Clark Estates
              </span>
              <span className={`font-display tracking-[0.12em] text-[9px] uppercase transition-colors duration-300 ${isTransparent ? 'text-white/60' : 'text-warm-gray'}`}>
                Pampanga
              </span>
            </div>
          </button>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                onClick={() => navigate(link.page)}
                className={`gold-underline text-[11px] font-display font-medium tracking-[0.12em] uppercase transition-colors duration-200 ${
                  isTransparent ? 'text-white/90 hover:text-white' : 'text-warm-gray hover:text-charcoal'
                }`}
              >
                {link.label}
              </button>
            ))}

            {/* Locations Dropdown */}
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setLocOpen(!locOpen)}
                className={`gold-underline text-[11px] font-display font-medium tracking-[0.12em] uppercase transition-colors duration-200 flex items-center gap-1 ${
                  isTransparent ? 'text-white/90 hover:text-white' : 'text-warm-gray hover:text-charcoal'
                }`}
              >
                Locations
                <span className={`text-[8px] transition-transform duration-200 ${locOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {locOpen && (
                <div className="absolute top-full left-0 mt-2 bg-white border border-line shadow-xl min-w-[200px] py-2 animate-slide-down">
                  {LOCATION_LINKS.map((l) => (
                    <button
                      key={l.key}
                      onClick={() => { navigate('location', l.key); setLocOpen(false) }}
                      className="w-full text-left px-5 py-2.5 text-xs font-display text-warm-gray hover:text-charcoal hover:bg-parchment transition-colors"
                    >
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => navigate('agent', '1')}
              className={`gold-underline text-[11px] font-display font-medium tracking-[0.12em] uppercase transition-colors duration-200 ${
                isTransparent ? 'text-white/90 hover:text-white' : 'text-warm-gray hover:text-charcoal'
              }`}
            >
              Agents
            </button>

            <button
              onClick={() => navigate('about')}
              className={`gold-underline text-[11px] font-display font-medium tracking-[0.12em] uppercase transition-colors duration-200 ${
                isTransparent ? 'text-white/90 hover:text-white' : 'text-warm-gray hover:text-charcoal'
              }`}
            >
              About
            </button>
          </div>

          {/* Right side */}
          <div className="hidden lg:flex items-center gap-5">
            <button
              onClick={() => navigate('saved')}
              className={`text-[11px] font-display tracking-[0.1em] uppercase transition-colors duration-200 flex items-center gap-1.5 ${isTransparent ? 'text-white/90 hover:text-white' : 'text-warm-gray hover:text-charcoal'}`}
            >
              ♡ Saved
              {savedCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 flex items-center justify-center bg-gold text-white text-[9px] font-display font-semibold rounded-full">
                  {savedCount}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate('signin')}
              className={`text-[11px] font-display tracking-[0.1em] uppercase transition-colors duration-200 ${isTransparent ? 'text-white/90 hover:text-white' : 'text-warm-gray hover:text-charcoal'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('properties')}
              className="px-5 py-2.5 bg-gold text-white text-[11px] font-display font-semibold tracking-[0.12em] uppercase hover:bg-gold-dark transition-colors"
            >
              List a Property
            </button>
          </div>

          {/* Mobile Toggle */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`lg:hidden flex flex-col justify-center gap-[5px] p-2 -mr-2 ${isTransparent ? 'text-white' : 'text-charcoal'}`}
            aria-label="Toggle navigation"
          >
            <span className={`block w-6 h-px bg-current transition-all duration-300 origin-center ${menuOpen ? 'translate-y-[9px] rotate-45' : ''}`} />
            <span className={`block w-6 h-px bg-current transition-all duration-300 ${menuOpen ? 'opacity-0' : ''}`} />
            <span className={`block w-6 h-px bg-current transition-all duration-300 origin-center ${menuOpen ? '-translate-y-[9px] -rotate-45' : ''}`} />
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`lg:hidden overflow-hidden transition-all duration-300 bg-white border-t border-line ${menuOpen ? 'max-h-[700px]' : 'max-h-0'}`}>
        <div className="px-6 py-5 flex flex-col">
          {[
            { label: 'Properties', page: 'properties' as Page },
            { label: 'Condominiums', page: 'condominiums' as Page },
            { label: 'Developments', page: 'condominiums' as Page },
            { label: 'Agents', page: 'agent' as Page },
            { label: 'About', page: 'about' as Page },
          ].map((link) => (
            <button
              key={link.label}
              onClick={() => { navigate(link.page); setMenuOpen(false) }}
              className="text-left py-3.5 border-b border-line last:border-0 text-sm font-display font-medium tracking-[0.1em] uppercase text-warm-gray hover:text-charcoal transition-colors"
            >
              {link.label}
            </button>
          ))}
          <button
            onClick={() => { navigate('saved'); setMenuOpen(false) }}
            className="text-left py-3.5 border-b border-line last:border-0 text-sm font-display font-medium tracking-[0.1em] uppercase text-warm-gray hover:text-charcoal transition-colors flex items-center gap-2"
          >
            ♡ Saved
            {savedCount > 0 && (
              <span className="min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-gold text-white text-[10px] font-display font-semibold rounded-full">
                {savedCount}
              </span>
            )}
          </button>
          <div className="pt-1">
            <p className="text-[10px] font-display tracking-[0.2em] uppercase text-warm-gray mb-2 mt-3">Locations</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {LOCATION_LINKS.map((l) => (
                <button
                  key={l.key}
                  onClick={() => { navigate('location', l.key); setMenuOpen(false) }}
                  className="px-3 py-1.5 border border-line text-xs font-display text-warm-gray hover:border-gold hover:text-charcoal transition-colors"
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 pt-4 border-t border-line">
            <button
              onClick={() => { navigate('signin'); setMenuOpen(false) }}
              className="py-3 border border-line text-xs font-display font-medium tracking-[0.12em] uppercase text-charcoal"
            >
              Sign In
            </button>
            <button
              onClick={() => { navigate('properties'); setMenuOpen(false) }}
              className="py-3 bg-gold text-white text-xs font-display font-semibold tracking-[0.12em] uppercase"
            >
              List a Property
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
