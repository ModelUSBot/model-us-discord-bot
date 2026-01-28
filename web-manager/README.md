# Discord Bot Web Manager

A simple, user-friendly web interface to manage your Discord bot remotely.

## Features

- ✅ **Start Bot** - Start the Discord bot
- ⏹️ **Stop Bot** - Stop the Discord bot
- 🔄 **Restart Bot** - Restart the Discord bot
- 📝 **Register Commands** - Deploy Discord slash commands
- 📋 **View Logs** - See recent bot logs
- 🔄 **Update from GitHub** - Pull latest code and restart

## Installation on Oracle Cloud Server

### Step 1: Upload to Server

From your local machine, upload the web-manager folder:

```bash
scp -i ~/Downloads/ssh-key-2026-01-13-3.key -r web-manager opc@170.9.255.211:~/discord-bot/
```

### Step 2: Install on Server

SSH into your server and run:

```bash
ssh -i ~/Downloads/ssh-key-2026-01-13-3.key opc@170.9.255.211
cd ~/discord-bot/web-manager
chmod +x install.sh
./install.sh
```

### Step 3: Configure Oracle Cloud Security

1. Go to Oracle Cloud Console
2. Navigate to your instance → Networking → Security
3. Click on your Security List
4. Add Ingress Rule:
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `TCP`
   - **Destination Port**: `3000`
   - **Description**: `Bot Web Manager`

### Step 4: Access the Web Manager

Open in your browser:
```
http://170.9.255.211:3000
```

## Usage

The web interface is self-explanatory:

1. **Check Status** - Automatically shows if bot is online/offline
2. **Click any button** to perform an action
3. **View Logs** - Click "View Logs" to see recent bot activity
4. **Auto-refresh** - Status updates every 30 seconds

## Management Commands

On the server, you can manage the web interface:

```bash
# Check status
pm2 status

# View logs
pm2 logs bot-web-manager

# Restart web manager
pm2 restart bot-web-manager

# Stop web manager
pm2 stop bot-web-manager
```

## Security Notes

- The web manager runs on port 3000
- No authentication is built-in (add firewall rules to restrict access)
- Consider using a VPN or IP whitelist for production
- All actions are logged in PM2 logs

## Troubleshooting

**Can't access the web page?**
- Check Oracle Cloud security rules allow port 3000
- Verify web manager is running: `pm2 status`
- Check logs: `pm2 logs bot-web-manager`

**Actions not working?**
- Ensure Discord bot is deployed in `~/discord-bot`
- Check PM2 is installed: `pm2 --version`
- Verify bot name in PM2: `pm2 list`

## Customization

Edit `server.js` to:
- Change port number
- Add authentication
- Modify bot commands
- Add more features

Edit `index.html` to:
- Change colors/styling
- Add more buttons
- Customize layout