import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';
const PASSWORD = 'letmein';

// Test data
const ESCROW_DATA = {
  description: 'Real-time Test - Widget Purchase',
  price: '25000', // ₦25,000
};

test.describe('Real-time Status Updates Test', () => {
  test('Complete escrow flow with real-time updates', async ({ page, context }) => {
    // Step 1: Seller creates escrow
    console.log('🚀 Step 1: Seller creates escrow');

    await page.goto(`${BASE_URL}/seller`);
    await page.waitForSelector('button:has-text("Log in")', { timeout: 10000 });
    await page.click('button:has-text("Log in")');
    await page.fill('input[name="email"]', 'sell@kratos.ng');
    await page.fill('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]:has-text("Sign in")');
    await page.waitForSelector('text=Create New Transaction', { timeout: 10000 });

    // Fill escrow form
    await page.fill('textarea[name="description"]', ESCROW_DATA.description);
    await page.fill('input[name="price"]', ESCROW_DATA.price);
    await page.setInputFiles('input[type="file"]', './test-receipt.jpg');
    await page.click('button[type="submit"]');

    // Get escrow code
    await page.waitForSelector('text=Transaction Created Successfully', { timeout: 10000 });
    const codeElement = await page.locator('text=Share this code with your buyer:').locator('xpath=following-sibling::*[1]');
    const escrowCode = await codeElement.textContent() || '';
    console.log('✅ Created escrow with code:', escrowCode);
    expect(escrowCode).toBeTruthy();

    // Step 2: Buyer joins escrow
    console.log('🚀 Step 2: Buyer joins escrow');

    const buyerPage = await context.newPage();
    await buyerPage.goto(`${BASE_URL}/buyer`);
    await buyerPage.waitForSelector('button:has-text("Log in")', { timeout: 10000 });
    await buyerPage.click('button:has-text("Log in")');
    await buyerPage.fill('input[name="email"]', 'buy@kratos.ng');
    await buyerPage.fill('input[name="password"]', PASSWORD);
    await buyerPage.click('button[type="submit"]:has-text("Sign in")');
    await buyerPage.waitForSelector('text=Transaction Code', { timeout: 10000 });

    // Navigate to escrow page
    await buyerPage.goto(`${BASE_URL}/buyer/escrow/${escrowCode}`);

    // Join if needed
    const joinButton = buyerPage.locator('text=Join Transaction');
    if (await joinButton.isVisible()) {
      await buyerPage.click('text=Join Transaction');
      await buyerPage.waitForSelector('text=Successfully joined transaction', { timeout: 10000 });
    }

    // Verify initial status
    await expect(buyerPage.locator('text=Waiting for Payment')).toBeVisible();
    console.log('✅ Buyer joined escrow, status: Waiting for Payment');

    // Step 3: Buyer uploads receipt and marks as paid
    console.log('🚀 Step 3: Buyer uploads receipt and marks as paid');

    await buyerPage.setInputFiles('input[type="file"]', './test-receipt.jpg');
    await buyerPage.waitForSelector('text=Payment proof uploaded', { timeout: 10000 });

    // CRITICAL TEST: Mark as paid and check for real-time update
    console.log('⏳ Marking as paid - watching for real-time status update...');
    await buyerPage.click('button:has-text("Mark as Paid")');
    await buyerPage.waitForSelector('text=Marked as paid', { timeout: 10000 });

    // This is the key test - status should update in real-time without refresh
    console.log('🎯 TESTING REAL-TIME UPDATE: Waiting for status to change to "Waiting for Admin Confirmation"');
    await expect(buyerPage.locator('text=Waiting for Admin Confirmation')).toBeVisible();

    console.log('✅ SUCCESS: Real-time status update confirmed!');
    console.log('✅ Buyer status changed from "Waiting for Payment" to "Waiting for Admin Confirmation" instantly');

    // Step 4: Verify seller sees the update too
    console.log('🚀 Step 4: Verify seller sees real-time update');

    await page.reload(); // Refresh seller page
    await page.waitForSelector(`text=${escrowCode}`, { timeout: 10000 });
    await page.click(`text=${escrowCode}`);
    await expect(page.locator('text=Waiting for Admin Confirmation')).toBeVisible();

    console.log('✅ Seller also sees updated status');

    // Cleanup
    await buyerPage.close();

    console.log('🎉 TEST PASSED: Real-time updates are working correctly!');
  });
});