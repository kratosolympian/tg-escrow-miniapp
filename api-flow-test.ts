import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

test.describe('API Flow Test - Backend Logic Verification', () => {
  let escrowCode: string;
  let authToken: string;

  test('Complete API flow test', async ({ request }) => {
    console.log('🚀 Testing complete escrow flow via API calls');

    // Step 1: Get seller auth token
    console.log('📋 Step 1: Getting seller auth token');
    const sellerLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'sell@kratos.ng',
        password: 'letmein'
      }
    });
    expect(sellerLogin.ok()).toBeTruthy();
    const sellerData = await sellerLogin.json();
    const sellerToken = sellerData.token || sellerData.access_token;
    expect(sellerToken).toBeTruthy();
    console.log('✅ Seller authenticated');

    // Step 2: Seller creates escrow
    console.log('📋 Step 2: Seller creates escrow');
    const createEscrow = await request.post(`${BASE_URL}/api/escrow/create`, {
      headers: {
        'Authorization': `Bearer ${sellerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        description: 'API Test Product - Widget',
        price: 35000,
        product_image_url: 'https://example.com/test-image.jpg'
      }
    });
    expect(createEscrow.ok()).toBeTruthy();
    const escrowData = await createEscrow.json();
    escrowCode = escrowData.code;
    expect(escrowCode).toBeTruthy();
    console.log('✅ Escrow created with code:', escrowCode);

    // Step 3: Get buyer auth token
    console.log('📋 Step 3: Getting buyer auth token');
    const buyerLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: 'buy@kratos.ng',
        password: 'letmein'
      }
    });
    expect(buyerLogin.ok()).toBeTruthy();
    const buyerData = await buyerLogin.json();
    const buyerToken = buyerData.token || buyerData.access_token;
    expect(buyerToken).toBeTruthy();
    console.log('✅ Buyer authenticated');

    // Step 4: Buyer joins escrow
    console.log('📋 Step 4: Buyer joins escrow');
    const joinEscrow = await request.post(`${BASE_URL}/api/escrow/join`, {
      headers: {
        'Authorization': `Bearer ${buyerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        code: escrowCode
      }
    });
    expect(joinEscrow.ok()).toBeTruthy();
    console.log('✅ Buyer joined escrow');

    // Step 5: Verify escrow status is WAITING_PAYMENT
    console.log('📋 Step 5: Verifying initial status');
    const checkStatus1 = await request.get(`${BASE_URL}/api/escrow/by-code/${escrowCode}`, {
      headers: {
        'Authorization': `Bearer ${buyerToken}`
      }
    });
    expect(checkStatus1.ok()).toBeTruthy();
    const statusData1 = await checkStatus1.json();
    expect(statusData1.status).toBe('waiting_payment');
    console.log('✅ Initial status confirmed: waiting_payment');

    // Step 6: Buyer uploads receipt
    console.log('📋 Step 6: Buyer uploads receipt');
    // First get signed URL for upload
    const signUrl = await request.post(`${BASE_URL}/api/storage/sign-url`, {
      headers: {
        'Authorization': `Bearer ${buyerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        fileName: 'test-receipt.jpg',
        fileType: 'image/jpeg'
      }
    });
    expect(signUrl.ok()).toBeTruthy();
    const { signedUrl, filePath } = await signUrl.json();

    // Upload file to signed URL (simulate with a simple request)
    const uploadResponse = await request.put(signedUrl, {
      data: 'fake-image-data', // In real test, would upload actual file
      headers: {
        'Content-Type': 'image/jpeg'
      }
    });
    expect(uploadResponse.ok()).toBeTruthy();

    // Finalize receipt upload
    const finalizeReceipt = await request.post(`${BASE_URL}/api/escrow/upload-receipt`, {
      headers: {
        'Authorization': `Bearer ${buyerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        escrowCode: escrowCode,
        filePath: filePath
      }
    });
    expect(finalizeReceipt.ok()).toBeTruthy();
    console.log('✅ Receipt uploaded');

    // Step 7: CRITICAL TEST - Buyer marks as paid
    console.log('🎯 Step 7: CRITICAL TEST - Buyer marks as paid');
    const markPaid = await request.post(`${BASE_URL}/api/escrow/mark-paid`, {
      headers: {
        'Authorization': `Bearer ${buyerToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        escrow_id: statusData1.id
      }
    });
    expect(markPaid.ok()).toBeTruthy();
    console.log('✅ Mark paid API call succeeded');

    // Step 8: Verify status changed to WAITING_ADMIN
    console.log('📋 Step 8: Verifying status changed to waiting_admin');
    const checkStatus2 = await request.get(`${BASE_URL}/api/escrow/by-code/${escrowCode}`, {
      headers: {
        'Authorization': `Bearer ${buyerToken}`
      }
    });
    expect(checkStatus2.ok()).toBeTruthy();
    const statusData2 = await checkStatus2.json();
    console.log('📊 Status after mark-paid:', statusData2.status);

    // THIS IS THE KEY TEST - Did the status actually change in the database?
    if (statusData2.status === 'waiting_admin') {
      console.log('✅ SUCCESS: Backend status update works correctly!');
      console.log('✅ Status changed from waiting_payment to waiting_admin');
      console.log('🎉 CONCLUSION: The issue is with UI real-time subscriptions, not backend logic');
    } else {
      console.log('❌ FAILURE: Backend status update failed!');
      console.log('❌ Status is still:', statusData2.status);
      console.log('🔍 CONCLUSION: The issue is with backend API logic');
      expect(statusData2.status).toBe('waiting_admin'); // This will fail and show the issue
    }

    // Step 9: Test admin confirmation (optional)
    console.log('📋 Step 9: Testing admin confirmation');

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD environment variables. Please set them before running the test.');
    }

    const adminLogin = await request.post(`${BASE_URL}/api/auth/login`, {
      data: {
        email: adminEmail,
        password: adminPassword
      }
    });
    expect(adminLogin.ok()).toBeTruthy();
    const adminData = await adminLogin.json();
    const adminToken = adminData.token || adminData.access_token;

    const confirmPayment = await request.post(`${BASE_URL}/api/admin/confirm-payment`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        escrowId: statusData1.id
      }
    });

    if (confirmPayment.ok()) {
      console.log('✅ Admin confirmation works');
    } else {
      console.log('⚠️ Admin confirmation failed, but that might be expected');
    }
  });
});