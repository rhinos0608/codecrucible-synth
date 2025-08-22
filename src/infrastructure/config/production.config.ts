/**
 * Production Configuration
 * Enterprise-grade configuration settings for production deployment
 */

export interface ProductionConfig {
  environment: 'development' | 'staging' | 'production';
  server: {
    host: string;
    port: number;
    protocol: 'http' | 'https';
    timeout: number;
  };
  database: {
    host: string;
    port: number;
    name: string;
    ssl: boolean;
    connectionTimeout: number;
    maxConnections: number;
  };
  security: {
    enableHTTPS: boolean;
    cors: {
      enabled: boolean;
      allowedOrigins: string[];
    };
    rateLimit: {
      windowMs: number;
      maxRequests: number;
    };
    encryption: {
      algorithm: string;
      keyLength: number;
    };
  };
  monitoring: {
    healthCheck: {
      enabled: boolean;
      interval: number;
      timeout: number;
      endpoints: string[];
    };
    metrics: {
      enabled: boolean;
      endpoint: string;
      interval: number;
    };
    logging: {
      level: string;
      format: string;
      rotation: boolean;
    };
  };
  performance: {
    cache: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
    };
    clustering: {
      enabled: boolean;
      workers: number;
    };
    compression: {
      enabled: boolean;
      level: number;
    };
  };
}

const productionConfig: ProductionConfig = {
  environment: 'production',
  server: {
    host: '0.0.0.0',
    port: 3002,
    protocol: 'https',
    timeout: 30000,
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'codecrucible_prod',
    ssl: true,
    connectionTimeout: 10000,
    maxConnections: 20,
  },
  security: {
    enableHTTPS: true,
    cors: {
      enabled: true,
      allowedOrigins: ['https://app.codecrucible.com', 'https://dashboard.codecrucible.com'],
    },
    rateLimit: {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
    },
    encryption: {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
    },
  },
  monitoring: {
    healthCheck: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000, // 5 seconds
      endpoints: ['/health', '/metrics', '/ready'],
    },
    metrics: {
      enabled: true,
      endpoint: '/metrics',
      interval: 10000, // 10 seconds
    },
    logging: {
      level: 'info',
      format: 'json',
      rotation: true,
    },
  },
  performance: {
    cache: {
      enabled: true,
      ttl: 300000, // 5 minutes
      maxSize: 1000,
    },
    clustering: {
      enabled: true,
      workers: 0, // Use all available CPU cores
    },
    compression: {
      enabled: true,
      level: 6,
    },
  },
};

export default productionConfig;
