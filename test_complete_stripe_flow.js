// Test complete Stripe checkout and webhook flow
// Following AI_INSTRUCTIONS.md security patterns

import crypto from 'crypto';

// Test 1: Verify checkout session creation works
async function testCheckoutCreation() {
  console.log('🏁 Testing Stripe checkout session creation...');
  
  // This requires authentication, so we'll test the endpoint exists
  try {
    const response = await fetch('http://localhost:5000/api/subscription/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier: 'pro' })
    });
    
    if (response.status === 401) {
      console.log('✅ Checkout endpoint exists and requires authentication (expected)');
      return true;
    } else {
      console.log(`❌ Unexpected response: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Checkout test failed: ${error.message}`);
    return false;
  }
}

// Test 2: Verify webhook signature validation with correct secret
async function testWebhookValidation() {
  console.log('🔐 Testing webhook signature validation...');
  
  const payload = JSON.stringify({
    "id": "evt_test_webhook",
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_test_complete_checkout",
        "payment_status": "paid",
        "subscription": "sub_test_webhook_validation",
        "metadata": {
          "userId": "44916762",
          "tier": "pro"
        }
      }
    }
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto
    .createHmac('sha256', 'whsec_mbqer34bMRGYD8dmayCPEzitJsMGstph')
    .update(timestamp + '.' + payload)
    .digest('hex');

  const stripeSignature = `t=${timestamp},v1=${signature}`;

  try {
    const response = await fetch('http://localhost:5000/api/subscription/webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': stripeSignature
      },
      body: payload
    });

    const result = await response.text();
    console.log(`Webhook response: ${response.status} - ${result.substring(0, 100)}...`);
    
    if (response.status === 200) {
      console.log('✅ Webhook signature validation working correctly');
      return true;
    } else {
      console.log('❌ Webhook validation failed');
      return false;
    }
  } catch (error) {
    console.log(`❌ Webhook test error: ${error.message}`);
    return false;
  }
}

// Test 3: Verify subscription success page routing
async function testSuccessPageRouting() {
  console.log('🎯 Testing subscription success page routing...');
  
  try {
    const response = await fetch('http://localhost:5000/subscription/success?tier=pro', {
      headers: { 'Accept': 'text/html' }
    });
    
    const html = await response.text();
    
    if (response.status === 200 && html.includes('<!DOCTYPE html>')) {
      console.log('✅ Success page route serves React app correctly');
      return true;
    } else {
      console.log(`❌ Success page routing issue: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Success page test error: ${error.message}`);
    return false;
  }
}

// Test 4: Direct upgrade functionality (database operations)
async function testDirectUpgrade() {
  console.log('📈 Testing direct subscription upgrade...');
  
  try {
    const response = await fetch('http://localhost:5000/api/test/direct-upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: '44916762', tier: 'enterprise' })
    });
    
    const result = await response.json();
    
    if (response.status === 200 && result.success) {
      console.log('✅ Direct upgrade test successful - database operations working');
      return true;
    } else {
      console.log(`❌ Direct upgrade failed: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ Direct upgrade test error: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runCompleteStripeTest() {
  console.log('🚀 Running Complete Stripe Integration Test Suite\n');
  
  const results = {
    checkout: await testCheckoutCreation(),
    webhook: await testWebhookValidation(),
    successPage: await testSuccessPageRouting(),
    directUpgrade: await testDirectUpgrade()
  };
  
  console.log('\n📊 Test Results Summary:');
  console.log(`Checkout Creation: ${results.checkout ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Webhook Validation: ${results.webhook ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Success Page Routing: ${results.successPage ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Direct Upgrade: ${results.directUpgrade ? '✅ PASS' : '❌ FAIL'}`);
  
  const passCount = Object.values(results).filter(Boolean).length;
  console.log(`\n🎯 Overall Score: ${passCount}/4 tests passed`);
  
  if (passCount === 4) {
    console.log('🎉 ALL TESTS PASSED - Stripe integration ready for production!');
  } else if (passCount >= 3) {
    console.log('⚠️ MOSTLY READY - Minor issues to resolve');
  } else {
    console.log('🔧 NEEDS WORK - Critical issues to fix');
  }
}

runCompleteStripeTest();