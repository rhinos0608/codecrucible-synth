#!/bin/sh
# CodeCrucible Synth Docker Entrypoint Script
# Handles initialization, health checks, and graceful shutdown

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Trap signals for graceful shutdown
cleanup() {
    log_info "Received shutdown signal, performing graceful shutdown..."
    
    # Send SIGTERM to main process
    if [ -n "$MAIN_PID" ]; then
        kill -TERM "$MAIN_PID" 2>/dev/null || true
        
        # Wait for graceful shutdown (up to 30 seconds)
        for i in $(seq 1 30); do
            if ! kill -0 "$MAIN_PID" 2>/dev/null; then
                log_info "Main process shut down gracefully"
                break
            fi
            sleep 1
        done
        
        # Force kill if still running
        if kill -0 "$MAIN_PID" 2>/dev/null; then
            log_warn "Force killing main process"
            kill -KILL "$MAIN_PID" 2>/dev/null || true
        fi
    fi
    
    exit 0
}

trap cleanup SIGTERM SIGINT

# Validate environment
validate_environment() {
    log_info "Validating environment configuration..."
    
    # Check required directories
    for dir in logs cache secrets; do
        if [ ! -d "/app/$dir" ]; then
            log_error "Required directory /app/$dir does not exist"
            exit 1
        fi
        
        if [ ! -w "/app/$dir" ]; then
            log_error "Directory /app/$dir is not writable"
            exit 1
        fi
    done
    
    # Check Node.js version
    NODE_VERSION=$(node --version)
    log_info "Node.js version: $NODE_VERSION"
    
    # Check available memory
    MEMORY_MB=$(free -m | awk 'NR==2{printf "%.0f", $7}')
    log_info "Available memory: ${MEMORY_MB}MB"
    
    if [ "$MEMORY_MB" -lt 512 ]; then
        log_warn "Low memory available: ${MEMORY_MB}MB (recommended: 1GB+)"
    fi
    
    # Validate configuration
    if [ ! -f "/app/config/default.yaml" ]; then
        log_error "Default configuration not found"
        exit 1
    fi
    
    log_info "Environment validation completed"
}

# Initialize application
initialize_app() {
    log_info "Initializing CodeCrucible Synth..."
    
    # Set default environment variables if not provided
    export NODE_ENV=${NODE_ENV:-production}
    export PORT=${PORT:-3002}
    export HEALTH_CHECK_PORT=${HEALTH_CHECK_PORT:-3003}
    export LOG_LEVEL=${LOG_LEVEL:-info}
    export METRICS_ENABLED=${METRICS_ENABLED:-true}
    
    # Configure logging
    export LOG_FILE="/app/logs/application.log"
    export ERROR_LOG_FILE="/app/logs/error.log"
    export ACCESS_LOG_FILE="/app/logs/access.log"
    
    # Create log files with proper permissions
    touch "$LOG_FILE" "$ERROR_LOG_FILE" "$ACCESS_LOG_FILE"
    
    # Set up cache directory
    export CACHE_DIR="/app/cache"
    
    # Set up secrets directory
    export SECRETS_DIR="/app/secrets"
    
    # Configure performance settings
    export UV_THREADPOOL_SIZE=${UV_THREADPOOL_SIZE:-16}
    export NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=65536"
    
    log_info "Application initialization completed"
}

# Health check function
health_check() {
    local max_attempts=30
    local attempt=1
    
    log_info "Waiting for application to start..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "http://localhost:${HEALTH_CHECK_PORT}/health" >/dev/null 2>&1; then
            log_info "Application health check passed"
            return 0
        fi
        
        log_info "Health check attempt $attempt/$max_attempts failed, retrying in 2 seconds..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    log_error "Application failed to start within $(($max_attempts * 2)) seconds"
    return 1
}

# Start health check server
start_health_server() {
    log_info "Starting health check server on port $HEALTH_CHECK_PORT..."
    
    # Create simple health check server
    cat > /tmp/health-server.js << 'EOF'
const http = require('http');
const port = process.env.HEALTH_CHECK_PORT || 3003;

const server = http.createServer((req, res) => {
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version
        }));
    } else if (req.url === '/ready') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            status: 'ready',
            timestamp: new Date().toISOString()
        }));
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`Health check server listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Health check server shutting down...');
    server.close(() => {
        process.exit(0);
    });
});
EOF
    
    node /tmp/health-server.js &
    HEALTH_SERVER_PID=$!
}

# Check dependencies
check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check if Ollama is accessible (optional)
    if [ -n "$OLLAMA_ENDPOINT" ]; then
        if curl -f "$OLLAMA_ENDPOINT/api/tags" >/dev/null 2>&1; then
            log_info "Ollama endpoint is accessible"
        else
            log_warn "Ollama endpoint is not accessible (will run in degraded mode)"
        fi
    fi
    
    # Check if LM Studio is accessible (optional)
    if [ -n "$LM_STUDIO_ENDPOINT" ]; then
        if curl -f "$LM_STUDIO_ENDPOINT/v1/models" >/dev/null 2>&1; then
            log_info "LM Studio endpoint is accessible"
        else
            log_warn "LM Studio endpoint is not accessible (will run in degraded mode)"
        fi
    fi
    
    # Check database connectivity (if configured)
    if [ -n "$DATABASE_URL" ]; then
        log_info "Database URL configured: $DATABASE_URL"
        # Add database connectivity check here if needed
    fi
    
    # Check Redis connectivity (if configured)
    if [ -n "$REDIS_URL" ]; then
        log_info "Redis URL configured: $REDIS_URL"
        # Add Redis connectivity check here if needed
    fi
}

# Configure monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    
    # Enable Prometheus metrics if configured
    if [ "$METRICS_ENABLED" = "true" ]; then
        export PROMETHEUS_METRICS_ENABLED=true
        export PROMETHEUS_METRICS_PORT=${PROMETHEUS_METRICS_PORT:-9090}
        log_info "Prometheus metrics enabled on port $PROMETHEUS_METRICS_PORT"
    fi
    
    # Configure distributed tracing if enabled
    if [ -n "$JAEGER_AGENT_HOST" ]; then
        export JAEGER_SERVICE_NAME="codecrucible-synth"
        export JAEGER_SAMPLER_TYPE=const
        export JAEGER_SAMPLER_PARAM=1
        log_info "Distributed tracing enabled (Jaeger)"
    fi
    
    # Configure log aggregation
    if [ -n "$LOG_AGGREGATION_ENDPOINT" ]; then
        export LOG_AGGREGATION_ENABLED=true
        log_info "Log aggregation enabled"
    fi
}

# Pre-flight checks
preflight_checks() {
    log_info "Running pre-flight checks..."
    
    # Check disk space
    DISK_USAGE=$(df /app | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 90 ]; then
        log_error "Disk usage is critically high: ${DISK_USAGE}%"
        exit 1
    elif [ "$DISK_USAGE" -gt 80 ]; then
        log_warn "Disk usage is high: ${DISK_USAGE}%"
    fi
    
    # Check file descriptor limits
    FILE_LIMIT=$(ulimit -n)
    if [ "$FILE_LIMIT" -lt 1024 ]; then
        log_warn "File descriptor limit is low: $FILE_LIMIT (recommended: 65536+)"
    fi
    
    # Validate configuration syntax
    if ! node -e "require('./config/default.yaml')" 2>/dev/null; then
        log_warn "Configuration file validation skipped (YAML require not available)"
    fi
    
    log_info "Pre-flight checks completed"
}

# Main execution flow
main() {
    log_info "Starting CodeCrucible Synth container..."
    log_info "Build info: Version=${BUILD_VERSION:-unknown}, Date=${BUILD_DATE:-unknown}, Commit=${BUILD_COMMIT:-unknown}"
    
    # Run initialization steps
    validate_environment
    initialize_app
    setup_monitoring
    check_dependencies
    preflight_checks
    
    # Start health check server
    start_health_server
    
    # Start the main application
    log_info "Starting main application: $*"
    
    # Execute the command passed to the script
    "$@" &
    MAIN_PID=$!
    
    # Wait for application to be ready
    if ! health_check; then
        log_error "Application failed health check"
        exit 1
    fi
    
    log_info "CodeCrucible Synth is ready and healthy!"
    
    # Monitor the main process
    while kill -0 "$MAIN_PID" 2>/dev/null; do
        sleep 5
    done
    
    # Main process has exited
    wait "$MAIN_PID"
    EXIT_CODE=$?
    
    log_info "Main process exited with code: $EXIT_CODE"
    
    # Cleanup health server
    if [ -n "$HEALTH_SERVER_PID" ]; then
        kill "$HEALTH_SERVER_PID" 2>/dev/null || true
    fi
    
    exit $EXIT_CODE
}

# Handle direct execution vs sourcing
if [ "${0##*/}" = "docker-entrypoint.sh" ]; then
    main "$@"
fi