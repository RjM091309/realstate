import { useEffect, useState } from 'react'
import type { Agent } from './data'

const STORAGE_KEY = 'clark-estates-agent-overrides'

export type AgentOverride = Partial<Pick<Agent, 'name' | 'title' | 'phone' | 'email' | 'image' | 'specialization' | 'bio'>>

type OverrideMap = Record<string, AgentOverride>

function readStored(): OverrideMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as OverrideMap) : {}
  } catch {
    return {}
  }
}

let overrides: OverrideMap = typeof window !== 'undefined' ? readStored() : {}
const listeners = new Set<(o: OverrideMap) => void>()

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch (err) {
    console.warn('[agentOverrides] failed to save to localStorage (storage full?)', err)
  }
  listeners.forEach((l) => l(overrides))
}

export function saveAgentOverride(id: string, data: AgentOverride) {
  overrides = { ...overrides, [id]: { ...overrides[id], ...data } }
  persist()
}

export function useAgentOverride(id: string): AgentOverride | undefined {
  const [map, setMap] = useState(overrides)

  useEffect(() => {
    listeners.add(setMap)
    return () => { listeners.delete(setMap) }
  }, [])

  return map[id]
}

export function applyAgentOverride(agent: Agent, override?: AgentOverride): Agent {
  return override ? { ...agent, ...override } : agent
}

/** Merges localStorage overrides into a list of agents, re-rendering whenever any override changes. */
export function useAgentsWithOverrides(baseAgents: Agent[]): Agent[] {
  const [map, setMap] = useState(overrides)

  useEffect(() => {
    listeners.add(setMap)
    return () => { listeners.delete(setMap) }
  }, [])

  return baseAgents.map((a) => applyAgentOverride(a, map[a.id]))
}
