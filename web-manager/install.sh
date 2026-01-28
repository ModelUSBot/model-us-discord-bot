#!/bin/bash

echo "🚀 Installing Discord Bot Web Manager..."

# Install dependencies
npm install

# Create PM2 ecosystem file for the web manager
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

# Create logs directory
mkdir -p ~/logs

# Start the web manager with PM2
pm2 start ecosystem.web-manager.config.js

# Save PM2 configuration
pm2 save

echo "✅ Web Manager installed and started!"
echo ""
echo "🌐 Access your bot manager at:"
echo "   http://170.9.255.211:3000"
echo ""
echo "📋 Management commands:"
echo "   pm2 status           - Check all services"
echo "   pm2 logs bot-web-manager - View web manager logs"
echo "   pm2 restart bot-web-manager - Restart web manager"
echo ""
echo "⚠️  Don't forget to add port 3000 to your Oracle Cloud security rules!"
echo "   Go to: Networking → Security Lists → Add Ingress Rule"
echo "   Source CIDR: 0.0.0.0/0, Protocol: TCP, Port: 3000"