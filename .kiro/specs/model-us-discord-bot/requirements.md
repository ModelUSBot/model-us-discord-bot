# Requirements Document

## Introduction

A Discord bot for a Model US Server that manages nation statistics, user activity tracking, disaster simulation, war management, and provides various administrative and player commands for server management and gameplay enhancement.

## Glossary

- **Bot**: The Discord bot application
- **Admin**: Server administrators with elevated permissions
- **Player**: Regular Discord server members
- **Nation**: A state/country entity in the Model US simulation
- **Stats**: Nation statistics including GDP, Stability, Population, Tax Rate, and Budget
- **Database**: Persistent storage system for bot data
- **Channel**: Discord text channel for communication
- **Disaster**: Simulated events that can affect nations
- **War**: Conflict events between nations or external entities

## Requirements

### Requirement 1: Nation Statistics Management

**User Story:** As an admin, I want to manage nation statistics in real-time, so that I can keep the simulation data current and accurate.

#### Acceptance Criteria

1. WHEN an admin updates nation statistics, THE Bot SHALL store the new values in the database immediately
2. WHEN statistics are updated, THE Bot SHALL calculate budget automatically using GDP * Tax Rate formula
3. WHEN tax rate is not specified, THE Bot SHALL use 20% as the default tax rate
4. THE Bot SHALL allow manual database insertion of statistics outside of Discord commands
5. WHEN GDP or Population changes, THE Bot SHALL calculate and store the percentage change from previous values

### Requirement 2: Player Statistics Access

**User Story:** As a player, I want to view nation statistics, so that I can understand the current state of any nation in the simulation.

#### Acceptance Criteria

1. WHEN a player uses /stats command with a nation name, THE Bot SHALL display GDP, Stability, Population, Tax Rate, and Budget
2. WHEN displaying GDP and Population, THE Bot SHALL show percentage change from previous dataset
3. WHEN a nation does not exist, THE Bot SHALL return an appropriate error message
4. THE Bot SHALL format statistics in a clear, readable Discord embed

### Requirement 3: User-Nation Linking System

**User Story:** As an admin, I want to link Discord users to nations, so that I can associate players with their controlled states.

#### Acceptance Criteria

1. WHEN an admin uses the link command, THE Bot SHALL associate a Discord user ID with a nation
2. THE Bot SHALL allow manual database insertion of user-nation links
3. WHEN a user is already linked to a nation, THE Bot SHALL update the existing link
4. THE Bot SHALL prevent duplicate nation assignments unless explicitly overridden

### Requirement 4: Activity Monitoring

**User Story:** As an admin, I want to check player activity, so that I can monitor engagement and participation levels.

#### Acceptance Criteria

1. WHEN an admin requests activity data, THE Bot SHALL display time since last message for each user in a specified channel
2. THE Bot SHALL format activity data as a list showing username and time since last message
3. WHEN a user has never posted in the specified channel, THE Bot SHALL indicate "No messages found"
4. THE Bot SHALL allow admins to specify the channel ID for activity monitoring

### Requirement 5: Disaster Simulation System

**User Story:** As an admin, I want to generate disaster scenarios, so that I can introduce dynamic events into the simulation.

#### Acceptance Criteria

1. WHEN an admin uses the disaster command, THE Bot SHALL generate a random disaster with 50% small, 35% medium, 10% large, 5% very large probability
2. THE Bot SHALL include detailed information: timeline, estimated casualties, economic cost, and affected regions
3. THE Bot SHALL provide variety including natural disasters, pandemics, famines, distant wars, and nearby conflicts
4. WHEN generating war-related disasters, THE Bot SHALL consider proximity impact (nearby wars are more severe)
5. THE Bot SHALL format disaster information in a comprehensive, detailed embed

### Requirement 6: War Management System

**User Story:** As an admin, I want to manage war records, so that I can track conflicts and their impacts on the simulation.

#### Acceptance Criteria

1. WHEN an admin adds a war, THE Bot SHALL store war details including start date, participants, and initial casualty estimates
2. WHEN an admin updates war casualties, THE Bot SHALL modify the existing war record
3. WHEN a player requests war information, THE Bot SHALL display all active and historical wars
4. THE Bot SHALL show war start dates, casualty counts, and participant nations for each conflict

### Requirement 7: Nation Rankings System

**User Story:** As a player, I want to see top-performing nations, so that I can compare national performance across different metrics.

#### Acceptance Criteria

1. WHEN a player requests rankings, THE Bot SHALL display top nations sorted by the specified category
2. THE Bot SHALL support rankings for Tax Rate, Population, GDP, and Stability
3. THE Bot SHALL format rankings in a clear leaderboard format
4. WHEN insufficient data exists for rankings, THE Bot SHALL display available nations with their values

### Requirement 8: Administrative Access Control

**User Story:** As a system administrator, I want to restrict sensitive commands to authorized users, so that data integrity and server security are maintained.

#### Acceptance Criteria

1. WHEN a non-admin user attempts an admin command, THE Bot SHALL deny access and display an appropriate error message
2. THE Bot SHALL verify admin permissions before executing any administrative function
3. THE Bot SHALL log all administrative actions for audit purposes
4. WHEN admin permissions change, THE Bot SHALL respect updated Discord role permissions immediately

### Requirement 9: Data Persistence and Database Integration

**User Story:** As a system administrator, I want reliable data storage, so that simulation data persists across bot restarts and can be managed externally.

#### Acceptance Criteria

1. THE Bot SHALL store all nation statistics, user links, wars, and activity data in a persistent database
2. WHEN the bot restarts, THE Bot SHALL maintain all previously stored data
3. THE Bot SHALL allow external database modifications to be reflected in Discord commands
4. WHEN database operations fail, THE Bot SHALL provide appropriate error messages and maintain data consistency

### Requirement 10: Command Interface and User Experience

**User Story:** As a user, I want intuitive slash commands, so that I can easily interact with the bot's features.

#### Acceptance Criteria

1. THE Bot SHALL implement all user commands as Discord slash commands with appropriate parameters
2. WHEN commands are used incorrectly, THE Bot SHALL provide helpful usage instructions
3. THE Bot SHALL respond to commands within 3 seconds under normal conditions
4. THE Bot SHALL format all responses using Discord embeds for improved readability
5. WHEN commands require parameters, THE Bot SHALL validate input and provide clear error messages for invalid data