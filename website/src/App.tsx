import { useState, useEffect } from 'react'
import Navigation, { type Page } from './components/Navigation'
import Footer from './components/Footer'
import { ToastContainer, useToast } from './components/Toast'
import HomePage from './pages/HomePage'
import PropertiesPage from './pages/PropertiesPage'
import PropertyDetailPage from './pages/PropertyDetailPage'
import CondominiumPage from './pages/CondominiumPage'
import AgentPage from './pages/AgentPage'
import LocationPage, { type LocationKey } from './pages/LocationPage'
import AboutPage from './pages/AboutPage'
import SavedPage from './pages/SavedPage'
import SignInPage from './pages/SignInPage'

type AppState = {
  page: Page
  id?: string
}

const PAGE_TITLES: Partial<Record<Page, string>> = {
  home: 'Clark Real States — Premium Real Estate in Pampanga',
  properties: 'Properties — Clark Real States',
  property: 'Property Detail — Clark Real States',
  condominiums: 'Condominiums — Clark Real States',
  agent: 'Agent Profile — Clark Real States',
  location: 'Location Guide — Clark Real States',
  about: 'About Us — Clark Real States',
  saved: 'Saved Properties — Clark Real States',
  signin: 'Sign In — Clark Real States',
}

export default function App() {
  const [state, setState] = useState<AppState>({ page: 'home' })
  const { toasts, add: addToast, remove: removeToast } = useToast()

  const navigate = (page: Page, id?: string) => {
    setState({ page, id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    document.title = PAGE_TITLES[state.page] ?? 'Clark Real States'
  }, [state.page])

  return (
    <div className="flex flex-col min-h-screen">
      <Navigation currentPage={state.page} navigate={navigate} />

      <main className="flex-1">
        {state.page === 'home' && (
          <HomePage navigate={navigate} />
        )}
        {state.page === 'properties' && (
          <PropertiesPage navigate={navigate} />
        )}
        {state.page === 'property' && (
          <PropertyDetailPage
            propertyId={state.id || '1'}
            navigate={navigate}
          />
        )}
        {state.page === 'condominiums' && (
          <CondominiumPage navigate={navigate} toast={addToast} />
        )}
        {state.page === 'agent' && (
          <AgentPage
            agentId={state.id || '1'}
            navigate={navigate}
            toast={addToast}
          />
        )}
        {state.page === 'location' && (
          <LocationPage
            location={(state.id as LocationKey) || 'clark'}
            navigate={navigate}
            toast={addToast}
          />
        )}
        {state.page === 'about' && (
          <AboutPage navigate={navigate} />
        )}
        {state.page === 'saved' && (
          <SavedPage navigate={navigate} />
        )}
        {state.page === 'signin' && (
          <SignInPage navigate={navigate} toast={addToast} />
        )}
      </main>

      <Footer navigate={navigate} />
      <ToastContainer toasts={toasts} remove={removeToast} />
    </div>
  )
}
