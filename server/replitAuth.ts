import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Check for required environment variables with fallbacks for development
if (!process.env.REPLIT_DOMAINS) {
  process.env.REPLIT_DOMAINS = process.env.REPLIT_DOMAIN || 'localhost:5000';
  console.warn('REPLIT_DOMAINS not set, using fallback:', process.env.REPLIT_DOMAINS);
}

if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'dev-session-secret-' + Math.random().toString(36);
  console.warn('SESSION_SECRET not set, using temporary development secret');
}

if (!process.env.REPL_ID) {
  process.env.REPL_ID = 'dev-repl-id';
  console.warn('REPL_ID not set, using development fallback');
}

const getOidcConfig = memoize(
  async () => {
    try {
      const issuerUrl = process.env.ISSUER_URL ?? "https://replit.com/oidc";
      console.log('Attempting OIDC discovery with:', { issuerUrl, replId: process.env.REPL_ID });
      
      return await client.discovery(
        new URL(issuerUrl),
        process.env.REPL_ID!
      );
    } catch (error) {
      console.error('OIDC discovery failed:', error);
      // In development, return a mock config to prevent blocking
      if (process.env.NODE_ENV === 'development') {
        console.warn('Using mock OIDC config for development');
        return {
          issuer: new URL("https://replit.com/oidc"),
          authorization_endpoint: new URL("https://replit.com/oidc/auth"),
          token_endpoint: new URL("https://replit.com/oidc/token"),
          userinfo_endpoint: new URL("https://replit.com/oidc/userinfo"),
          jwks_uri: new URL("https://replit.com/oidc/jwks"),
          end_session_endpoint: new URL("https://replit.com/oidc/session/end")
        } as any;
      }
      throw error;
    }
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Allow table creation in development
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: !isDevelopment, // Allow non-HTTPS in development
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  try {
    app.set("trust proxy", 1);
    app.use(getSession());
    app.use(passport.initialize());
    app.use(passport.session());

    const config = await getOidcConfig();
    console.log('OIDC config loaded successfully');

    const verify: VerifyFunction = async (
      tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
      verified: passport.AuthenticateCallback
    ) => {
      try {
        const user = {};
        updateUserSession(user, tokens);
        await upsertUser(tokens.claims());
        verified(null, user);
      } catch (error) {
        console.error('Auth verification failed:', error);
        verified(error as Error);
      }
    };

    const domains = process.env.REPLIT_DOMAINS!.split(",");
    console.log('Setting up auth for domains:', domains);

    for (const domain of domains) {
      const strategy = new Strategy(
        {
          name: `replitauth:${domain}`,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify,
      );
      passport.use(strategy);
    }

    passport.serializeUser((user: Express.User, cb) => cb(null, user));
    passport.deserializeUser((user: Express.User, cb) => cb(null, user));

    // Auth routes with error handling
    app.get("/api/login", (req, res, next) => {
      try {
        const hostname = req.hostname;
        console.log('Login attempt for hostname:', hostname);
        
        passport.authenticate(`replitauth:${hostname}`, {
          prompt: "login consent",
          scope: ["openid", "email", "profile", "offline_access"],
        })(req, res, next);
      } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Authentication service unavailable', details: error.message });
      }
    });

    app.get("/api/callback", (req, res, next) => {
      try {
        const hostname = req.hostname;
        console.log('Callback for hostname:', hostname);
        
        passport.authenticate(`replitauth:${hostname}`, {
          successReturnToOrRedirect: "/",
          failureRedirect: "/api/login",
        })(req, res, next);
      } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({ error: 'Authentication callback failed', details: error.message });
      }
    });

    app.get("/api/logout", async (req, res) => {
      try {
        req.logout(() => {
          res.redirect(
            client.buildEndSessionUrl(config, {
              client_id: process.env.REPL_ID!,
              post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
            }).href
          );
        });
      } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Logout failed', details: error.message });
      }
    });

    console.log('Authentication setup completed successfully');
  } catch (error) {
    console.error('Failed to setup authentication:', error);
    
    // Provide fallback routes for development
    app.get("/api/login", (req, res) => {
      res.status(503).json({ 
        error: 'Authentication service unavailable', 
        message: 'Please check OIDC configuration',
        details: error.message 
      });
    });
    
    app.get("/api/callback", (req, res) => {
      res.status(503).json({ 
        error: 'Authentication callback unavailable',
        message: 'Please check OIDC configuration' 
      });
    });
    
    app.get("/api/logout", (req, res) => {
      res.status(503).json({ 
        error: 'Logout service unavailable',
        message: 'Please check OIDC configuration' 
      });
    });
  }
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};