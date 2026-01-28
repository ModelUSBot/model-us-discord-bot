const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 4000;

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Bot management functions
const botCommands = {
    start: 'cd ~/discord-bot && pm2 start dist/index.js --name discord-bot',
    stop: 'pm2 stop discord-bot',
    restart: 'pm2 restart discord-bot',
    register: 'cd ~/discord-bot && node dist/deploy-commands.js',
    logs: 'pm2 logs discord-bot --lines 100 --nostream',
    status: 'pm2 jlist',
    info: 'pm2 info discord-bot',
    monit: 'pm2 monit --no-daemon'
};

// Enhanced error message parsing
function parseErrorMessage(error, action) {
    const errorStr = error.error || error.message || '';
    const stderrStr = error.stderr || '';
    
    // Common PM2 errors with user-friendly messages
    if (errorStr.includes('Script already launched') || stderrStr.includes('Script already launched')) {
        return 'Bot is already running. Use restart instead.';
    }
    
    if (errorStr.includes('Process or Namespace') && errorStr.includes('not found')) {
        return 'Bot process not found. It may not be running.';
    }
    
    if (errorStr.includes('File ecosystem.config.js not found')) {
        return 'Configuration file missing. Using direct startup method.';
    }
    
    if (errorStr.includes('ENOENT') || errorStr.includes('command not found')) {
        return 'Required command or file not found. Check installation.';
    }
    
    if (errorStr.includes('permission denied') || errorStr.includes('EACCES')) {
        return 'Permission denied. Check file permissions.';
    }
    
    if (errorStr.includes('port') && errorStr.includes('in use')) {
        return 'Port already in use. Another service may be running.';
    }
    
    if (action === 'register' && errorStr.includes('DiscordAPIError')) {
        return 'Discord API error. Check bot token and permissions.';
    }
    
    if (action === 'update' && errorStr.includes('git')) {
        return 'Git update failed. Check repository access.';
    }
    
    // Return original error if no specific handling
    return errorStr || stderrStr || 'Unknown error occurred';
}

// Execute shell command with promise
function executeCommand(command) {
    return new Promise((resolve, reject) => {
        exec(command, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject({ error: error.message, stderr });
            } else {
                resolve({ stdout, stderr });
            }
        });
    });
}

// Get bot status with enhanced information
async function getBotStatus() {
    try {
        const result = await executeCommand(botCommands.status);
        const processes = JSON.parse(result.stdout);
        const botProcess = processes.find(p => p.name === 'discord-bot');
        
        if (botProcess) {
            const status = botProcess.pm2_env.status;
            const isOnline = status === 'online';
            
            return {
                status: isOnline ? 'online' : status,
                uptime: isOnline ? formatUptime(botProcess.pm2_env.pm_uptime) : null,
                memory: Math.round(botProcess.monit.memory / 1024 / 1024) + ' MB',
                cpu: botProcess.monit.cpu + '%',
                restarts: botProcess.pm2_env.restart_time || 0,
                pid: botProcess.pid || 'N/A',
                version: botProcess.pm2_env.version || 'Unknown',
                created: new Date(botProcess.pm2_env.created_at).toLocaleString(),
                lastRestart: botProcess.pm2_env.restart_time > 0 ? 
                    new Date(botProcess.pm2_env.pm_uptime).toLocaleString() : 'Never'
            };
        } else {
            return { 
                status: 'offline',
                message: 'Bot process not found'
            };
        }
    } catch (error) {
        return { 
            status: 'unknown', 
            error: parseErrorMessage(error, 'status'),
            message: 'Unable to retrieve bot status'
        };
    }
}

// Format uptime
function formatUptime(timestamp) {
    const uptime = Date.now() - timestamp;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// API Routes
app.get('/api/status', async (req, res) => {
    try {
        const status = await getBotStatus();
        res.json(status);
    } catch (error) {
        res.status(500).json({ error: 'Failed to get status' });
    }
});

app.post('/api/action', async (req, res) => {
    const { action } = req.body;
    
    if (!botCommands[action]) {
        return res.status(400).json({ 
            success: false, 
            message: 'Invalid action requested' 
        });
    }
    
    try {
        console.log(`Executing action: ${action}`);
        const result = await executeCommand(botCommands[action]);
        
        let message = '';
        let output = result.stdout;
        
        switch (action) {
            case 'start':
                message = 'Bot started successfully!';
                break;
            case 'stop':
                message = 'Bot stopped successfully!';
                break;
            case 'restart':
                message = 'Bot restarted successfully!';
                break;
            case 'register':
                message = 'Discord commands registered successfully!';
                // Parse command count from output
                const commandMatch = output.match(/(\d+)\s+application/);
                if (commandMatch) {
                    message = `Successfully registered ${commandMatch[1]} Discord commands!`;
                }
                break;
            case 'logs':
                message = 'Logs retrieved successfully!';
                break;
            default:
                message = 'Action completed successfully!';
        }
        
        res.json({ 
            success: true, 
            message,
            output: output || result.stderr,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error(`Error executing ${action}:`, error);
        const friendlyError = parseErrorMessage(error, action);
        
        res.json({ 
            success: false, 
            message: friendlyError,
            output: error.stderr,
            timestamp: new Date().toISOString()
        });
    }
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Discord Bot Manager running on http://0.0.0.0:${PORT}`);
    console.log(`Access from anywhere: http://170.9.255.211:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down Discord Bot Manager...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nShutting down Discord Bot Manager...');
    process.exit(0);
});