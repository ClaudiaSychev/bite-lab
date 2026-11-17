import { expect, test, type Page } from '@playwright/test'

async function newRecipe(page: Page) {
  await page.goto('/signup')
  await page.getByLabel('Username').fill(`e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  await page.getByLabel('Password').fill('e2e-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('button', { name: 'New recipe' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Untitled recipe')
}

test('edit a draft and have it autosaved', async ({ page }) => {
  await newRecipe(page)
  const status = page.getByRole('status')
  const ingredients = page.getByRole('region', { name: 'Ingredients' })
  const rows = ingredients.getByRole('listitem')
  const steps = page.getByRole('region', { name: 'Instructions' }).getByRole('listitem')

  await page.getByLabel('Title', { exact: true }).fill('Pancakes')

  // Single amount: typed as a decimal, shown as a fraction once the field is left.
  await ingredients.getByRole('button', { name: '+ Add ingredient' }).click()
  await expect(rows.nth(0).getByLabel(/^Amount/)).toBeFocused()
  await rows.nth(0).getByLabel(/^Amount/).fill('1.5')
  await rows.nth(0).getByLabel(/^Unit/).fill('cup')
  await expect(rows.nth(0).getByLabel(/^Amount/)).toHaveValue('1 1/2')
  await rows.nth(0).getByLabel('Name of ingredient 1').fill('flour')
  await rows.nth(0).getByLabel(/^Note/).fill('sifted')

  // Range with max < min is rejected and blocks saving until fixed.
  await ingredients.getByRole('button', { name: '+ Add ingredient' }).click()
  await rows.nth(1).getByLabel(/^Amount/).fill('3-2')
  await rows.nth(1).getByLabel('Name of ingredient 2').fill('milk')
  await expect(rows.nth(1)).toContainText('Max must be greater than or equal to min')
  await expect(rows.nth(1).getByLabel(/^Amount/)).toHaveAttribute('aria-invalid', 'true')
  await expect(status).toHaveText('Not saved: fix the highlighted fields')
  await rows.nth(1).getByLabel(/^Amount/).fill('1 to 2')
  await rows.nth(1).getByLabel(/^Unit/).fill('cup')
  await expect(rows.nth(1).getByLabel(/^Amount/)).toHaveValue('1–2')
  await expect(rows.nth(1)).not.toContainText('Max must be')

  // No amount, then reorder and remove.
  await ingredients.getByRole('button', { name: '+ Add ingredient' }).click()
  await rows.nth(2).getByLabel('Name of ingredient 3').fill('salt')
  await rows.nth(2).getByLabel(/^Note/).fill('to taste')
  await ingredients.getByRole('button', { name: 'Move salt up' }).click()
  await ingredients.getByRole('button', { name: '+ Add ingredient' }).click()
  await rows.nth(3).getByLabel('Name of ingredient 4').fill('oops')
  await ingredients.getByRole('button', { name: 'Remove oops' }).click()
  await expect(rows).toHaveCount(3)

  // Instructions, reordered.
  const addStep = page.getByRole('button', { name: '+ Add step' })
  await addStep.click()
  await expect(page.getByLabel('Step 1', { exact: true })).toBeFocused()
  await page.getByLabel('Step 1', { exact: true }).fill('Fry until golden.')
  await addStep.click()
  await page.getByLabel('Step 2', { exact: true }).fill('Whisk everything together.')
  await page.getByRole('button', { name: 'Move step 2 up' }).click()

  await page.getByLabel('Notes', { exact: true }).fill('Rest the batter for 10 minutes.')
  await expect(status).toHaveText('All changes saved')

  await page.reload()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Pancakes')
  await expect(rows).toHaveCount(3)
  const ingredientValues = async (i: number) =>
    Promise.all(
      [/^Amount/, /^Unit/, /^Name of/, /^Note/].map((label) => rows.nth(i).getByLabel(label).inputValue()),
    )
  expect(await ingredientValues(0)).toEqual(['1 1/2', 'cup', 'flour', 'sifted'])
  expect(await ingredientValues(1)).toEqual(['', '', 'salt', 'to taste'])
  expect(await ingredientValues(2)).toEqual(['1–2', 'cup', 'milk', ''])
  await expect(steps).toHaveCount(2)
  await expect(page.getByLabel('Step 1', { exact: true })).toHaveValue('Whisk everything together.')
  await expect(page.getByLabel('Step 2', { exact: true })).toHaveValue('Fry until golden.')
  await expect(page.getByLabel('Notes', { exact: true })).toHaveValue('Rest the batter for 10 minutes.')
})

test('edits made just before leaving the page are still saved', async ({ page }) => {
  await newRecipe(page)
  await page.getByLabel('Title', { exact: true }).fill('Quick exit')
  // Leave immediately, before the autosave delay elapses.
  await page.getByRole('link', { name: '← My recipes' }).click()
  await expect(
    page.getByRole('region', { name: 'In-progress recipes' }).getByRole('link', { name: 'Quick exit' }),
  ).toBeVisible()
})
