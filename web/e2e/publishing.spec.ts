import { expect, test, type Page } from '@playwright/test'

async function signUp(page: Page) {
  await page.goto('/signup')
  await page.getByLabel('Username').fill(`e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
  await page.getByLabel('Password').fill('e2e-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { name: 'My recipes' })).toBeVisible()
}

test('publish a chosen version, view it logged out, switch versions, and unpublish', async ({ page, browser }) => {
  await signUp(page)
  await page.getByRole('button', { name: 'New recipe' }).click()
  const history = page.getByRole('complementary')

  // Two versions; the draft then moves on past both.
  await page.getByLabel('Title', { exact: true }).fill('Crème Brûlée')
  await page.getByRole('button', { name: '+ Add step' }).click()
  await page.getByLabel('Step 1', { exact: true }).fill('Bake in a water bath.')
  await history.getByRole('button', { name: 'Save version' }).click()
  await expect(history).toContainText('Saved v1')
  await page.getByLabel('Step 1', { exact: true }).fill('Bake low and slow.')
  await history.getByLabel('Version label (optional)').fill('slow bake')
  await history.getByRole('button', { name: 'Save version' }).click()
  await expect(history).toContainText('Saved v2 · slow bake')
  await page.getByLabel('Title', { exact: true }).fill('Work in progress')
  await expect(page.getByRole('status')).toHaveText('All changes saved')

  // Publish v1.
  await history.getByRole('button', { name: 'View v1' }).click()
  await page.getByRole('button', { name: 'Publish this version' }).click()
  await expect(page.getByRole('button', { name: 'Publish this version' })).toHaveCount(0)
  await expect(history.getByRole('button', { name: 'View v1 (published)' })).toBeVisible()
  const publicLink = page.getByRole('link', { name: /^\/r\/creme-brulee-[a-z0-9]{6}$/ })
  await expect(publicLink).toBeVisible()
  const publicPath = (await publicLink.textContent()) ?? ''
  await expect(page.getByText(`Published v1 at ${publicPath}`)).toBeVisible()

  // It leaves My recipes and shows on My published recipes.
  await page.getByRole('link', { name: '← My recipes' }).click()
  await expect(page.getByText('No recipes in progress')).toBeVisible()
  await page.getByRole('link', { name: 'My published recipes' }).click()
  const published = page.getByRole('region', { name: 'Published recipes' }).getByRole('listitem')
  await expect(published).toHaveCount(1)
  await expect(published).toContainText('Crème Brûlée')
  await expect(published).toContainText('v1 · Published just now')

  // The public page shows v1, not the later draft, and works logged out.
  const anonymous = await browser.newContext()
  const visitor = await anonymous.newPage()
  await visitor.goto(publicPath)
  await expect(visitor.getByRole('heading', { level: 1, name: 'Crème Brûlée' })).toBeVisible()
  await expect(visitor.getByText('Bake in a water bath.')).toBeVisible()
  await expect(visitor.getByText(/^By e2e_/)).toBeVisible()
  await expect(visitor.getByRole('textbox')).toHaveCount(0)
  await expect(visitor).toHaveURL(publicPath)

  // Switch the public page to v2 from the editor; the link stays the same.
  await published.getByRole('link', { name: 'Edit Crème Brûlée' }).click()
  await history.getByRole('button', { name: 'View v2 · slow bake' }).click()
  await page.getByRole('button', { name: 'Publish this version' }).click()
  await expect(page.getByText(`Published v2 · slow bake at ${publicPath}`)).toBeVisible()
  await visitor.reload()
  await expect(visitor.getByText('Bake low and slow.')).toBeVisible()

  // Unpublish from My published recipes: the public page goes away and the recipe is back in progress.
  await page.goto('/published')
  await page.getByRole('button', { name: 'Unpublish Crème Brûlée' }).click()
  await expect(page.getByText('Nothing published yet')).toBeVisible()
  await visitor.reload()
  await expect(visitor.getByRole('heading', { name: 'Recipe not found' })).toBeVisible()
  await page.getByRole('link', { name: '← My recipes' }).click()
  await expect(page.getByRole('region', { name: 'In-progress recipes' })).toContainText('Work in progress')

  // Republishing restores the same link; then unpublish from the editor.
  await page.getByRole('link', { name: 'Work in progress' }).click()
  await history.getByRole('button', { name: 'View v1' }).click()
  await page.getByRole('button', { name: 'Publish this version' }).click()
  await expect(page.getByText(`Published v1 at ${publicPath}`)).toBeVisible()
  await visitor.reload()
  await expect(visitor.getByText('Bake in a water bath.')).toBeVisible()
  await page.getByRole('button', { name: 'Unpublish' }).click()
  await expect(page.getByText(`Published v1 at`)).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Publish this version' })).toBeVisible()
  await visitor.reload()
  await expect(visitor.getByRole('heading', { name: 'Recipe not found' })).toBeVisible()
  await anonymous.close()
})
