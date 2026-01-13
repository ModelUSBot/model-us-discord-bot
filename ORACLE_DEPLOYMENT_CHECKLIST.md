# Oracle Cloud Deployment Checklist

## 🚀 Pre-Deployment Preparation

### ✅ **Step 1: Prepare Your Code**
- [ ] Stop local bot: `pm2 stop all` or `Ctrl+C`
- [ ] Create GitHub repository (if not already done)
- [ ] Push your code to GitHub
- [ ] Verify all environment variables are documented

### ✅ **Step 2: Oracle Cloud Setup**
- [ ] Login to Oracle Cloud Console
- [ ] Create Compute Instance (VM.Standard.A1.Flex - FREE)
- [ ] Configure security rules (ports 22, 80, 443)
- [ ] Download SSH private key

### ✅ **Step 3: Server Setup**
- [ ] SSH into your instance
- [ ] Install Node.js 18
- [ ] Install PM2, Git, build tools
- [ ] Setup MySQL database

### ✅ **Step 4: Deploy Bot**
- [ ] Clone repository
- [ ] Install dependencies
- [ ] Configure environment variables
- [ ] Build and start bot

## 🔧 Quick Commands Reference

### **Connect to Server**
```bash
ssh -i your-key.pem ubuntu@YOUR_PUBLIC_IP
```

### **Install Everything**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2 and tools
sudo npm install -g pm2
sudo apt install git mysql-server build-essential -y
```

### **Setup Database**
```bash
sudo mysql_secure_installation
sudo mysql -u root -p
```
```sql
CREATE DATABASE discord_bot;
CREATE USER 'botuser'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON discord_bot.* TO 'botuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### **Deploy Bot**
```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git discord-bot
cd discord-bot
npm install
npm run build
```

### **Configure Environment**
```bash
nano .env
```
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
DATABASE_PATH=./data/model-us-bot.db
NODE_ENV=production
```

### **Start Bot**
```bash
pm2 start dist/index.js --name "discord-bot"
pm2 startup
pm2 save
```

## 📋 What You Need Ready

1. **Discord Bot Token** (from Discord Developer Portal)
2. **Client ID** (from Discord Developer Portal)
3. **GitHub Account** (to host your code)
4. **Oracle Cloud Account** (free tier)
5. **SSH Key Pair** (generated during Oracle setup)

## 🎯 Next Steps

1. **Create Oracle Instance** - Follow oracle-cloud-setup.md
2. **Push Code to GitHub** - We'll help you with this
3. **Deploy to Oracle** - Follow the commands above
4. **Test Everything** - Verify bot works in Discord

Ready to start? Let me know which step you'd like help with first!