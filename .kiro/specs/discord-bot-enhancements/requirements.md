# Requirements Document

## Introduction

This document outlines comprehensive enhancements to the Model US Discord Bot to improve user experience, add new functionality, and fix existing issues. The enhancements focus on better data display, improved admin tools, enhanced user features, and better activity tracking.

## Glossary

- **Bot**: The Model US Discord Bot system
- **Nation**: A player-controlled entity in the simulation
- **Admin**: Users with administrative privileges
- **Player**: Regular users of the bot
- **Leader**: The Discord user linked to a nation
- **Flag**: A visual emoji/unicode symbol representing a nation
- **Capitol**: The designated capital city of a nation
- **Audit_Log**: Historical record of changes made to a nation

## Requirements

### Requirement 1: GDP Display Standardization

**User Story:** As a user, I want GDP values displayed consistently in billions across all commands, so that I can easily understand and compare economic data.

#### Acceptance Criteria

1. WHEN viewing rankings, THE Bot SHALL display GDP values in billions format
2. WHEN viewing nation statistics, THE Bot SHALL display GDP values in billions format  
3. WHEN performing admin updates, THE Bot SHALL display GDP values in billions format
4. THE Bot SHALL store and display GDP values in billions for consistency

### Requirement 2: Enhanced Admin Statistics Updates

**User Story:** As an admin, I want simplified stat updates with percentage changes and +/- notation, so that I can efficiently modify nation statistics.

#### Acceptance Criteria

1. WHEN updating statistics, THE Bot SHALL accept positive and negative numbers for value changes
2. WHEN displaying stat changes, THE Bot SHALL show percentage change from previous value
3. WHEN using positive numbers, THE Bot SHALL add to the current value
4. WHEN using negative numbers, THE Bot SHALL subtract from the current value
5. WHEN setting absolute values, THE Bot SHALL use a separate "set" operation

### Requirement 3: War Management System

**User Story:** As an admin, I want to end active wars, so that I can manage conflict resolution in the simulation.

#### Acceptance Criteria

1. WHEN an admin ends a war, THE Bot SHALL update war status to "ended"
2. WHEN ending a war, THE Bot SHALL set the end date to current timestamp
3. WHEN ending a war, THE Bot SHALL log the admin action for audit purposes
4. THE Bot SHALL provide autocomplete for active war selection
### Requirement 4: Nation Audit Log System

**User Story:** As an admin, I want to view all historical changes to a nation, so that I can track modifications and maintain accountability.

#### Acceptance Criteria

1. WHEN viewing a nation's audit log, THE Bot SHALL display all administrative actions affecting that nation
2. WHEN displaying audit entries, THE Bot SHALL show timestamp, admin user, action type, and details
3. WHEN no audit history exists, THE Bot SHALL display an appropriate message
4. THE Bot SHALL provide autocomplete for nation selection in audit commands

### Requirement 5: Public Response System

**User Story:** As a user, I want all bot responses to be public, so that everyone can see command results and participate in discussions.

#### Acceptance Criteria

1. WHEN any command is executed, THE Bot SHALL respond publicly (not ephemeral)
2. WHEN error messages are displayed, THE Bot SHALL show them publicly
3. WHEN admin commands are used, THE Bot SHALL display results publicly for transparency

### Requirement 6: Nation Flag System

**User Story:** As a player, I want to set a flag for my nation, so that I can personalize my nation's appearance in statistics.

#### Acceptance Criteria

1. WHEN a player sets a flag, THE Bot SHALL store the flag emoji/unicode for their nation
2. WHEN setting a flag, THE Bot SHALL enforce a 3-hour cooldown between changes
3. WHEN displaying nation stats, THE Bot SHALL show the nation flag if set
4. WHEN a player attempts to change flag during cooldown, THE Bot SHALL display remaining time
5. WHEN admins set flags, THE Bot SHALL bypass cooldown restrictions

### Requirement 7: Leader Display System

**User Story:** As a user, I want to see who leads each nation, so that I can identify the person behind each nation.

#### Acceptance Criteria

1. WHEN a nation is linked to a Discord user, THE Bot SHALL display the leader's username in stats
2. WHEN a nation is not linked, THE Bot SHALL display "No Leader" or similar message
3. WHEN displaying leader information, THE Bot SHALL use current Discord username

### Requirement 8: Enhanced Activity Tracking

**User Story:** As an admin, I want detailed activity timestamps and nation-based activity views, so that I can monitor user engagement effectively.

#### Acceptance Criteria

1. WHEN displaying activity, THE Bot SHALL show precise timestamps instead of "Just Now"
2. WHEN viewing activity, THE Bot SHALL display relative time (e.g., "2 hours ago")
3. WHEN viewing activity by nation, THE Bot SHALL group messages by linked nations
4. WHEN a user is not linked to a nation, THE Bot SHALL show their Discord username
5. THE Bot SHALL track message timestamps accurately in the database
### Requirement 9: Capitol Management System

**User Story:** As a player, I want to set my nation's capital city, so that I can define my nation's seat of government.

#### Acceptance Criteria

1. WHEN a player sets their capitol, THE Bot SHALL store the capitol name for their nation
2. WHEN displaying nation stats, THE Bot SHALL show the capitol if set
3. WHEN a player is not linked to a nation, THE Bot SHALL prevent capitol setting
4. WHEN admins set capitols, THE Bot SHALL allow setting for any nation
5. THE Bot SHALL validate capitol names for reasonable length and content

### Requirement 10: Activity by Nation Command

**User Story:** As an admin, I want to view activity grouped by nations, so that I can see which nations are most active in discussions.

#### Acceptance Criteria

1. WHEN viewing activity by nation, THE Bot SHALL group users by their linked nations
2. WHEN displaying nation activity, THE Bot SHALL show message counts and last activity time
3. WHEN users are not linked, THE Bot SHALL group them under "Unlinked Users"
4. WHEN no activity exists, THE Bot SHALL display an appropriate message
5. THE Bot SHALL sort nations by activity level (most active first)

### Requirement 11: Database Schema Updates

**User Story:** As a system, I need updated database schema to support new features, so that all data is properly stored and retrieved.

#### Acceptance Criteria

1. THE Bot SHALL add flag column to nations table for storing flag emojis
2. THE Bot SHALL add flag_set_at column to nations table for cooldown tracking
3. THE Bot SHALL add capitol column to nations table for storing capitol names
4. THE Bot SHALL maintain backward compatibility with existing data
5. THE Bot SHALL create appropriate database indexes for performance

### Requirement 12: Command Interface Updates

**User Story:** As a user, I want intuitive command interfaces for new features, so that I can easily access and use new functionality.

#### Acceptance Criteria

1. THE Bot SHALL provide /set-flag command for players to set nation flags
2. THE Bot SHALL provide /admin-set-flag command for admins to set any nation's flag
3. THE Bot SHALL provide /set-capitol command for players to set their capitol
4. THE Bot SHALL provide /admin-set-capitol command for admins to set any nation's capitol
5. THE Bot SHALL provide /admin-end-war command for ending active wars
6. THE Bot SHALL provide /admin-audit command for viewing nation change history
7. THE Bot SHALL provide /activity-by-nation command for nation-grouped activity
8. THE Bot SHALL provide autocomplete for all relevant command parameters

### Requirement 13: Law Management System

**User Story:** As a player, I want to create and manage laws for my nation, so that I can establish governance rules and policies.

#### Acceptance Criteria

1. WHEN a player adds a law, THE Bot SHALL store the law with name, body text, public/private status, and nation
2. WHEN reading a law, THE Bot SHALL display the law if it's public or owned by the requesting user
3. WHEN listing laws, THE Bot SHALL show only public laws unless viewing own nation's laws
4. WHEN a law has tags, THE Bot SHALL display associated tags for organization
5. THE Bot SHALL prevent duplicate law names within the same nation

### Requirement 14: Tag Management System

**User Story:** As a user, I want to create and use tags to organize laws, so that I can categorize and find related legislation easily.

#### Acceptance Criteria

1. WHEN adding a tag, THE Bot SHALL create a unique tag with name and description
2. WHEN listing tags, THE Bot SHALL support pagination with configurable items per page
3. WHEN viewing tag info, THE Bot SHALL display the tag's description and usage
4. WHEN a tag already exists, THE Bot SHALL prevent duplicate tag creation
5. WHEN admins remove tags, THE Bot SHALL log the action with reason for audit purposes

### Requirement 15: Law-Tag Association System

**User Story:** As a player, I want to associate tags with my laws, so that I can organize and categorize my nation's legislation.

#### Acceptance Criteria

1. WHEN adding a law, THE Bot SHALL allow optional tag selection from existing tags
2. WHEN displaying laws, THE Bot SHALL show associated tags
3. WHEN filtering by tags, THE Bot SHALL return laws that have the specified tags
4. THE Bot SHALL provide autocomplete for tag selection in law commands
5. THE Bot SHALL maintain tag associations when laws are updated