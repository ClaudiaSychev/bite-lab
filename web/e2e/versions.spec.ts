import { expect, test, type Page } from '@playwright/test'

async function newRecipe(page: Page) {
  await page.goto('/signup')
  await page.getByLabel('Username').fill(`e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  await page.getByLabel('Password').fill('e2e-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('button', { name: 'New recipe' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Untitled recipe')
}

test('save versions, view one read-only, compare two, and restore one into the draft', async ({ page }) => {
  await newRecipe(page)
  const history = page.getByRole('complementary')
  const saveButton = history.getByRole('button', { name: 'Save version' })

  // v1: labeled.
  await page.getByLabel('Title', { exact: true }).fill('Pancakes')
  await page.getByRole('button', { name: '+ Add ingredient' }).click()
  await page.getByLabel('Name of ingredient 1').fill('flour')
  await page.getByLabel(/^Amount/).fill('1')
  await page.getByLabel(/^Unit/).fill('cup')
  await page.getByRole('button', { name: '+ Add step' }).click()
  await page.getByLabel('Step 1', { exact: true }).fill('Fry for 2 minutes.')
  // Saved straight away, without waiting for autosave: pending edits are flushed first.
  await history.getByLabel('Version label (optional)').fill('first try')
  await saveButton.click()
  await expect(history).toContainText('Saved v1 · first try')
  await expect(history.getByLabel('Version label (optional)')).toHaveValue('')

  // v2: no label.
  await page.getByLabel('Title', { exact: true }).fill('Fluffy pancakes')
  await page.getByLabel(/^Amount/).fill('1 1/2')
  await page.getByLabel('Step 1', { exact: true }).fill('Fry for 3 minutes.')
  await saveButton.click()
  await expect(history).toContainText('Saved v2')
  const items = history.getByRole('listitem')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toContainText('v2')
  await expect(items.nth(1)).toContainText('v1 · first try')

  // Saving is blocked while the draft has invalid fields.
  await page.getByLabel(/^Amount/).fill('3-2')
  await expect(saveButton).toBeDisabled()
  await page.getByLabel(/^Amount/).fill('2')
  await expect(saveButton).toBeEnabled()

  // View v1 read-only.
  await history.getByRole('button', { name: 'View v1 · first try' }).click()
  const view = page.getByRole('article', { name: 'v1 · first try (read-only)' })
  await expect(view.getByRole('heading', { name: 'Pancakes' })).toBeVisible()
  await expect(view).toContainText('1 cup flour')
  await expect(view).toContainText('Fry for 2 minutes.')
  await expect(page.getByLabel('Title', { exact: true })).toHaveCount(0)
  await expect(view.getByRole('textbox')).toHaveCount(0)

  // Compare v1 and v2, picked newest first: older shows on the left with changes highlighted.
  await history.getByLabel('Select v2 to compare').check()
  await history.getByLabel('Select v1 · first try to compare').check()
  await history.getByRole('button', { name: 'Compare v1 and v2' }).click()
  const steps = page.getByRole('region', { name: 'Instructions' })
  await expect(steps.locator('del')).toHaveText(['2'])
  await expect(steps.locator('ins')).toHaveText(['3'])
  const ingredients = page.getByRole('region', { name: 'Ingredients' })
  await expect(ingredients.locator('ins')).toHaveText(['1/2 '])
  await expect(page.getByRole('region', { name: 'Title' }).locator('del')).toHaveText('Pancakes')
  await expect(page.getByRole('region', { name: 'Title' }).locator('ins')).toHaveText('Fluffy pancakes')
  await expect(page).toHaveURL(/compare=/)

  // The browser back button returns to the read-only view.
  await page.goBack()
  await expect(page.getByRole('article', { name: 'v1 · first try (read-only)' })).toBeVisible()

  // Restore v1, with a confirmation step.
  await page.getByRole('button', { name: 'Restore into draft' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.getByRole('button', { name: 'Restore into draft' }).click()
  await page.getByRole('button', { name: 'Replace draft' }).click()
  await expect(page.getByText('Restored v1 · first try into the draft.')).toBeVisible()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Pancakes')
  await expect(page.getByLabel(/^Amount/)).toHaveValue('1')
  await expect(page.getByLabel('Step 1', { exact: true })).toHaveValue('Fry for 2 minutes.')

  // The restore is saved, and both versions are still there and unchanged.
  await page.reload()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Pancakes')
  await expect(page.getByLabel(/^Amount/)).toHaveValue('1')
  await expect(history.getByRole('listitem')).toHaveCount(2)
  await history.getByRole('button', { name: 'View v2' }).click()
  await expect(page.getByRole('article', { name: 'v2 (read-only)' })).toContainText('1 1/2 cup flour')
})
