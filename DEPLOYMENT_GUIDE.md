# 🚀 Deploy Your Discord Bot to Render

## ✅ Pre-Setup Complete
Your bot is now ready for deployment! All necessary files have been created.

## 📋 What You Need
- Your Discord bot token (from Discord Developer Portal)
- Your Discord client ID
- Your Discord guild/server ID
- Your Discord user ID (for admin access)

## 🔒 Security Note
**Your bot token will be 100% secure!** It's stored as an environment variable on Render's servers, never in your code.

## 📝 Step-by-Step Instructions

### Step 1: Create GitHub Repository
1. Go to [github.com](https://github.com) and sign in
2. Click "New repository" (green button)
3. Repository name: `model-us-discord-bot`
4. Make it **Public** (required for Render free tier)
5. **Don't** check "Add a README file"
6. Click "Create repository"

### Step 2: Push Your Code
Run these commands in your terminal (in your bot folder):

```bash
git init
git add .
git commit -m "Initial Discord bot deployment"
git remote add origin https://github.com/YOUR_USERNAME/model-us-discord-bot.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 3: Deploy on Render
1. Go to [render.com](https://render.com)
2. Sign up using your GitHub account
3. Click "New +" → "Web Service"
4. Click "Connect" next to your `model-us-discord-bot` repository
5. Fill in these settings:
   - **Name**: `model-us-discord-bot`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: Select "Free"
6. Click "Create Web Service"

### Step 4: Add Environment Variables
In your Render dashboard, go to the "Environment" tab and add these:

```
DISCORD_TOKEN=your_actual_bot_token_here
CLIENT_ID=your_actual_client_id_here
GUILD_ID=your_actual_guild_id_here
ADMIN_USER_IDS=your_user_id_here
DATABASE_PATH=/opt/render/project/src/data/model-us-bot.db
NODE_ENV=production
PORT=3000
```

**Replace the values with your actual Discord information!**

### Step 5: Keep Bot Awake (Prevent Sleeping)
1. Go to [cron-job.org](https://cron-job.org)
2. Create a free account
3. Click "Create cronjob"
4. Settings:
   - **Title**: "Keep Discord Bot Awake"
   - **URL**: `https://your-app-name.onrender.com/health`
   - **Schedule**: Every 10 minutes
   - **Enabled**: Yes
5. Save the cron job

Replace `your-app-name` with your actual Render app name.

## 🎉 You're Done!
Your bot will be running 24/7 for free! Check the Render logs to make sure it started successfully.

## 🆘 Need Help?
If you get stuck on any step, let me know and I'll help you through it!

## 📊 Monitoring Your Bot
- **Render Dashboard**: View logs and uptime
- **Discord**: Test commands to make sure it's working
- **Cron Job**: Check that it's pinging every 10 minutes