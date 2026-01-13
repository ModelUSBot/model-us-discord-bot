#!/bin/bash

# Discord Bot Deployment Script for Oracle Cloud
echo "🚀 Starting Discord Bot Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the bot directory."
    exit 1
fi

# Install dependencies
print_status "Installing dependencies..."
npm install

# Build the project
print_status "Building TypeScript project..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Build failed. Please fix TypeScript errors."
    exit 1
fi

# Create logs directory
print_status "Creating logs directory..."
mkdir -p logs

# Check if .env exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Please create one based on .env.example"
    print_status "Copying .env.example to .env..."
    cp .env.example .env
    print_warning "Please edit .env with your actual values before starting the bot!"
fi

# Deploy commands (if Discord token is available)
if grep -q "your_discord_bot_token_here" .env; then
    print_warning "Discord token not configured. Skipping command deployment."
else
    print_status "Deploying Discord commands..."
    node dist/deploy-commands.js
fi

# Start with PM2
print_status "Starting bot with PM2..."
pm2 start ecosystem.config.js

# Setup PM2 startup (only run once)
print_status "Setting up PM2 startup script..."
pm2 startup
pm2 save

print_status "✅ Deployment complete!"
print_status "Use 'pm2 status' to check bot status"
print_status "Use 'pm2 logs discord-bot' to view logs"
print_status "Use 'pm2 restart discord-bot' to restart the bot"

echo ""
print_warning "Don't forget to:"
print_warning "1. Edit .env with your Discord token and client ID"
print_warning "2. Run 'pm2 restart discord-bot' after updating .env"
print_warning "3. Check logs with 'pm2 logs discord-bot' if there are issues"