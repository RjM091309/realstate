import { useState } from 'react'
import type { Page } from '../components/Navigation'
import type { ToastType } from '../components/Toast'

interface SignInPageProps {
  navigate: (page: Page, id?: string) => void
  toast: (msg: string, type?: ToastType) => void
}

export default function SignInPage({ navigate, toast }: SignInPageProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast(mode === 'signin' ? `Welcome back, ${form.email}!` : `Account created for ${form.email}!`)
    navigate('home')
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6 py-28">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <button onClick={() => navigate('home')} className="inline-flex items-center gap-2 mb-6">
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-5 bg-gold" />
              <div className="w-1.5 h-3 bg-gold/50 -ml-0.5" />
            </div>
            <span className="font-display font-semibold tracking-[0.18em] text-xs uppercase text-charcoal">
              Clark Real States
            </span>
          </button>
          <h1 className="font-serif text-charcoal text-2xl lg:text-3xl mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-warm-gray font-display text-sm">
            {mode === 'signin'
              ? 'Sign in to manage your saved properties and inquiries.'
              : 'Save properties, track inquiries, and get notified of new listings.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-line/70 p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {mode === 'signup' && (
              <div>
                <label className="block text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-warm-gray mb-1.5">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full text-sm font-display text-charcoal rounded-lg border border-line px-4 py-3 outline-none focus:border-gold transition-colors"
                  placeholder="Juan Dela Cruz"
                />
              </div>
            )}

            <div>
              <label className="block text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-warm-gray mb-1.5">
                Email
              </label>
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full text-sm font-display text-charcoal rounded-lg border border-line px-4 py-3 outline-none focus:border-gold transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-[10px] font-display font-semibold tracking-[0.15em] uppercase text-warm-gray mb-1.5">
                Password
              </label>
              <input
                required
                type="password"
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full text-sm font-display text-charcoal rounded-lg border border-line px-4 py-3 outline-none focus:border-gold transition-colors"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-full bg-gold text-white text-xs font-display font-semibold tracking-[0.12em] uppercase shadow-sm hover:bg-navy hover:shadow-md transition-all mt-2"
            >
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm font-display text-warm-gray mt-6">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className="text-charcoal font-semibold hover:text-gold transition-colors"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
