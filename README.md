# Model US Discord Bot

A comprehensive Discord bot for Model US server management with nation statistics, user activity tracking, disaster simulation, and war management.

## Features

### 🏛️ Nation Statistics Management
- **Admin Commands**: Update GDP, stability, population, and tax rates
- **Player Commands**: View detailed nation statistics with percentage changes
- **Automatic Calculations**: Budget automatically calculated from GDP × Tax Rate, GDP per Capita from GDP ÷ Population
- **Historical Tracking**: Percentage changes tracked for GDP and population

### 👥 User Management
- **User-Nation Linking**: Link Discord users to nations they control
- **Activity Monitoring**: Track user activity across channels
- **Admin Controls**: Comprehensive permission system with role and user ID verification

### 🚨 Disaster Simulation
- **Probability-Based Generation**: 50% small, 35% medium, 10% large, 5% very large disasters
- **Multiple Categories**: Natural disasters, pandemics, wars, economic crises, famines
- **Detailed Scenarios**: Complete with timelines, casualties, costs, and affected regions
- **Proximity Factors**: War disasters consider geographic proximity for impact scaling

### ⚔️ War Management
- **War Records**: Track conflicts with participants, dates, and casualties
- **Real-time Updates**: Admins can update casualty counts as conflicts evolve
- **Comprehensive Display**: View all wars with filtering by status

### 📊 Rankings & Analytics
- **Nation Rankings**: Compare nations by GDP, population, stability, and tax rate
- **Activity Reports**: Detailed user activity analysis per channel
- **Audit Logging**: All admin actions logged for transparency

## Installation

### Prerequisites
- Node.js 18.0.0 or higher
- npm or yarn package manager
- Discord Application with Bot Token

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd model-us-discord-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # Discord Bot Configuration
   DISCORD_TOKEN=your_bot_token_here
   CLIENT_ID=your_application_id_here
   GUILD_ID=your_guild_id_here  # Optional: for faster command deployment

   # Database Configuration
   DATABASE_PATH=./data/model-us-bot.db

   # Admin Configuration (comma-separated Discord user IDs)
   ADMIN_USER_IDS=123456789012345678,987654321098765432

   # Logging Configuration
   LOG_LEVEL=info

   # Environment
   NODE_ENV=production
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Deploy slash commands**
   ```bash
   npm run deploy-commands
   ```

6. **Start the bot**
   ```bash
   npm start
   ```

## Development

### Development Mode
```bash
npm run dev
```

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Code Quality
```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## Commands

### Admin Commands (Require Admin Permissions)

#### `/admin-stats-update`
Update nation statistics including GDP, stability, population, and tax rate.
- **Parameters**: nation, gdp, stability, population, tax_rate
- **Features**: Automatic budget calculation, percentage change tracking

#### `/admin-link-user`
Link Discord users to nations they control.
- **Parameters**: user, nation, force (optional)
- **Features**: Prevents duplicate assignments, force override option

#### `/admin-activity`
Check user activity in specific channels.
- **Parameters**: channel, limit, show_inactive
- **Features**: Time since last message, message counts, inactive user detection

#### `/admin-disaster`
Generate random disaster scenarios for simulation events.
- **Parameters**: detailed (optional)
- **Features**: Probability-based generation, detailed scenarios, proximity factors

#### `/admin-war-add`
Add new wars to the records.
- **Parameters**: name, participants, start_date, casualties, description
- **Features**: Multi-nation conflicts, casualty tracking

#### `/admin-war-update`
Update war casualty counts.
- **Parameters**: war_id, casualties
- **Features**: Autocomplete for active wars, change tracking

### Player Commands (Available to All Users)

#### `/stats <nation>`
View comprehensive nation statistics.
- **Features**: GDP, stability, population, tax rate, budget, GDP per capita, percentage changes
- **Autocomplete**: Nation names with preview information including GDP per capita

#### `/wars [status]`
View all wars and conflicts.
- **Parameters**: status (active/ended/all)
- **Features**: Participant lists, duration, casualty counts, descriptions

#### `/rankings <category> [limit]`
View nation rankings by category.
- **Parameters**: category (gdp/population/stability/tax_rate/gdp_per_capita), limit
- **Features**: Leaderboard format, statistics, medal emojis

## Database Schema

The bot uses SQLite with the following main tables:

- **nations**: Nation statistics with computed budget, GDP per capita, and percentage changes
- **user_links**: Discord user to nation associations
- **wars**: War records with participants and casualty tracking
- **user_activity**: Message activity tracking per channel
- **admin_actions**: Audit log of all administrative actions

## Architecture

### Core Components
- **BotClient**: Extended Discord.js client with custom functionality
- **DatabaseManager**: SQLite database operations with transaction support
- **PermissionManager**: Role and user-based access control
- **DisasterGenerator**: Probability-based disaster scenario generation
- **Command System**: Modular slash command architecture

### Testing Strategy
- **Property-Based Testing**: Uses fast-check for comprehensive input validation
- **Unit Testing**: Jest for specific functionality and edge cases
- **Integration Testing**: End-to-end command flow validation
- **30+ Correctness Properties**: Formal specifications for system behavior

## Configuration

### Admin Permissions
Admins are identified by:
1. Discord role permissions (Administrator, Manage Guild, Manage Roles)
2. Hardcoded user IDs in environment variables

### Database Configuration
- **WAL Mode**: Enabled for better performance
- **Foreign Keys**: Enforced for data integrity
- **Computed Columns**: Automatic budget and percentage calculations
- **Indexes**: Optimized for common queries

### Logging
Configurable log levels: debug, info, warn, error

## Deployment

### Production Deployment
1. Set `NODE_ENV=production`
2. Use process manager (PM2, systemd, etc.)
3. Configure log rotation
4. Set up database backups
5. Monitor bot uptime and performance

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
CMD ["npm", "start"]
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
1. Check the GitHub Issues page
2. Review the documentation
3. Contact the development team

---

**Model US Discord Bot** - Comprehensive server management for Model United States simulations.