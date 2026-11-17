import { expect, test } from '@playwright/test'

test('create, open and delete a recipe from the dashboard', async ({ page }) => {
  await page.goto('/signup')
  await page.getByLabel('Username').fill(`e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  await page.getByLabel('Password').fill('e2e-password')
  await page.getByRole('button', { name: 'Create account' }).click()

  const list = page.getByRole('region', { name: 'In-progress recipes' })
  await expect(list.getByText('No recipes in progress')).toBeVisible()

  await page.getByRole('button', { name: 'New recipe' }).click()
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/)
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Untitled recipe')

  await page.getByRole('link', { name: '← My recipes' }).click()
  const card = list.getByRole('listitem')
  await expect(card).toHaveCount(1)
  await expect(card).toContainText('Untitled recipe')
  await expect(card).toContainText('Edited just now · No versions yet')

  await card.getByRole('link', { name: 'Untitled recipe' }).click()
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('Untitled recipe')
  await page.goBack()

  page.once('dialog', (dialog) => void dialog.accept())
  await list.getByRole('button', { name: 'Delete Untitled recipe' }).click()
  await expect(list.getByText('No recipes in progress')).toBeVisible()

  await page.reload()
  await expect(list.getByText('No recipes in progress')).toBeVisible()
})
