import type { ReactNode } from 'react'
import type { RecipeVersion } from './api.ts'
import { formatIngredient } from './format.ts'

interface RecipeContentProps {
  recipe: Pick<RecipeVersion, 'title' | 'ingredients' | 'instructions' | 'notes'>
  // Accessible name for the article, e.g. "v2 (read-only)".
  label: string
  // The public page uses the title as its h1; inside the editor it sits under the page heading.
  titleLevel?: 1 | 2
  // Shown under the title, e.g. author and publish date.
  byline?: ReactNode
}

// Read-only rendering of a recipe snapshot.
function RecipeContent({ recipe, label, titleLevel = 2, byline }: RecipeContentProps) {
  const Title = titleLevel === 1 ? 'h1' : 'h2'
  const Section = titleLevel === 1 ? 'h2' : 'h3'
  return (
    <article aria-label={label} className="flex flex-col gap-6">
      <div>
        <Title className={titleLevel === 1 ? 'text-3xl font-bold' : 'text-2xl font-bold'}>{recipe.title}</Title>
        {byline}
      </div>
      <section>
        <Section className="text-lg font-semibold">Ingredients</Section>
        {recipe.ingredients.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No ingredients.</p>
        ) : (
          <ul className="mt-2 list-disc pl-6 text-sm">
            {recipe.ingredients.map((ingredient) => (
              <li key={ingredient.id}>{formatIngredient(ingredient)}</li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <Section className="text-lg font-semibold">Instructions</Section>
        {recipe.instructions.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No steps.</p>
        ) : (
          <ol className="mt-2 list-decimal pl-6 text-sm">
            {recipe.instructions.map((step) => (
              <li key={step.id} className="whitespace-pre-wrap">
                {step.text}
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <Section className="text-lg font-semibold">Notes</Section>
        {recipe.notes.trim() === '' ? (
          <p className="mt-2 text-sm text-gray-500">No notes.</p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap text-sm">{recipe.notes}</p>
        )}
      </section>
    </article>
  )
}

export default RecipeContent
