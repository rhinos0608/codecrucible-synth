# Stripe Webhook Setup Guide for CodeCrucible Payment Links

## Overview
This guide explains how to configure Stripe webhooks to properly activate CodeCrucible Pro and Team features after successful payments through the payment links.

## Current Payment Links
- **Pro Plan ($19/month)**: https://buy.stripe.com/7sY4gy8XW7cBdJb05i4c801
- **Team Plan ($49/month)**: https://buy.stripe.com/cNi7sK7TS40p48B3hu4c802

## Webhook Configuration Required

### 1. Stripe Dashboard Setup
1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Enter your webhook URL: `https://your-domain.com/api/subscription/webhook`
4. Select the following events:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

### 2. Environment Variables
Ensure these environment variables are configured:
```bash
STRIPE_SECRET_KEY=sk_live_...  # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...  # Webhook signing secret from Stripe
```

### 3. Payment Link Configuration
The payment links need to be configured with:
- **Success URL**: `https://your-domain.com/subscription/success?tier={TIER}`
- **Cancel URL**: `https://your-domain.com/subscription/cancel`

## How It Works

### Payment Flow
1. User clicks upgrade button in CodeCrucible
2. System redirects to Stripe payment link
3. User completes payment on Stripe's hosted page
4. Stripe sends webhook to `/api/subscription/webhook`
5. System processes webhook and activates features
6. User is redirected to success page

### Feature Activation
When a successful payment webhook is received:
1. System maps Stripe price ID to subscription tier:
   - `price_1RkNL6A1twisVzen0NGxfG7f` → Pro
   - `price_1RkNLgA1twisVzenGkDoiILm` → Team
2. User account is upgraded in database
3. Features are immediately activated
4. Subscription history is recorded

### Webhook Security
- All webhooks are verified using Stripe's signature validation
- Comprehensive logging for audit trails
- Error handling with proper HTTP status codes

## Testing Webhook Processing

### Direct Upgrade Test
You can test the webhook processing with:
```bash
curl -X POST http://localhost:5000/api/test/direct-upgrade \
  -H "Content-Type: application/json" \
  -d '{"userId": "your-user-id", "tier": "pro"}'
```

### Webhook Event Simulation
The system includes webhook simulation for testing subscription upgrades without real payments.

## Troubleshooting

### Common Issues
1. **Webhook not received**: Check webhook URL and firewall settings
2. **Signature validation fails**: Verify STRIPE_WEBHOOK_SECRET is correct
3. **User not found**: Ensure email address matches between Stripe and CodeCrucible
4. **Features not activated**: Check subscription status in database

### Logging
All webhook events are logged with:
- Event type and ID
- User identification process
- Subscription tier mapping
- Feature activation status

### Manual Subscription Activation
If webhook fails, subscriptions can be manually activated via direct database update or the test endpoint.

## Production Deployment Checklist
- [ ] Webhook endpoint configured in Stripe Dashboard
- [ ] STRIPE_WEBHOOK_SECRET environment variable set
- [ ] Payment link success/cancel URLs updated
- [ ] Webhook endpoint accessible from internet
- [ ] SSL certificate configured for webhook endpoint
- [ ] Monitoring and alerting for failed webhooks

## Support
For webhook configuration issues, contact Arkane Technologies support with:
- Stripe event ID
- User email address
- Timestamp of payment
- Error logs from webhook processing