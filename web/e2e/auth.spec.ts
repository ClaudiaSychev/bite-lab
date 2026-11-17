import { expect, test } from '@playwright/test'

test('protected route redirects to log in when signed out', async ({ page }) => {
  await page.goto('/recipes')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
})

test('sign up, log out, then log back in', async ({ page }) => {
  const username = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const password = 'e2e-password'

  await page.goto('/signup')
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'My recipes' })).toBeVisible()
  await expect(page.getByText(`Signed in as ${username}`)).toBeVisible()

  await page.getByRole('button', { name: 'Log out' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/recipes')
  await expect(page).toHaveURL(/\/login$/)

  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Password').fill('wrong-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password')

  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/recipes$/)
})
