const test = async () => {
  try {
    // Test seller auth
    const authResponse = await fetch(`${process.env.API_BASE_URL || 'http://localhost:3001'}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: process.env.SELLER_EMAIL || 'sell@kratos.ng', 
        password: process.env.SELLER_PASSWORD || 'letmein' 
      })
    });
    if (!authResponse.ok) {
      const error = await authResponse.text();
      return;
    }

    const authData = await authResponse.json();
    const token = authData.__one_time_token;

    // Test escrow creation (skip if seller has active escrow)
    let escrowData = null;
    const createResponse = await fetch('http://localhost:3001/api/escrow/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        description: 'API Test Product',
        price: 25000
      })
    });

    if (createResponse.ok) {
      escrowData = await createResponse.json();
    } 

    // Test buyer auth
    const buyerAuthResponse = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'buy@kratos.ng', password: 'letmein' })
    });

    if (!buyerAuthResponse.ok) {
      return;
    }

    const buyerAuthData = await buyerAuthResponse.json();
    const buyerToken = buyerAuthData.__one_time_token;

  } catch (error) {
  }
};

test();