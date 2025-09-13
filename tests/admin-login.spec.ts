import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL || ''
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || ''

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  throw new Error('TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD must be set in the environment to run admin login tests')
}

test.describe('admin login', () => {
  test('admin login flow', async ({ page }) => {
    await page.goto('http://localhost:3000/admin/login')

    await page.fill('input#email', ADMIN_EMAIL)
    await page.fill('input#password', ADMIN_PASSWORD)
    await Promise.all([
      page.waitForNavigation({ url: '**/admin/dashboard', waitUntil: 'networkidle' }),
      page.click('button[type="submit"]')
    ])

    // Check that dashboard header exists
    await expect(page.locator('text=Admin Dashboard')).toBeVisible({ timeout: 5000 })
  })
})
