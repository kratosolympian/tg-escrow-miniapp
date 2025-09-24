import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const PASSWORD = 'letmein';

// Use the escrow code that was already created
const ESCROW_CODE = 'MFV7BTTEQAAF'; // From the logs you showed earlier

test.describe('Buyer Payment Flow - Real-time Status Updates', () => {
  test('Buyer joins escrow and completes payment flow with real-time updates', async ({ page }) => {
    // Login as buyer
    await page.goto(`${BASE_URL}/buyer`);

    // Wait for auth form to load
    await page.waitForSelector('button:has-text("Log in")', { timeout: 10000 });

    // Make sure we're on the login tab
    await page.click('button:has-text("Log in")');

    // Fill login form
    await page.fill('input[name="email"]', 'buy@kratos.ng');
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign in")');

    // Wait for login success - should see buyer dashboard
    await page.waitForSelector('text=Enter Transaction Code', { timeout: 10000 });

    // Enter the escrow code
    await page.fill('input[placeholder*="Enter transaction code"]', ESCROW_CODE);
    await page.click('button:has-text("Join Transaction")');

    // Should redirect to escrow page and show join button
    await page.waitForSelector('text=Join Transaction', { timeout: 10000 });
    await page.click('text=Join Transaction');

    // Should see success message
    await page.waitForSelector('text=Successfully joined transaction', { timeout: 10000 });

    // Verify status shows "Waiting for Payment"
    await expect(page.locator('text=Waiting for Payment')).toBeVisible();

    // Upload payment receipt
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('./test-receipt.jpg');

    // Wait for upload to complete
    await page.waitForSelector('text=Payment proof uploaded', { timeout: 10000 });

    // Mark as paid
    await page.click('button:has-text("Mark as Paid")');

    // Should see success message
    await page.waitForSelector('text=Marked as paid', { timeout: 10000 });

    // CRITICAL TEST: Check if status updates to "Waiting for Admin Confirmation" in real-time
    // This is the key test - if real-time updates work, this should pass immediately
    console.log('⏳ Waiting for real-time status update...');
    await expect(page.locator('text=Waiting for Admin Confirmation')).toBeVisible();

    console.log('✅ SUCCESS: Buyer status updated in real-time from "Waiting for Payment" to "Waiting for Admin Confirmation"');
  });
});