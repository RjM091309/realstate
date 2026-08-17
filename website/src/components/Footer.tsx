import type { Page } from './Navigation'

interface FooterProps {
  navigate: (page: Page, id?: string) => void
}

export default function Footer({ navigate }: FooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-charcoal text-white">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-12">

        {/* Main */}
        <div className="py-12 lg:py-16 border-b border-white/10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <button onClick={() => navigate('home')} className="flex items-center gap-2 mb-4">
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-5 bg-gold" />
                  <div className="w-1.5 h-3 bg-gold/50 -ml-0.5" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-display font-semibold tracking-[0.18em] text-xs uppercase text-white">Clark Estates</span>
                  <span className="font-display tracking-[0.12em] text-[9px] uppercase text-white/40">Pampanga</span>
                </div>
              </button>
              <p className="text-white/45 text-xs font-display leading-relaxed mb-5 max-w-[210px]">
                Premium real estate across Clark, Pampanga, and Central Luzon since 2009.
              </p>
              <div className="flex gap-2">
                {['FB', 'IG', 'LI', 'YT'].map((s) => (
                  <button key={s} className="w-8 h-8 border border-white/15 flex items-center justify-center text-[10px] font-display text-white/40 hover:border-gold hover:text-gold transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Explore */}
            <div>
              <h4 className="text-[10px] font-display font-semibold tracking-[0.18em] uppercase text-white/35 mb-4">Explore</h4>
              <ul className="flex flex-col gap-2.5">
                {[
                  { label: 'All Properties', page: 'properties' as Page },
                  { label: 'Condominiums', page: 'condominiums' as Page },
                  { label: 'House & Lot', page: 'properties' as Page },
                  { label: 'Commercial', page: 'properties' as Page },
                  { label: 'Land', page: 'properties' as Page },
                ].map(({ label, page }) => (
                  <li key={label}>
                    <button onClick={() => navigate(page)} className="text-xs font-display text-white/55 hover:text-white transition-colors text-left">
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Locations */}
            <div>
              <h4 className="text-[10px] font-display font-semibold tracking-[0.18em] uppercase text-white/35 mb-4">Locations</h4>
              <ul className="flex flex-col gap-2.5">
                {[
                  { label: 'Clark Freeport', id: 'clark' },
                  { label: 'Angeles City', id: 'angeles' },
                  { label: 'Mabalacat', id: 'mabalacat' },
                  { label: 'San Fernando', id: 'san-fernando' },
                  { label: 'Porac', id: 'porac' },
                ].map(({ label, id }) => (
                  <li key={label}>
                    <button onClick={() => navigate('location', id)} className="text-xs font-display text-white/55 hover:text-white transition-colors text-left">
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Developments */}
            <div>
              <h4 className="text-[10px] font-display font-semibold tracking-[0.18em] uppercase text-white/35 mb-4">Developments</h4>
              <ul className="flex flex-col gap-2.5">
                {['Centralis Residences', 'The Icon Tower Clark', 'Park View Suites', 'New Launches'].map((label) => (
                  <li key={label}>
                    <button onClick={() => navigate('condominiums')} className="text-xs font-display text-white/55 hover:text-white transition-colors text-left">
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-[10px] font-display font-semibold tracking-[0.18em] uppercase text-white/35 mb-4">Company</h4>
              <ul className="flex flex-col gap-2.5">
                {[
                  { label: 'About Us', page: 'about' as Page },
                  { label: 'Our Agents', page: 'agent' as Page },
                  { label: 'List a Property', page: 'properties' as Page },
                  { label: 'Careers', page: 'home' as Page },
                  { label: 'Contact', page: 'home' as Page },
                ].map(({ label, page }) => (
                  <li key={label}>
                    <button onClick={() => navigate(page)} className="text-xs font-display text-white/55 hover:text-white transition-colors text-left">
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Contact row */}
        <div className="py-7 border-b border-white/10 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <p className="text-[9px] font-display tracking-[0.18em] uppercase text-white/25 mb-1">Phone</p>
            <p className="text-sm font-display text-white/60">+63 45 123 4567</p>
          </div>
          <div>
            <p className="text-[9px] font-display tracking-[0.18em] uppercase text-white/25 mb-1">Email</p>
            <p className="text-sm font-display text-white/60">hello@clarkestates.ph</p>
          </div>
          <div>
            <p className="text-[9px] font-display tracking-[0.18em] uppercase text-white/25 mb-1">Office</p>
            <p className="text-sm font-display text-white/60">Clark Freeport Zone, Pampanga 2023</p>
          </div>
        </div>

        {/* Bottom */}
        <div className="py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] font-display text-white/25">© {year} Clark Estates. All rights reserved.</p>
          <div className="flex items-center gap-5">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((item) => (
              <button key={item} className="text-[11px] font-display text-white/25 hover:text-white/55 transition-colors">
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
