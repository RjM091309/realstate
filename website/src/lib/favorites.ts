import { useEffect, useState } from 'react'

const STORAGE_KEY = 'clark-estates-saved-properties'

function readStoredFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

let favorites = typeof window !== 'undefined' ? readStoredFavorites() : []
const listeners = new Set<(ids: string[]) => void>()

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  listeners.forEach((listener) => listener(favorites))
}

export function isFavorite(id: string): boolean {
  return favorites.includes(id)
}

export function toggleFavorite(id: string) {
  favorites = isFavorite(id) ? favorites.filter((f) => f !== id) : [...favorites, id]
  persist()
}

export function useFavorites(): string[] {
  const [ids, setIds] = useState(favorites)

  useEffect(() => {
    listeners.add(setIds)
    return () => { listeners.delete(setIds) }
  }, [])

  return ids
}
