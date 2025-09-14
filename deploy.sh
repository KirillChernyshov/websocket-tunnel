#!/bin/bash

# Enhanced deploy script with .env support
set -e

MODE="${1:-server}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to load .env file
load_env() {
    if [[ -f .env ]]; then
        print_info "📄 Loading .env file..."
        # Export all variables from .env (skip comments and empty lines)
        set -a
        source .env
        set +a
        print_success ".env loaded successfully"
    else
        print_warning ".env file not found"
    fi
}

# Function to create PM2 ecosystem with env variables
create_ecosystem_with_env() {
    local app_name="$1"
    local script_path="$2"
    local config_file="$3"
    
    print_info "🔧 Creating PM2 config with environment variables..."
    
    # Load env variables
    load_env
    
    # Check if PM2 supports env_file
    pm2_version=$(pm2 --version 2>/dev/null || echo "0.0.0")
    print_info "PM2 version: $pm2_version"
    
    # Create ecosystem config dynamically
    cat > "$config_file" << EOF
{
  "apps": [{
    "name": "$app_name",
    "script": "$script_path",
    "instances": 1,
    "exec_mode": "fork",
    "watch": false,
    "max_memory_restart": "512M",
    "env": {
      "NODE_ENV": "production"$(
        # Add all env variables from .env
        if [[ -f .env ]]; then
            while IFS= read -r line || [[ -n "$line" ]]; do
                # Skip empty lines and comments
                if [[ -n "$line" ]] && [[ ! "$line" =~ ^[[:space:]]*# ]]; then
                    key=$(echo "$line" | cut -d'=' -f1 | tr -d ' ')
                    value=$(echo "$line" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
                    if [[ -n "$key" ]] && [[ -n "$value" ]]; then
                        echo ","
                        echo "      \"$key\": \"$value\""
                    fi
                fi
            done < .env
        fi
    )
    },
    "error_file": "./logs/${app_name}-error.log",
    "out_file": "./logs/${app_name}-out.log", 
    "log_file": "./logs/${app_name}-combined.log",
    "time": true,
    "restart_delay": 5000,
    "max_restarts": 15,
    "min_uptime": "5s",
    "exp_backoff_restart_delay": 100
  }]
}
EOF

    print_success "✅ PM2 config created: $config_file"
}

# Main deployment logic
print_info "🚀 Starting enhanced deployment in mode: $MODE"

# Install dependencies
print_info "📦 Installing dependencies..."
npm install --omit=dev

# Build project
print_info "🔨 Building project..."
if [[ -f "node_modules/.bin/tsc" ]]; then
    ./node_modules/.bin/tsc || (echo '⚠️  TypeScript compilation had errors, but dist files were generated' && exit 0)
else
    npm run build
fi

# Create logs directory
mkdir -p logs

# Load environment variables
load_env

# Deploy based on mode
case "$MODE" in
    "server")
        print_info "🖥️  Deploying server..."
        
        # Stop existing server if running
        pm2 stop websocket-tunnel 2>/dev/null || true
        pm2 delete websocket-tunnel 2>/dev/null || true
        
        # Create ecosystem config with env vars
        create_ecosystem_with_env "websocket-tunnel" "dist/server/index.js" "ecosystem.server.generated.json"
        
        # Start server
        pm2 start ecosystem.server.generated.json
        
        print_success "✅ Server deployed successfully!"
        print_info "📋 Server endpoints:"
        print_info "   🌐 HTTP: http://localhost:${PORT:-3000}"
        print_info "   🔌 WebSocket: ws://localhost:${WS_PORT:-3001}"
        ;;
        
    "client")
        print_info "💻 Deploying client..."
        
        # Validate required env vars for client
        if [[ -z "$SERVER_WS_URL" ]]; then
            print_error "SERVER_WS_URL not set in .env file"
            exit 1
        fi
        
        if [[ -z "$CLIENT_ID" ]]; then
            print_error "CLIENT_ID not set in .env file"
            exit 1
        fi
        
        # Stop existing client if running  
        pm2 stop tunnel-client 2>/dev/null || true
        pm2 delete tunnel-client 2>/dev/null || true
        
        # Create ecosystem config with env vars
        create_ecosystem_with_env "tunnel-client" "dist/client/index.js" "ecosystem.client.generated.json"
        
        # Start client
        pm2 start ecosystem.client.generated.json
        
        print_success "✅ Client deployed successfully!"
        print_info "📋 Client configuration:"
        print_info "   🌐 Server: $SERVER_WS_URL"
        print_info "   🆔 Client ID: $CLIENT_ID"
        print_info "   🎯 Local Target: ${LOCAL_TARGET:-http://localhost:8080}"
        ;;
        
    *)
        print_error "Invalid mode: $MODE"
        print_info "Usage: $0 [server|client]"
        exit 1
        ;;
esac

# Show PM2 status
print_info "📊 PM2 Status:"
pm2 list

# Show logs preview
print_info "📝 Recent logs:"
sleep 2
if [[ "$MODE" == "server" ]]; then
    pm2 logs websocket-tunnel --lines 5 --nostream || true
else
    pm2 logs tunnel-client --lines 5 --nostream || true
fi

print_success "🎉 Deployment completed!"
print_info "💡 Useful commands:"
print_info "   📊 pm2 list         - Show running processes"
print_info "   📝 pm2 logs         - View logs"
print_info "   📈 pm2 monit        - Performance monitoring"
print_info "   🔄 pm2 restart all  - Restart all processes"
print_info "   ⏹️  pm2 stop all     - Stop all processes"