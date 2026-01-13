# Oracle Cloud Deployment Guide for Discord Bot

## Prerequisites
- Oracle Cloud account (free tier)
- Your Discord bot token
- Basic Linux command knowledge

## Step 1: Create Compute Instance

1. **Login to Oracle Cloud Console**
2. **Navigate to**: Compute → Instances
3. **Click "Create Instance"**
4. **Configure**:
   - **Name**: `discord-bot-server`
   - **Image**: Ubuntu 22.04 LTS
   - **Shape**: VM.Standard.A1.Flex (Ampere - FREE)
   - **OCPUs**: 1
   - **Memory**: 6 GB
   - **Boot Volume**: 50 GB
5. **Networking**: Use default VCN, assign public IP
6. **SSH Keys**: Generate or upload your SSH key
7. **Click "Create"**

## Step 2: Configure Security Rules

1. **Go to**: Networking → Virtual Cloud Networks
2. **Click your VCN** → Security Lists → Default Security List
3. **Add Ingress Rules**:
   - **Source**: 0.0.0.0/0
   - **Protocol**: TCP
   - **Port**: 22 (SSH)
   - **Port**: 80 (HTTP)
   - **Port**: 443 (HTTPS)

## Step 3: Connect to Your Instance

```bash
# SSH into your instance
ssh -i your-private-key.pem ubuntu@YOUR_PUBLIC_IP
```

## Step 4: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 for process management
sudo npm install -g pm2

# Install Git and other tools
sudo apt install git nginx certbot python3-certbot-nginx -y

# Install build tools
sudo apt install build-essential -y
```

## Step 5: Setup Database

### Option A: MySQL on Same Server (Recommended for simplicity)
```bash
# Install MySQL
sudo apt install mysql-server -y

# Secure MySQL installation
sudo mysql_secure_installation

# Create database and user
sudo mysql -u root -p
```

```sql
CREATE DATABASE discord_bot;
CREATE USER 'botuser'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON discord_bot.* TO 'botuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Option B: Oracle Autonomous Database (More advanced)
- Create Autonomous Database in Oracle Cloud Console
- Download wallet file
- Configure connection string

## Step 6: Deploy Your Bot

```bash
# Clone your repository (you'll need to push to GitHub first)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git discord-bot
cd discord-bot

# Install dependencies
npm install

# Build the project
npm run build
```

## Step 7: Configure Environment Variables

```bash
# Create environment file
sudo nano /etc/environment

# Add these variables:
DISCORD_TOKEN=your_discord_bot_token
DATABASE_URL=mysql://botuser:your_secure_password@localhost:3306/discord_bot
ADMIN_USER_IDS=your_discord_user_id
NODE_ENV=production
```

## Step 8: Start Your Bot

```bash
# Start with PM2
pm2 start dist/index.js --name "discord-bot"

# Make PM2 start on boot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs discord-bot
```

## Step 9: Setup Firewall

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw allow 3306  # MySQL (if using local MySQL)
```

## Step 10: Optional - Setup Domain & SSL

```bash
# If you have a domain, configure Nginx
sudo nano /etc/nginx/sites-available/discord-bot

# Add SSL with Let's Encrypt
sudo certbot --nginx -d yourdomain.com
```

## Monitoring Commands

```bash
# Check bot status
pm2 status

# View logs
pm2 logs discord-bot

# Restart bot
pm2 restart discord-bot

# Check system resources
htop
df -h
free -h
```

## Backup Strategy

```bash
# Create backup script
nano backup.sh
```

```bash
#!/bin/bash
# Backup database
mysqldump -u botuser -p discord_bot > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup to Oracle Object Storage (optional)
# oci os object put --bucket-name backups --file backup_*.sql
```

## Troubleshooting

- **Bot won't start**: Check `pm2 logs discord-bot`
- **Database connection issues**: Verify MySQL is running with `sudo systemctl status mysql`
- **Memory issues**: Monitor with `free -h` and `htop`
- **Disk space**: Check with `df -h`

## Cost Monitoring

- Oracle Cloud free tier includes monitoring
- Set up billing alerts in the console
- Monitor usage in Governance → Cost Analysis