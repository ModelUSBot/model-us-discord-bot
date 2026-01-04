# Design Document: Discord Bot Enhancements

## Overview

This design implements comprehensive enhancements to the Model US Discord Bot, focusing on improved data display, enhanced admin tools, new user features, and better activity tracking. The design maintains backward compatibility while adding significant new functionality.

## Architecture

### Database Schema Changes

The existing database schema will be extended with new columns to support the enhanced features:

```sql
-- Add new columns to nations table
ALTER TABLE nations ADD COLUMN flag TEXT;
ALTER TABLE nations ADD COLUMN flag_set_at DATETIME;
ALTER TABLE nations ADD COLUMN capitol TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nations_flag_set_at ON nations(flag_set_at);
CREATE INDEX IF NOT EXISTS idx_nations_capitol ON nations(capitol);
```

### Command Structure Updates

The bot will maintain its existing command structure while adding new commands and enhancing existing ones:

- Enhanced existing commands: AdminStatsUpdate, RankingsCommand, StatsCommand, AdminActivity
- New admin commands: AdminEndWar, AdminAudit, AdminSetFlag, AdminSetCapitol
- New player commands: SetFlag, SetCapitol, ActivityByNation

## Components and Interfaces

### 1. GDP Display Standardization Component

**Purpose**: Ensure consistent GDP display across all commands

**Implementation**:
- Create utility function `formatGDP(trillions: number): string`
- Update all commands to use this utility
- Maintain internal storage in trillions for precision

```typescript
// Utility function
export function formatGDP(billions: number): string {
  return `${billions.toFixed(2)} Billion`;
}
```

### 2. Enhanced Admin Statistics Component

**Purpose**: Simplify stat updates with +/- notation and percentage changes

**Key Changes**:
- Remove separate operation choices (set/add/remove)
- Accept positive/negative numbers directly
- Calculate and display percentage changes
- Add "set" option for absolute values

**Interface**:
```typescript
interface StatUpdateOptions {
  nation: string;
  stat: 'gdp' | 'stability' | 'population' | 'tax_rate';
  value: number; // Can be positive, negative, or absolute
  isAbsolute?: boolean; // Optional flag for absolute setting
}
```
### 3. War Management Component

**Purpose**: Allow admins to end active wars

**Implementation**:
- New AdminEndWar command
- Update war status to "ended"
- Set end_date to current timestamp
- Log admin action

**Interface**:
```typescript
interface WarEndOptions {
  warId: number;
  adminId: string;
  reason?: string;
}
```

### 4. Nation Audit Log Component

**Purpose**: Track and display all changes to nations

**Implementation**:
- Enhance existing admin_actions table
- Filter actions by nation name
- Display chronological history
- Support pagination for large histories

**Database Query**:
```sql
SELECT * FROM admin_actions 
WHERE details LIKE '%nation_name%' 
ORDER BY timestamp DESC 
LIMIT 20;
```

### 5. Public Response System

**Purpose**: Remove all ephemeral responses

**Implementation**:
- Remove `ephemeral: true` from all interaction replies
- Update error handling to be public
- Ensure transparency in all bot interactions

### 6. Nation Flag System

**Purpose**: Allow nations to set visual flags with cooldown

**Database Schema**:
```sql
-- Already added in schema changes above
flag TEXT,
flag_set_at DATETIME
```

**Cooldown Logic**:
```typescript
function canSetFlag(lastSetTime: Date | null): boolean {
  if (!lastSetTime) return true;
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return lastSetTime < threeHoursAgo;
}
```

### 7. Leader Display Component

**Purpose**: Show Discord user linked to each nation

**Implementation**:
- Join nations with user_links table
- Display Discord username in stats
- Handle unlinked nations gracefully

**Database Query**:
```sql
SELECT n.*, ul.discord_id 
FROM nations n 
LEFT JOIN user_links ul ON n.name = ul.nation_name 
WHERE n.name = ?;
```
### 8. Enhanced Activity Tracking Component

**Purpose**: Fix timestamp display and add nation-based activity views

**Implementation**:
- Update TimeUtils to handle relative timestamps
- Fix "Just Now" issue with proper time calculations
- Add nation grouping functionality

**Time Display Logic**:
```typescript
function formatRelativeTime(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
  if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hours ago`;
  return `${Math.floor(diffMinutes / 1440)} days ago`;
}
```

### 9. Capitol Management Component

**Purpose**: Allow setting and displaying nation capitals

**Database Schema**:
```sql
-- Already added in schema changes above
capitol TEXT
```

**Validation**:
- Maximum length: 50 characters
- Alphanumeric and basic punctuation only
- No profanity or inappropriate content

## Data Models

### Enhanced Nation Model

```typescript
interface NationStats {
  name: string;
  gdp: number; // Stored in billions
  stability: number;
  population: number;
  taxRate: number;
  budget: number;
  gdpPerCapita: number;
  gdpChange?: number;
  populationChange?: number;
  updatedAt: Date;
  
  // New fields
  flag?: string;
  flagSetAt?: Date;
  capitol?: string;
  leader?: string; // Discord username if linked
}
```

### Activity Model Enhancement

```typescript
interface UserActivity {
  discordId: string;
  channelId: string;
  lastMessageAt: Date;
  messageCount: number;
  
  // Enhanced fields
  nationName?: string; // If user is linked
  relativeTime: string; // Computed field
}

interface NationActivity {
  nationName: string;
  totalMessages: number;
  lastActivity: Date;
  activeUsers: number;
  leader?: string;
}
```

### Audit Log Model

```typescript
interface AuditLogEntry {
  id: number;
  adminId: string;
  adminUsername: string;
  action: string;
  details: string;
  timestamp: Date;
  nationAffected?: string;
}
```
## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: GDP Display Consistency
*For any* nation with GDP data, all display functions (rankings, stats, admin updates) should format GDP values in billions with consistent decimal precision
**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: GDP Storage Precision
*For any* GDP value, the system should store it in billions internally and display it in billions, maintaining mathematical precision
**Validates: Requirements 1.4**

### Property 3: Stat Update Math Accuracy
*For any* stat update with positive or negative values, the new value should equal the old value plus the input value (where negative inputs result in subtraction)
**Validates: Requirements 2.1, 2.3, 2.4**

### Property 4: Percentage Change Calculation
*For any* stat update, the displayed percentage change should equal ((new_value - old_value) / old_value) * 100
**Validates: Requirements 2.2**

### Property 5: War Status Update
*For any* active war that is ended by an admin, the war status should change to "ended" and end_date should be set to current timestamp
**Validates: Requirements 3.1, 3.2**

### Property 6: Audit Log Completeness
*For any* nation, the audit log should contain all administrative actions that reference that nation name in the details
**Validates: Requirements 4.1**

### Property 7: Public Response Enforcement
*For any* command interaction, the response should not have the ephemeral flag set to true
**Validates: Requirements 5.1**

### Property 8: Flag Storage and Cooldown
*For any* flag setting operation, the flag should be stored in the database and cooldown should be enforced based on the previous flag_set_at timestamp
**Validates: Requirements 6.1, 6.2**

### Property 9: Leader Display Accuracy
*For any* nation that is linked to a Discord user, the stats display should include the correct Discord username as leader
**Validates: Requirements 7.1**

### Property 10: Timestamp Formatting Precision
*For any* activity timestamp, the relative time display should accurately reflect the time difference between now and the timestamp
**Validates: Requirements 8.1**

### Property 11: Capitol Storage Integrity
*For any* capitol setting operation, the capitol name should be stored in the database and displayed in nation stats
**Validates: Requirements 9.1**

### Property 12: Activity Grouping Accuracy
*For any* activity by nation query, users should be correctly grouped by their linked nation names, with unlinked users grouped separately
**Validates: Requirements 10.1**

### Property 13: Schema Backward Compatibility
*For any* existing database operation, it should continue to work correctly after schema changes are applied
**Validates: Requirements 11.2**

## Error Handling

### Input Validation
- Flag emojis: Validate unicode emoji format
- Capitol names: Maximum 50 characters, alphanumeric and basic punctuation
- Stat values: Validate numeric ranges and prevent negative values where inappropriate
- Time calculations: Handle edge cases in relative time formatting

### Database Error Handling
- Schema migration failures: Rollback capability
- Constraint violations: Graceful error messages
- Connection issues: Retry logic with exponential backoff

### Discord API Error Handling
- Rate limiting: Implement proper backoff strategies
- Permission errors: Clear error messages for users
- Network timeouts: Retry failed operations

## Testing Strategy

### Unit Testing
- Test individual utility functions (GDP formatting, time calculations, cooldown logic)
- Test database operations in isolation
- Test command validation logic
- Test percentage calculation accuracy

### Property-Based Testing
- Test GDP display consistency across all commands with random values
- Test stat update math with various positive/negative inputs
- Test cooldown enforcement with random timestamps
- Test activity grouping with various user/nation combinations
- Minimum 100 iterations per property test
- Each test tagged with: **Feature: discord-bot-enhancements, Property X: [property description]**

### Integration Testing
- Test complete command workflows
- Test database schema migrations
- Test Discord interaction flows
- Test error handling scenarios

The testing approach combines specific unit tests for edge cases with comprehensive property-based tests to verify universal correctness across all inputs.
### 10. Law Management System

**Purpose**: Allow nations to create, manage, and organize laws

**Database Schema**:
```sql
CREATE TABLE IF NOT EXISTS laws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  body_text TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  nation_name TEXT NOT NULL,
  created_by TEXT NOT NULL, -- Discord ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nation_name) REFERENCES nations(name) ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE(name, nation_name) -- Prevent duplicate law names within same nation
);
```

**Interface**:
```typescript
interface Law {
  id: number;
  name: string;
  bodyText: string;
  isPublic: boolean;
  nationName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  tags?: Tag[];
}
```

### 11. Tag Management System

**Purpose**: Provide categorization system for laws

**Database Schema**:
```sql
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  created_by TEXT NOT NULL, -- Discord ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS law_tags (
  law_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (law_id, tag_id),
  FOREIGN KEY (law_id) REFERENCES laws(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
```

**Interface**:
```typescript
interface Tag {
  id: number;
  name: string;
  description: string;
  createdBy: string;
  createdAt: Date;
}

interface LawTagAssociation {
  lawId: number;
  tagId: number;
}
```

### Enhanced Data Models

```typescript
// Updated Law model with tag support
interface LawWithTags extends Law {
  tags: Tag[];
}

// Pagination support for tag listing
interface TagListOptions {
  itemsPerPage: number;
  page: number;
  nationFilter?: string;
}
```
### Property 14: Law Privacy Enforcement
*For any* law read request, the law should only be returned if it's public or owned by the requesting user's nation
**Validates: Requirements 13.2**

### Property 15: Law Name Uniqueness
*For any* nation, law names should be unique within that nation's jurisdiction
**Validates: Requirements 13.5**

### Property 16: Tag Uniqueness
*For any* tag creation attempt, the system should prevent duplicate tag names globally
**Validates: Requirements 14.4**

### Property 17: Tag-Law Association Integrity
*For any* law with associated tags, the tags should be correctly linked and displayed
**Validates: Requirements 15.1, 15.2**