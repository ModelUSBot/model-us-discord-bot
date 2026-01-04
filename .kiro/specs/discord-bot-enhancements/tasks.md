# Implementation Plan: Discord Bot Enhancements

## Overview

This implementation plan breaks down the comprehensive Discord bot enhancements into discrete, manageable tasks. The approach prioritizes database changes first, then utility functions, followed by command updates and new features.

## Tasks

- [ ] 1. Database Schema Updates and Utilities
- [x] 1.1 Update database schema with new columns
  - Add flag, flag_set_at, and capitol columns to nations table
  - Create appropriate indexes for performance
  - Update DatabaseManager with new fields
  - _Requirements: 11.1, 11.2_

- [x] 1.2 Create GDP formatting utility function
  - Implement formatGDP() function in utils
  - Ensure consistent billions display and storage across all commands
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 1.3 Write property tests for GDP formatting
  - **Property 1: GDP Display Consistency**
  - **Property 2: GDP Storage Precision**
  - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

- [x] 1.4 Create enhanced time formatting utilities
  - Fix "Just Now" issue with proper relative time calculation
  - Implement formatRelativeTime() function
  - Handle edge cases in time calculations
  - _Requirements: 8.1_

- [ ] 1.5 Write property tests for time formatting
  - **Property 10: Timestamp Formatting Precision**
  - **Validates: Requirements 8.1**

- [ ] 2. Enhanced Admin Statistics System
- [x] 2.1 Redesign AdminStatsUpdate command interface
  - Remove separate operation choices (set/add/remove)
  - Accept positive/negative numbers directly
  - Add percentage change calculations and display
  - Update command validation and error handling
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [ ] 2.2 Write property tests for stat updates
  - **Property 3: Stat Update Math Accuracy**
  - **Property 4: Percentage Change Calculation**
  - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [x] 2.3 Update all existing commands to use GDP utility
  - Update RankingsCommand to display GDP in billions
  - Update StatsCommand to display GDP in billions
  - Update AdminStatsUpdate to display GDP in billions
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 3. War Management System
- [ ] 3.1 Create AdminEndWar command
  - Implement command to end active wars
  - Add autocomplete for active war selection
  - Update war status to "ended" and set end_date
  - Log admin action for audit purposes
  - _Requirements: 3.1, 3.2_

- [ ] 3.2 Write property tests for war management
  - **Property 5: War Status Update**
  - **Validates: Requirements 3.1, 3.2**
- [ ] 4. Nation Audit Log System
- [ ] 4.1 Create AdminAudit command
  - Implement command to view nation change history
  - Filter admin_actions by nation name
  - Display chronological history with pagination
  - Add autocomplete for nation selection
  - _Requirements: 4.1_

- [ ] 4.2 Write property tests for audit log
  - **Property 6: Audit Log Completeness**
  - **Validates: Requirements 4.1**

- [ ] 5. Public Response System Updates
- [ ] 5.1 Remove ephemeral responses from all commands
  - Update all existing commands to remove ephemeral: true
  - Update error handling to be public
  - Ensure transparency in all bot interactions
  - _Requirements: 5.1_

- [ ] 5.2 Write property tests for public responses
  - **Property 7: Public Response Enforcement**
  - **Validates: Requirements 5.1**

- [ ] 6. Nation Flag System
- [ ] 6.1 Create SetFlag command for players
  - Implement command for players to set nation flags
  - Validate flag emoji format
  - Enforce 3-hour cooldown between changes
  - Display remaining cooldown time if applicable
  - _Requirements: 6.1, 6.2_

- [ ] 6.2 Create AdminSetFlag command for admins
  - Implement admin command to set any nation's flag
  - Bypass cooldown restrictions for admins
  - Add autocomplete for nation selection
  - _Requirements: 6.1_

- [ ] 6.3 Write property tests for flag system
  - **Property 8: Flag Storage and Cooldown**
  - **Validates: Requirements 6.1, 6.2**

- [ ] 7. Leader Display System
- [ ] 7.1 Update StatsCommand to show leaders
  - Join nations with user_links table
  - Display Discord username as leader if linked
  - Handle unlinked nations gracefully
  - _Requirements: 7.1_

- [ ] 7.2 Write property tests for leader display
  - **Property 9: Leader Display Accuracy**
  - **Validates: Requirements 7.1**

- [ ] 8. Enhanced Activity Tracking
- [ ] 8.1 Update AdminActivity command
  - Fix timestamp display using new time utilities
  - Show precise relative timestamps
  - Improve activity data presentation
  - _Requirements: 8.1_

- [ ] 8.2 Create ActivityByNation command
  - Group users by their linked nations
  - Show message counts and last activity time
  - Handle unlinked users appropriately
  - Sort nations by activity level
  - _Requirements: 10.1_

- [ ] 8.3 Write property tests for activity tracking
  - **Property 12: Activity Grouping Accuracy**
  - **Validates: Requirements 10.1**
- [ ] 9. Capitol Management System
- [ ] 9.1 Create SetCapitol command for players
  - Implement command for players to set their nation's capitol
  - Validate capitol names (length, content)
  - Require user to be linked to a nation
  - _Requirements: 9.1_

- [ ] 9.2 Create AdminSetCapitol command for admins
  - Implement admin command to set any nation's capitol
  - Add autocomplete for nation selection
  - Same validation as player command
  - _Requirements: 9.1_

- [ ] 9.3 Write property tests for capitol management
  - **Property 11: Capitol Storage Integrity**
  - **Validates: Requirements 9.1**

- [ ] 10. Integration and Command Registration
- [ ] 10.1 Register all new commands in index.ts
  - Add AdminEndWar command
  - Add AdminAudit command
  - Add AdminSetFlag command
  - Add AdminSetCapitol command
  - Add SetFlag command
  - Add SetCapitol command
  - Add ActivityByNation command
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [ ] 10.2 Update deploy-commands.ts
  - Ensure all new commands are included in deployment
  - Test command deployment process
  - _Requirements: 12.8_

- [ ] 11. Database Migration and Backward Compatibility
- [ ] 11.1 Create database migration script
  - Add new columns safely with default values
  - Create indexes for performance
  - Test migration on copy of production data
  - _Requirements: 11.1, 11.4_

- [ ] 11.2 Write property tests for backward compatibility
  - **Property 13: Schema Backward Compatibility**
  - **Validates: Requirements 11.2**

- [ ] 12. Final Integration and Testing
- [ ] 12.1 Update all command interfaces
  - Ensure consistent autocomplete behavior
  - Validate all command parameters
  - Test error handling scenarios
  - _Requirements: 12.8_

- [ ] 12.2 Write integration tests
  - Test complete command workflows
  - Test database operations
  - Test Discord interaction flows
  - _Requirements: All_

- [ ] 13. Checkpoint - Comprehensive Testing
- Ensure all tests pass, verify all features work correctly, ask the user if questions arise.

## Notes

- Tasks marked with comprehensive testing ensure robust implementation
- Each task references specific requirements for traceability
- Database changes should be tested thoroughly before deployment
- All new commands should follow existing patterns for consistency
- Property tests validate universal correctness across all inputs
- Integration tests ensure complete workflows function properly
- [ ] 14. Law Management System
- [ ] 14.1 Create database schema for laws and tags
  - Add laws table with name, body_text, is_public, nation_name columns
  - Add tags table with name, description columns
  - Add law_tags junction table for many-to-many relationships
  - Create appropriate indexes for performance
  - _Requirements: 13.1, 14.1, 15.1_

- [ ] 14.2 Create AddLaw command
  - Implement command for players to add laws to their nation
  - Support public/private visibility setting
  - Allow optional tag association during creation
  - Validate law name uniqueness within nation
  - _Requirements: 13.1, 13.5, 15.1_

- [ ] 14.3 Create ReadLaw command
  - Implement command to read specific laws
  - Enforce privacy rules (public or own nation only)
  - Display associated tags if any
  - Add autocomplete for law names
  - _Requirements: 13.2, 15.2_

- [ ] 14.4 Create ListLaws command
  - Implement command to list laws by nation
  - Show only public laws unless viewing own nation
  - Support filtering by tags
  - Add pagination for large law lists
  - _Requirements: 13.3, 15.3_

- [ ] 14.5 Write property tests for law management
  - **Property 14: Law Privacy Enforcement**
  - **Property 15: Law Name Uniqueness**
  - **Validates: Requirements 13.2, 13.5**

- [ ] 15. Tag Management System
- [ ] 15.1 Create AddTag command
  - Implement command to create new tags
  - Validate tag name uniqueness globally
  - Store tag description and creator info
  - _Requirements: 14.1, 14.4_

- [ ] 15.2 Create ListTags command
  - Implement command to list all tags with pagination
  - Support configurable items per page
  - Display tag names and descriptions
  - _Requirements: 14.2_

- [ ] 15.3 Create TagInfo command
  - Implement command to show detailed tag information
  - Display tag description and usage statistics
  - Show which laws use this tag
  - _Requirements: 14.3_

- [ ] 15.4 Create AdminRemoveTag command
  - Implement admin command to remove tags
  - Require reason for audit logging
  - Handle cascade deletion of tag associations
  - _Requirements: 14.5_

- [ ] 15.5 Write property tests for tag management
  - **Property 16: Tag Uniqueness**
  - **Property 17: Tag-Law Association Integrity**
  - **Validates: Requirements 14.4, 15.1, 15.2**

- [ ] 16. Law-Tag Integration
- [ ] 16.1 Update database manager with law and tag operations
  - Add methods for law CRUD operations
  - Add methods for tag CRUD operations
  - Add methods for law-tag association management
  - Implement privacy filtering logic
  - _Requirements: 13.1, 13.2, 13.3, 14.1, 15.1_

- [ ] 16.2 Register law and tag commands
  - Add AddLaw, ReadLaw, ListLaws commands
  - Add AddTag, ListTags, TagInfo, AdminRemoveTag commands
  - Update index.ts with new command registrations
  - Update deploy-commands.ts
  - _Requirements: All law and tag requirements_

- [ ] 17. Updated Final Integration
- [ ] 17.1 Update comprehensive testing checkpoint
  - Test all law management workflows
  - Test tag system functionality
  - Test law-tag associations
  - Verify privacy enforcement
  - Test admin tag removal
  - _Requirements: All requirements_