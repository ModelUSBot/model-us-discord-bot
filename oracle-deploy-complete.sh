#!/bin/bash

# Complete Oracle Cloud Deployment Script with Database Transfer
echo "🚀 Starting Complete Discord Bot Deployment to Oracle Cloud..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're on the server
if [ ! -f "package.json" ]; then
    print_error "This script should be run from the bot directory on the server."
    exit 1
fi

print_status "Step 1: Installing system dependencies..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
print_status "Step 2: Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 and other tools
print_status "Step 3: Installing PM2 and build tools..."
sudo npm install -g pm2
sudo apt install build-essential -y

print_status "Step 4: Installing bot dependencies..."
npm install

print_status "Step 5: Building TypeScript project..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Build failed. Please fix TypeScript errors."
    exit 1
fi

# Create data directory
print_status "Step 6: Setting up data directory..."
mkdir -p data
mkdir -p logs

# Check if database exists
if [ ! -f "data/model-us-bot.db" ]; then
    print_warning "Database not found. You'll need to transfer it manually."
    print_warning "Use: scp -i your-key.pem data/oracle-deployment-backup.db ubuntu@YOUR_IP:~/discord-bot/data/model-us-bot.db"
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    print_warning ".env file not found. Creating from template..."
    cp .env.example .env
    print_warning "Please edit .env with your actual Discord token and client ID!"
fi

print_status "Step 7: Starting bot with PM2..."
pm2 start ecosystem.config.js

print_status "Step 8: Setting up PM2 startup..."
pm2 startup
pm2 save

print_status "✅ Deployment complete!"
print_status "Next steps:"
print_status "1. Edit .env with your Discord credentials: nano .env"
print_status "2. Transfer database if needed"
print_status "3. Restart bot: pm2 restart discord-bot"
print_status "4. Check logs: pm2 logs discord-bot"

echo ""
print_warning "Don't forget to:"
print_warning "1. Update .env with your Discord token"
print_warning "2. Transfer your database file"
print_warning "3. Configure security rules if needed"