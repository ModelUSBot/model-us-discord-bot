import * as fc from 'fast-check';
import { PermissionManager } from '../PermissionManager';
import { Logger } from '../../utils/Logger';
import { ChatInputCommandInteraction, PermissionsBitField, PermissionFlagsBits } from 'discord.js';

// Mock Discord.js interaction
const createMockInteraction = (
  userId: string, 
  userTag: string, 
  permissions?: bigint[],
  hasGuild: boolean = true
): Partial<ChatInputCommandInteraction> => ({
  user: {
    id: userId,
    tag: userTag,
  } as any,
  guild: hasGuild ? { id: 'test-guild' } as any : null,
  memberPermissions: permissions ? new PermissionsBitField(permissions) : null,
  reply: jest.fn().mockResolvedValue(undefined),
});

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;
  let logger: Logger;
  let mockDatabase: any;

  beforeEach(() => {
    logger = new Logger('error'); // Suppress logs during tests
    mockDatabase = {
      logAdminAction: jest.fn(),
    };
  });

  describe('Property 22: Admin Access Control', () => {
    // Feature: model-us-discord-bot, Property 22: For any non-admin user attempting any admin command, the system should deny access and provide an appropriate error message
    
    test('non-admin users are consistently denied access', () => {
      fc.assert(fc.property(
        fc.record({
          adminUserIds: fc.array(fc.string({ minLength: 17, maxLength: 19 }), { minLength: 1, maxLength: 5 }),
          nonAdminUserId: fc.string({ minLength: 17, maxLength: 19 }),
          userTag: fc.string({ minLength: 5, maxLength: 20 })
        }).filter(data => !data.adminUserIds.includes(data.nonAdminUserId)),
        async (data) => {
          permissionManager = new PermissionManager(data.adminUserIds, logger);
          
          const mockInteraction = createMockInteraction(
            data.nonAdminUserId, 
            data.userTag,
            [] // No admin permissions
          ) as ChatInputCommandInteraction;

          const hasAccess = await permissionManager.verifyAdmin(mockInteraction);
          
          // Non-admin users should always be denied
          expect(hasAccess).toBe(false);
          
          // Should have sent error response
          expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ You do not have permission to use this command. Admin privileges required.',
            ephemeral: true
          });
        }
      ), { numRuns: 100 });
    });

    test('admin users consistently get access', () => {
      fc.assert(fc.property(
        fc.record({
          adminUserIds: fc.array(fc.string({ minLength: 17, maxLength: 19 }), { minLength: 1, maxLength: 5 }),
          userTag: fc.string({ minLength: 5, maxLength: 20 })
        }),
        async (data) => {
          permissionManager = new PermissionManager(data.adminUserIds, logger);
          
          // Test with one of the admin user IDs
          const adminUserId = data.adminUserIds[0];
          const mockInteraction = createMockInteraction(
            adminUserId, 
            data.userTag
          ) as ChatInputCommandInteraction;

          const hasAccess = await permissionManager.verifyAdmin(mockInteraction);
          
          // Admin users should always get access
          expect(hasAccess).toBe(true);
          
          // Should not have sent error response
          expect(mockInteraction.reply).not.toHaveBeenCalled();
        }
      ), { numRuns: 100 });
    });

    test('users with Discord admin permissions get access', () => {
      fc.assert(fc.property(
        fc.record({
          userId: fc.string({ minLength: 17, maxLength: 19 }),
          userTag: fc.string({ minLength: 5, maxLength: 20 }),
          adminPermission: fc.constantFrom(
            PermissionFlagsBits.Administrator,
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageRoles
          )
        }),
        async (data) => {
          permissionManager = new PermissionManager([], logger); // No hardcoded admins
          
          const mockInteraction = createMockInteraction(
            data.userId, 
            data.userTag,
            [data.adminPermission]
          ) as ChatInputCommandInteraction;

          const hasAccess = await permissionManager.verifyAdmin(mockInteraction);
          
          // Users with admin permissions should get access
          expect(hasAccess).toBe(true);
          
          // Should not have sent error response
          expect(mockInteraction.reply).not.toHaveBeenCalled();
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 23: Permission Verification Consistency', () => {
    // Feature: model-us-discord-bot, Property 23: For any administrative function, the system should verify admin permissions before execution
    
    test('permission verification is consistent across all admin checks', () => {
      fc.assert(fc.property(
        fc.record({
          adminUserIds: fc.array(fc.string({ minLength: 17, maxLength: 19 }), { minLength: 0, maxLength: 3 }),
          userId: fc.string({ minLength: 17, maxLength: 19 }),
          userTag: fc.string({ minLength: 5, maxLength: 20 }),
          hasAdminRole: fc.boolean()
        }),
        async (data) => {
          permissionManager = new PermissionManager(data.adminUserIds, logger);
          
          const permissions = data.hasAdminRole ? [PermissionFlagsBits.Administrator] : [];
          const mockInteraction = createMockInteraction(
            data.userId, 
            data.userTag,
            permissions
          ) as ChatInputCommandInteraction;

          // Check both isAdmin and verifyAdmin methods
          const isAdminResult = await permissionManager.isAdmin(mockInteraction);
          const verifyAdminResult = await permissionManager.verifyAdmin(mockInteraction);
          
          const shouldHaveAccess = data.adminUserIds.includes(data.userId) || data.hasAdminRole;
          
          // Both methods should return consistent results
          expect(isAdminResult).toBe(shouldHaveAccess);
          expect(verifyAdminResult).toBe(shouldHaveAccess);
          
          // Error response should only be sent when access is denied
          if (shouldHaveAccess) {
            expect(mockInteraction.reply).not.toHaveBeenCalled();
          } else {
            expect(mockInteraction.reply).toHaveBeenCalledWith({
              content: '❌ You do not have permission to use this command. Admin privileges required.',
              ephemeral: true
            });
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Unit Tests for Permission System', () => {
    beforeEach(() => {
      permissionManager = new PermissionManager(['123456789012345678'], logger);
    });

    test('should correctly identify hardcoded admin users', async () => {
      const mockInteraction = createMockInteraction(
        '123456789012345678', 
        'admin#1234'
      ) as ChatInputCommandInteraction;

      const isAdmin = await permissionManager.isAdmin(mockInteraction);
      expect(isAdmin).toBe(true);
    });

    test('should correctly identify non-admin users', async () => {
      const mockInteraction = createMockInteraction(
        '987654321098765432', 
        'user#5678',
        [] // No permissions
      ) as ChatInputCommandInteraction;

      const isAdmin = await permissionManager.isAdmin(mockInteraction);
      expect(isAdmin).toBe(false);
    });

    test('should handle users without guild context', async () => {
      const mockInteraction = createMockInteraction(
        '987654321098765432', 
        'user#5678',
        undefined,
        false // No guild
      ) as ChatInputCommandInteraction;

      const isAdmin = await permissionManager.isAdmin(mockInteraction);
      expect(isAdmin).toBe(false);
    });

    test('should log admin actions correctly', () => {
      const mockInteraction = createMockInteraction(
        '123456789012345678', 
        'admin#1234'
      ) as ChatInputCommandInteraction;

      permissionManager.logAdminAction(
        mockInteraction, 
        'UPDATE_STATS', 
        'Updated nation stats for TestNation',
        mockDatabase
      );

      expect(mockDatabase.logAdminAction).toHaveBeenCalledWith(
        '123456789012345678',
        'UPDATE_STATS',
        'Updated nation stats for TestNation'
      );
    });

    test('should manage admin user list correctly', () => {
      const newAdminId = '111222333444555666';
      
      permissionManager.addAdminUser(newAdminId);
      expect(permissionManager.getAdminUsers()).toContain(newAdminId);
      
      permissionManager.removeAdminUser(newAdminId);
      expect(permissionManager.getAdminUsers()).not.toContain(newAdminId);
    });

    test('should check specific Discord permissions correctly', () => {
      const mockInteraction = createMockInteraction(
        '123456789012345678', 
        'user#1234',
        [PermissionFlagsBits.ManageMessages]
      ) as ChatInputCommandInteraction;

      const hasManageMessages = permissionManager.hasPermission(
        mockInteraction, 
        PermissionFlagsBits.ManageMessages
      );
      const hasAdministrator = permissionManager.hasPermission(
        mockInteraction, 
        PermissionFlagsBits.Administrator
      );

      expect(hasManageMessages).toBe(true);
      expect(hasAdministrator).toBe(false);
    });
  });
});