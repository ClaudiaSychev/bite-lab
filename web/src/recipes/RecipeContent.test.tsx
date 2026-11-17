import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import RecipeContent from './RecipeContent.tsx'

const recipe = {
  title: 'Pancakes',
  ingredients: [{ id: 'i1', name: 'flour', quantity: { type: 'single', value: 1.5 } as const, unit: 'cup', note: '' }],
  instructions: [{ id: 's1', text: 'Whisk.' }, { id: 's2', text: 'Fry.' }],
  notes: '',
}

describe('RecipeContent', () => {
  it('renders the recipe read-only with no form fields', () => {
    const html = renderToString(<RecipeContent recipe={recipe} label="v1 (read-only)" />)
    expect(html).toContain('aria-label="v1 (read-only)"')
    expect(html).toContain('<h2 class="text-2xl font-bold">Pancakes</h2>')
    expect(html).toContain('1 1/2 cup flour')
    expect(html).toMatch(/<ol[^>]*>.*Whisk\..*Fry\..*<\/ol>/)
    expect(html).toContain('No notes.')
    expect(html).not.toMatch(/<(input|textarea)/)
  })

  it('uses the title as the page heading on the public page, with a byline', () => {
    const html = renderToString(
      <RecipeContent recipe={recipe} label="Pancakes" titleLevel={1} byline={<p>By chef</p>} />,
    )
    expect(html).toContain('<h1 class="text-3xl font-bold">Pancakes</h1><p>By chef</p>')
    expect(html).toContain('<h2 class="text-lg font-semibold">Ingredients</h2>')
  })
})
