import { useEffect, useState } from 'react'
import { properties as sampleProperties, type Property } from './data'

/**
 * Base URL of the realstate management API (server/index.js).
 * Override with VITE_LISTINGS_API_URL in a local .env if it runs elsewhere.
 */
const API_BASE = String(import.meta.env.VITE_LISTINGS_API_URL ?? 'http://localhost:2550')

type ListingsResponse = { listings: Property[] }

let cache: Property[] | null = null
let inflight: Promise<Property[]> | null = null

async function loadLiveProperties(): Promise<Property[]> {
  if (cache) return cache
  if (!inflight) {
    inflight = fetch(`${API_BASE}/api/public/listings`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<ListingsResponse>
      })
      .then((data) => {
        const live = Array.isArray(data.listings) ? data.listings : []
        cache = live.length > 0 ? live : sampleProperties
        return cache
      })
      .catch((err) => {
        // Management API unreachable/empty — keep the site working with sample data.
        console.warn('[listings] Falling back to sample data:', err)
        cache = sampleProperties
        return cache
      })
  }
  return inflight
}

/**
 * Live property listings synced from the real estate management app, with the
 * bundled sample data as an immediate/fallback source so the site never shows
 * a blank state. Available/Reserved units only — see server/controllers/publicController.js.
 */
export function useLiveProperties(): { properties: Property[]; loading: boolean } {
  const [properties, setProperties] = useState<Property[]>(cache ?? sampleProperties)
  const [loading, setLoading] = useState(cache === null)

  useEffect(() => {
    if (cache) {
      setProperties(cache)
      setLoading(false)
      return
    }
    let cancelled = false
    loadLiveProperties().then((data) => {
      if (!cancelled) {
        setProperties(data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  return { properties, loading }
}
