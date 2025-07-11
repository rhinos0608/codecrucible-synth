# Development Mode Testing Documentation

## Dev Mode Features Implemented

### Backend Dev Mode Detection
- **Environment Detection**: Automatically detects Replit development environment (NODE_ENV !== 'production' || REPL_ID present)
- **Manual Override**: DEV_MODE=true environment variable for explicit control
- **Security Audit**: All dev mode usage is logged with watermarks and reasoning

### Features Enabled in Dev Mode

#### 1. Unlimited AI Generations
- **Quota Bypass**: Free tier users get unlimited generations (no 3/day limit)
- **Plan Override**: Quota checking returns unlimited (-1) quota limit
- **Logging**: All bypasses logged with "DEV-GEN 🔧" watermark

#### 2. Unlimited Voice Combinations  
- **Voice Limit Bypass**: Free tier can use unlimited voice combinations (not just 2)
- **Enhanced Logging**: Tracks when voice limits are bypassed
- **Security Compliance**: Maintains logging for production safety

#### 3. Rate Limit Bypass
- **Endpoint Protection**: All rate limiting bypassed in development
- **Security Monitoring**: Bypass events logged for security audit
- **Production Safety**: Only active in development environments

#### 4. Extended Prompt Length
- **Normal Limit**: 5,000 characters in production
- **Dev Limit**: 15,000 characters in development mode
- **Graduated Logging**: Logs when normal limits exceeded but dev limits not reached

#### 5. Unlimited Synthesis Access
- **Feature Access**: Free tier gets Pro-level synthesis access
- **Security Bypass**: validateFeatureAccess middleware bypassed for synthesis
- **Audit Trail**: All synthesis access bypasses logged

### Frontend Dev Mode Features

#### 1. Dev Mode Badges
- **Visual Indicators**: "DEV-GEN 🔧" badges on generation buttons
- **Conditional Rendering**: Only shown when `showDevBadges` feature enabled
- **User Awareness**: Clear indication when in development mode

#### 2. Enhanced Debug Panels
- **Extended Logging**: Console logging for development debugging
- **Debug Information**: Access to dev mode configuration and status
- **Development Tools**: Enhanced debugging capabilities

#### 3. Unlimited UI Features
- **Feature Toggles**: UI restrictions lifted in development
- **Enhanced Access**: All premium UI features available
- **Testing Capabilities**: Full feature testing without restrictions

### Security & Production Safety

#### 1. Environment Isolation
- **Production Check**: Dev mode disabled in production builds
- **Environment Variables**: Clear separation of dev/prod environments
- **Security Warnings**: Logs warnings if dev mode detected in production

#### 2. Audit Logging
- **Comprehensive Tracking**: All dev mode usage logged with context
- **Security Events**: Dev mode bypasses tracked as security events
- **Watermark System**: "DEV-GEN 🔧" watermarks on all dev-generated content

#### 3. User Path Protection
- **Isolated Sessions**: Dev mode sessions tracked separately
- **Data Integrity**: Dev mode metadata prevents production data contamination
- **User Safety**: Dev mode features invisible to production users

## Testing Verification

### Backend Tests
1. **Quota Bypass**: Generate > 3 solutions as free user
2. **Voice Combinations**: Use > 2 voice combinations as free user  
3. **Rate Limiting**: Make rapid API requests without throttling
4. **Extended Prompts**: Submit prompts > 5,000 characters
5. **Synthesis Access**: Access synthesis panel as free user

### Frontend Tests
1. **Dev Badges**: Verify "DEV-GEN 🔧" badges appear on buttons
2. **Debug Panels**: Check enhanced debugging information
3. **Console Logging**: Verify dev mode console output
4. **Feature Access**: Test unlimited UI features

### Security Tests
1. **Production Safety**: Verify dev mode disabled in production builds
2. **Audit Logs**: Check comprehensive logging of dev mode usage
3. **Environment Detection**: Test NODE_ENV and REPL_ID detection
4. **Manual Override**: Test DEV_MODE=true environment variable

## Usage Instructions

### For Developers
1. **Automatic**: Dev mode automatically enabled in Replit environment
2. **Manual**: Set `DEV_MODE=true` environment variable for explicit control
3. **Verification**: Check console logs for "Development mode enabled" message
4. **Testing**: Use unlimited generations, voice combinations, and synthesis

### For Production
1. **Disabled**: Dev mode automatically disabled in production
2. **Security**: All dev mode features inaccessible to production users
3. **Monitoring**: Production environments log warnings if dev mode detected
4. **Safety**: User data and billing unaffected by dev mode features

## Implementation Files Modified

### Backend
- `server/lib/dev-mode.ts` - Core dev mode detection and configuration
- `server/lib/utils/checkQuota.ts` - Quota bypass logic
- `server/security-middleware.ts` - Rate limit bypass
- `server/middleware/enforcePlan.ts` - Feature access bypass
- `server/routes.ts` - Voice combination and prompt length extensions
- `server/openai-service.ts` - Dev mode watermarks
- `shared/schema.ts` - Session mode tracking

### Frontend  
- `client/src/lib/dev-mode.ts` - Frontend dev mode detection
- `client/src/pages/dashboard.tsx` - Dev mode UI enhancements

### Database Schema Changes
- Added `mode` field to `voice_sessions` table for dev/production tracking
- Maintains data integrity between development and production sessions