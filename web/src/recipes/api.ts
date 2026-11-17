import type { DraftPayload, Ingredient, Instruction } from './draft.ts'

export interface RecipeSummary {
  id: string
  title: string
  updatedAt: string
  versionCount: number
}

export interface Recipe extends RecipeSummary {
  ingredients: Ingredient[]
  instructions: Instruction[]
  notes: string
  createdAt: string
  publishedVersionId: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (res.status === 204) return undefined as T
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(body.error ?? 'Something went wrong')
  return body as T
}

export async function listInProgressRecipes(): Promise<RecipeSummary[]> {
  const { recipes } = await request<{ recipes: RecipeSummary[] }>('/api/recipes')
  return recipes
}

export async function getRecipe(id: string): Promise<Recipe> {
  const { recipe } = await request<{ recipe: Recipe }>(`/api/recipes/${encodeURIComponent(id)}`)
  return recipe
}

export async function createRecipe(): Promise<{ id: string }> {
  const { recipe } = await request<{ recipe: { id: string } }>('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  return recipe
}

export function deleteRecipe(id: string): Promise<void> {
  return request<void>(`/api/recipes/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function updateRecipe(id: string, draft: DraftPayload): Promise<{ updatedAt: string }> {
  const { recipe } = await request<{ recipe: { updatedAt: string } }>(
    `/api/recipes/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    },
  )
  return recipe
}

export interface VersionSummary {
  id: string
  version: number
  label: string | null
  createdAt: string
}

export interface RecipeVersion extends VersionSummary {
  title: string
  ingredients: Ingredient[]
  instructions: Instruction[]
  notes: string
}

function versionsPath(recipeId: string, versionId?: string): string {
  const base = `/api/recipes/${encodeURIComponent(recipeId)}/versions`
  return versionId === undefined ? base : `${base}/${encodeURIComponent(versionId)}`
}

export async function listVersions(recipeId: string): Promise<VersionSummary[]> {
  const { versions } = await request<{ versions: VersionSummary[] }>(versionsPath(recipeId))
  return versions
}

// Snapshots the draft as last saved on the server; flush pending autosaves first.
export async function createVersion(recipeId: string, label: string): Promise<VersionSummary> {
  const { version } = await request<{ version: VersionSummary }>(versionsPath(recipeId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  })
  return version
}

export async function getVersion(recipeId: string, versionId: string): Promise<RecipeVersion> {
  const { version } = await request<{ version: RecipeVersion }>(versionsPath(recipeId, versionId))
  return version
}

export async function restoreVersion(recipeId: string, versionId: string): Promise<Recipe> {
  const { recipe } = await request<{ recipe: Recipe }>(`${versionsPath(recipeId, versionId)}/restore`, {
    method: 'POST',
  })
  return recipe
}
