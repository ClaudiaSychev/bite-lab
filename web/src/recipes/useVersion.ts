import { useEffect, useState } from 'react'
import { getVersion, type RecipeVersion } from './api.ts'

export type VersionState =
  | { status: 'loading' }
  | { status: 'loaded'; version: RecipeVersion }
  | { status: 'error'; error: string }

// Callers key their component by versionId, so the state never needs resetting here.
export function useVersion(recipeId: string, versionId: string): VersionState {
  const [state, setState] = useState<VersionState>({ status: 'loading' })
  useEffect(() => {
    let cancelled = false
    getVersion(recipeId, versionId).then(
      (version) => {
        if (!cancelled) setState({ status: 'loaded', version })
      },
      (err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', error: err instanceof Error ? err.message : 'Could not load version' })
        }
      },
    )
    return () => {
      cancelled = true
    }
  }, [recipeId, versionId])
  return state
}
