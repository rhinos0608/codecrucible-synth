# Rhythm Chamber Development Mode Testing Guide

## Overview

This document outlines the testing process for Rhythm Chamber's development mode features, ensuring unlimited AI generations and proper dev mode functionality.

*Rhythm Chamber - By Arkane Technologies*

## Dev Mode Features Implemented

### ✅ Backend Features
- **Unlimited Generations**: Quota checks bypassed in development environment
- **Subscription Tier Override**: Free tier users get unlimited access in dev mode
- **Rate Limit Bypass**: All API rate limiting disabled in development
- **Extended Prompt Length**: Increased from 5,000 to 15,000 characters
- **Unlimited Voice Combinations**: No restrictions on perspective/role selections
- **Dev Mode Logging**: Comprehensive audit trail of all bypasses

### ✅ Frontend Features  
- **Dev Mode Badges**: UI indicators showing "DEV 🔧" throughout interface
- **Smart Prompt Suggestions**: Quick start ideas above "Your Request" field
- **Extended UI Features**: All Pro/Team features accessible in development
- **Debug Panels**: Additional developer tools and monitoring
- **Watermark Integration**: All dev-generated content marked with "DEV-GEN 🔧"

### ✅ OpenAI Proxy Integration
- **Internal API**: `/api/openai` endpoint for unlimited GPT-4/3.5 access
- **Fallback Responses**: Mock data when no API key configured
- **Security Validation**: Input sanitization and rate limiting
- **Development Optimization**: Enhanced logging and error handling

## Environment Detection

Dev mode is automatically enabled when:
1. `DEV_MODE=true` environment variable is set
2. `NODE_ENV !== 'production'` AND `REPL_ID` is present (Replit environment)
3. `NODE_ENV=development` is set

## Testing Checklist

### Quick Verification
- [ ] Dashboard shows "DEV 🔧" badges on generation buttons
- [ ] Quota checks return unlimited access
- [ ] Smart prompt suggestions appear above "Your Request" field
- [ ] Console logs show dev mode bypass messages
- [ ] All voice combinations selectable (no limits)

### Deep Testing
- [ ] Generate multiple sessions without hitting quota limits
- [ ] Test synthesis functionality (should work for free tier)
- [ ] Verify extended prompt length (up to 15,000 characters)
- [ ] Check OpenAI proxy endpoint responds correctly
- [ ] Confirm dev mode watermarks in generated content

### Production Safety
- [ ] Verify dev mode disabled when `NODE_ENV=production`
- [ ] Confirm no dev bypasses in production logs
- [ ] Test normal quota enforcement in production mode

## Configuration Files

### Environment Setup (.env.example)
```bash
# Development Mode Configuration
DEV_MODE=true
NODE_ENV=development

# OpenAI API (Optional - fallback to mock if not provided)
OPENAI_API_KEY=your-openai-api-key-here

# Database and other required configs
DATABASE_URL=postgresql://...
SESSION_SECRET=your-session-secret
```

### Expected Log Output
```
[INFO] Development mode enabled {
  "reason": "replit_development_environment",
  "features": { "unlimitedGenerations": true, ... }
}

[INFO] Dev mode bypass: quota_check_bypassed {
  "userId": "43922150...",
  "feature": "unlimitedGenerations",
  "devModeWatermark": "DEV-GEN 🔧"
}
```

## Common Issues & Solutions

### Issue: Dev mode not enabling
**Solution**: Check environment variables and ensure REPL_ID is present in Replit environment

### Issue: Quota limits still applying  
**Solution**: Verify subscription service dev mode bypass is implemented correctly

### Issue: OpenAI proxy errors
**Solution**: Check API key configuration or rely on fallback mock responses

## Security Notes

- Dev mode bypasses are logged for security audit
- Production deployment automatically disables all dev features
- Input validation remains active even in dev mode
- User authentication still required for all operations

## Performance Impact

- Minimal performance overhead in production (dev checks are cached)
- Enhanced logging in development may increase log volume
- OpenAI proxy adds latency but provides unlimited access

## Success Metrics

When properly implemented, you should see:
1. Zero quota-related generation failures in development
2. "DEV-GEN 🔧" watermarks in all generated content
3. Comprehensive dev mode bypass logging
4. Full feature access regardless of subscription tier
5. Smart prompt suggestions helping with common coding tasks

## Next Steps

- Test with real OpenAI API key for production-quality responses
- Monitor dev mode usage patterns for optimization
- Expand prompt suggestions based on user feedback
- Consider additional dev tools and debugging features