#!/bin/bash

echo "🚀 Complete Discord Bot Setup Script"
echo "This will set up everything on your Oracle Cloud server"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we have the required parameters
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <DISCORD_TOKEN> <CLIENT_ID>"
    echo "Example: $0 'your_bot_token_here' 'your_client_id_here'"
    exit 1
fi

DISCORD_TOKEN="$1"
CLIENT_ID="$2"

print_status "Starting complete setup..."

# Update system
print_status "Step 1: Updating system..."
sudo yum update -y

# Install Node.js
print_status "Step 2: Installing Node.js..."
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# Install PM2 and Git
print_status "Step 3: Installing PM2 and Git..."
sudo npm install -g pm2
sudo yum install -y git

# Clone repository if not exists
if [ ! -d "discord-bot" ]; then
    print_status "Step 4: Cloning repository..."
    git clone https://github.com/ModelUSBot/model-us-discord-bot.git discord-bot
fi

cd discord-bot

# Install bot dependencies
print_status "Step 5: Installing bot dependencies..."
npm install

# Build the bot
print_status "Step 6: Building bot..."
npm run build

# Create data directory
mkdir -p data
mkdir -p logs

# Create environment file
print_status "Step 7: Creating environment file..."
cat > .env << EOF
DISCORD_TOKEN=${DISCORD_TOKEN}
CLIENT_ID=${CLIENT_ID}
DATABASE_PATH=./data/model-us-bot.db
NODE_ENV=production
EOF

# Set up web manager
print_status "Step 8: Setting up web manager..."
cd web-manager
npm install

# Create PM2 ecosystem file for web manager
cat > ecosystem.web-manager.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'bot-web-manager',
    script: 'server.js',
    cwd: '/home/opc/discord-bot/web-manager',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/home/opc/logs/web-manager.log',
    out_file: '/home/opc/logs/web-manager-out.log',
    error_file: '/home/opc/logs/web-manager-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
EOF

# Start web manager
print_status "Step 9: Starting web manager..."
pm2 start ecosystem.web-manager.config.js

# Go back to bot directory
cd ..

# Start Discord bot
print_status "Step 10: Starting Discord bot..."
pm2 start ecosystem.config.js

# Register Discord commands
print_status "Step 11: Registering Discord commands..."
node dist/deploy-commands.js

# Save PM2 configuration
print_status "Step 12: Saving PM2 configuration..."
pm2 save
pm2 startup

print_status "✅ Setup complete!"
echo ""
echo "🎉 Your Discord bot is now running!"
echo ""
echo "📊 Check status: pm2 status"
echo "📋 View logs: pm2 logs"
echo "🌐 Web manager: http://170.9.255.211:3000"
echo ""
print_warning "Don't forget to transfer your database file if needed:"
print_warning "scp -i ~/Downloads/ssh-key-2026-01-13-3.key data/oracle-deployment-backup.db opc@170.9.255.211:~/discord-bot/data/model-us-bot.db"