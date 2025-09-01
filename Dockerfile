# Production-Ready Dockerfile for CodeCrucible Synth
# Multi-stage build following enterprise security and optimization patterns

# Stage 1: Development Dependencies and Build
FROM node:20-alpine AS builder

# Install system dependencies for production builds
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Set working directory
WORKDIR /app

# Copy package files for dependency resolution
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies with production optimizations
# Using npm ci for faster, reliable, reproducible builds
RUN npm ci --include=dev --ignore-scripts

# Copy source code
COPY src/ ./src/
COPY config/ ./config/
COPY tests/ ./tests/

# Build the application with production optimizations
RUN npm run build

# Run tests to ensure build quality
RUN npm test

# Remove development dependencies for smaller image
RUN npm ci --omit=dev --ignore-scripts

# Stage 2: Production Runtime
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S codecrucible -u 1001

# Install runtime dependencies only
RUN apk add --no-cache \
    ca-certificates \
    curl \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Copy built application and runtime files from builder stage
COPY --from=builder --chown=codecrucible:nodejs /app/dist ./dist
COPY --from=builder --chown=codecrucible:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=codecrucible:nodejs /app/config ./config
COPY --from=builder --chown=codecrucible:nodejs /app/package*.json ./

# Create required directories with proper permissions
RUN mkdir -p logs cache temp && \
    chown -R codecrucible:nodejs logs cache temp && \
    chmod 755 logs cache temp

# Set environment variables for production
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048" \
    NPM_CONFIG_CACHE=/app/cache \
    LOG_LEVEL=info \
    PORT=3002

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Switch to non-root user
USER codecrucible

# Expose port
EXPOSE 3002

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js", "--server", "--port", "3002"]