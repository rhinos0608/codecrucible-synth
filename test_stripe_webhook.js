// Test real Stripe webhook with proper signature validation
// Following AI_INSTRUCTIONS.md security patterns

import crypto from 'crypto';

// Test webhook payload for checkout completion
const payload = JSON.stringify({
  "id": "evt_1RkNFOPKYQUGqN9meI76lWZD",
  "object": "event",
  "api_version": "2024-06-20",
  "created": Math.floor(Date.now() / 1000),
  "data": {
    "object": {
      "id": "cs_test_checkout_session_123",
      "object": "checkout.session",
      "mode": "subscription",
      "payment_status": "paid",
      "status": "complete",
      "subscription": "sub_test_stripe_subscription_456",
      "metadata": {
        "userId": "44916762",
        "tier": "enterprise",
        "app": "ArkaneTechnologies"
      }
    }
  },
  "livemode": false,
  "pending_webhooks": 1,
  "request": {
    "id": null,
    "idempotency_key": null
  },
  "type": "checkout.session.completed"
});

// Create proper Stripe signature
const timestamp = Math.floor(Date.now() / 1000);
const webhookSecret = "whsec_mbqer34bMRGYD8dmayCPEzitJsMGstph";

// Stripe signature format: t=timestamp,v1=signature
const payloadWithTimestamp = timestamp + '.' + payload;
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(payloadWithTimestamp)
  .digest('hex');

const stripeSignature = `t=${timestamp},v1=${signature}`;

console.log('Testing Stripe webhook with proper signature...');
console.log('Payload length:', payload.length);
console.log('Signature:', stripeSignature);

// Test the webhook endpoint
async function testWebhook() {
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
    console.log('Response status:', response.status);
    console.log('Response:', result);
    
    if (response.status === 200) {
      console.log('✅ Webhook test successful!');
    } else {
      console.log('❌ Webhook test failed:', response.status);
    }
  } catch (error) {
    console.error('❌ Webhook test error:', error.message);
  }
}

testWebhook();