import * as fc from 'fast-check';
import { AdminLinkUserCommand } from '../admin/AdminLinkUser';
import { DatabaseManager } from '../../database/DatabaseManager';
import { Logger } from '../../utils/Logger';
import { BotClient } from '../../types';
import { ChatInputCommandInteraction, User } from 'discord.js';

// Mock Discord.js components
jest.mock('discord.js', () => ({
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addUserOption: jest.fn().mockReturnThis(),
    addStringOption: jest.fn().mockReturnThis(),
    addBooleanOption: jest.fn().mockReturnThis(),
  })),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setThumbnail: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
  })),
}));

const createMockUser = (id: string, tag: string): Partial<User> => ({
  id,
  tag,
  displayAvatarURL: jest.fn(() => 'https://example.com/avatar.png'),
});

const createMockInteraction = (
  options: Record<string, any> = {}
): Partial<ChatInputCommandInteraction> => ({
  options: {
    getUser: jest.fn((key: string, required?: boolean) => options[key] || null),
    getString: jest.fn((key: string, required?: boolean) => options[key] || null),
    getBoolean: jest.fn((key: string) => options[key] || null),
    getFocused: jest.fn(() => options.focused || ''),
  } as any,
  reply: jest.fn().mockResolvedValue(undefined),
  respond: jest.fn().mockResolvedValue(undefined),
  client: {
    users: {
      fetch: jest.fn().mockResolvedValue(createMockUser('123456789012345678', 'testuser#1234'))
    }
  } as any,
});

const createMockClient = (database: DatabaseManager): Partial<BotClient> => ({
  database,
  permissions: {
    verifyAdmin: jest.fn().mockResolvedValue(true),
    logAdminAction: jest.fn(),
  } as any,
  logger: new Logger('error'),
});

describe('User Linking System', () => {
  let database: DatabaseManager;
  let logger: Logger;
  let linkCommand: AdminLinkUserCommand;

  beforeEach(() => {
    logger = new Logger('error');
    database = new DatabaseManager({ path: ':memory:' }, logger);
    linkCommand = new AdminLinkUserCommand();
  });

  afterEach(() => {
    database.close();
  });

  describe('Property 8: User-Nation Linking', () => {
    // Feature: model-us-discord-bot, Property 8: For any valid Discord user ID and nation name, the link command should create or update the association correctly
    
    test('user-nation linking works correctly for any valid inputs', () => {
      fc.assert(fc.property(
        fc.record({
          userId: fc.string({ minLength: 17, maxLength: 19 }).map(s => s.replace(/\D/g, '').padEnd(18, '0')),
          userTag: fc.string({ minLength: 5, maxLength: 32 }),
          nationName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          gdp: fc.float({ min: 0, max: 1000000 }),
          stability: fc.float({ min: 0, max: 100 }),
          population: fc.integer({ min: 0, max: 1000000000 }),
          taxRate: fc.float({ min: 0, max: 100 })
        }),
        async (data) => {
          // Create the nation first
          database.createOrUpdateNation({
            name: data.nationName,
            gdp: data.gdp,
            stability: data.stability,
            population: data.population,
            taxRate: data.taxRate
          });

          const mockUser = createMockUser(data.userId, data.userTag) as User;
          const mockClient = createMockClient(database) as BotClient;
          const mockInteraction = createMockInteraction({
            user: mockUser,
            nation: data.nationName,
            force: false
          }) as ChatInputCommandInteraction;

          await linkCommand.execute(mockInteraction, mockClient);

          // Verify the link was created correctly
          const userLink = database.getUserLink(data.userId);
          expect(userLink).not.toBeNull();
          expect(userLink!.discordId).toBe(data.userId);
          expect(userLink!.nationName).toBe(data.nationName);

          // Verify reverse lookup works
          const nationLink = database.getUserByNation(data.nationName);
          expect(nationLink).not.toBeNull();
          expect(nationLink!.discordId).toBe(data.userId);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 9: Link Uniqueness', () => {
    // Feature: model-us-discord-bot, Property 9: For any nation, only one user should be linked to it at a time unless explicitly overridden
    
    test('nation can only be linked to one user without force override', () => {
      fc.assert(fc.property(
        fc.record({
          firstUserId: fc.string({ minLength: 17, maxLength: 19 }).map(s => s.replace(/\D/g, '').padEnd(18, '0')),
          secondUserId: fc.string({ minLength: 17, maxLength: 19 }).map(s => s.replace(/\D/g, '').padEnd(18, '1')),
          nationName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          userTag1: fc.string({ minLength: 5, maxLength: 32 }),
          userTag2: fc.string({ minLength: 5, maxLength: 32 })
        }).filter(data => data.firstUserId !== data.secondUserId),
        async (data) => {
          // Create the nation
          database.createOrUpdateNation({
            name: data.nationName,
            gdp: 1000,
            stability: 50,
            population: 1000000,
            taxRate: 20
          });

          const mockClient = createMockClient(database) as BotClient;

          // Link first user
          const firstUser = createMockUser(data.firstUserId, data.userTag1) as User;
          const firstInteraction = createMockInteraction({
            user: firstUser,
            nation: data.nationName,
            force: false
          }) as ChatInputCommandInteraction;

          await linkCommand.execute(firstInteraction, mockClient);

          // Try to link second user without force
          const secondUser = createMockUser(data.secondUserId, data.userTag2) as User;
          const secondInteraction = createMockInteraction({
            user: secondUser,
            nation: data.nationName,
            force: false
          }) as ChatInputCommandInteraction;

          await linkCommand.execute(secondInteraction, mockClient);

          // Verify first user is still linked
          const nationLink = database.getUserByNation(data.nationName);
          expect(nationLink).not.toBeNull();
          expect(nationLink!.discordId).toBe(data.firstUserId);

          // Verify second interaction was rejected
          expect(secondInteraction.reply).toHaveBeenCalledWith({
            content: expect.stringContaining('already linked'),
            ephemeral: true
          });
        }
      ), { numRuns: 100 });
    });

    test('force override allows nation reassignment', () => {
      fc.assert(fc.property(
        fc.record({
          firstUserId: fc.string({ minLength: 17, maxLength: 19 }).map(s => s.replace(/\D/g, '').padEnd(18, '0')),
          secondUserId: fc.string({ minLength: 17, maxLength: 19 }).map(s => s.replace(/\D/g, '').padEnd(18, '1')),
          nationName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          userTag1: fc.string({ minLength: 5, maxLength: 32 }),
          userTag2: fc.string({ minLength: 5, maxLength: 32 })
        }).filter(data => data.firstUserId !== data.secondUserId),
        async (data) => {
          // Create the nation
          database.createOrUpdateNation({
            name: data.nationName,
            gdp: 1000,
            stability: 50,
            population: 1000000,
            taxRate: 20
          });

          const mockClient = createMockClient(database) as BotClient;

          // Link first user
          const firstUser = createMockUser(data.firstUserId, data.userTag1) as User;
          const firstInteraction = createMockInteraction({
            user: firstUser,
            nation: data.nationName,
            force: false
          }) as ChatInputCommandInteraction;

          await linkCommand.execute(firstInteraction, mockClient);

          // Link second user with force
          const secondUser = createMockUser(data.secondUserId, data.userTag2) as User;
          const secondInteraction = createMockInteraction({
            user: secondUser,
            nation: data.nationName,
            force: true
          }) as ChatInputCommandInteraction;

          await linkCommand.execute(secondInteraction, mockClient);

          // Verify second user is now linked
          const nationLink = database.getUserByNation(data.nationName);
          expect(nationLink).not.toBeNull();
          expect(nationLink!.discordId).toBe(data.secondUserId);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Unit Tests for User Linking', () => {
    test('should reject linking to non-existent nation', async () => {
      const mockUser = createMockUser('123456789012345678', 'testuser#1234') as User;
      const mockClient = createMockClient(database) as BotClient;
      const mockInteraction = createMockInteraction({
        user: mockUser,
        nation: 'NonExistentNation',
        force: false
      }) as ChatInputCommandInteraction;

      await linkCommand.execute(mockInteraction, mockClient);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('does not exist'),
        ephemeral: true
      });
    });

    test('should update existing user link to new nation', async () => {
      // Create two nations
      database.createOrUpdateNation({ name: 'Nation1', gdp: 1000, stability: 50, population: 1000000, taxRate: 20 });
      database.createOrUpdateNation({ name: 'Nation2', gdp: 2000, stability: 60, population: 2000000, taxRate: 25 });

      const mockUser = createMockUser('123456789012345678', 'testuser#1234') as User;
      const mockClient = createMockClient(database) as BotClient;

      // Link to first nation
      const firstInteraction = createMockInteraction({
        user: mockUser,
        nation: 'Nation1',
        force: false
      }) as ChatInputCommandInteraction;

      await linkCommand.execute(firstInteraction, mockClient);

      // Link to second nation
      const secondInteraction = createMockInteraction({
        user: mockUser,
        nation: 'Nation2',
        force: false
      }) as ChatInputCommandInteraction;

      await linkCommand.execute(secondInteraction, mockClient);

      // Verify user is now linked to second nation
      const userLink = database.getUserLink('123456789012345678');
      expect(userLink).not.toBeNull();
      expect(userLink!.nationName).toBe('Nation2');

      // Verify first nation is no longer linked to this user
      const nation1Link = database.getUserByNation('Nation1');
      expect(nation1Link).toBeNull();
    });

    test('autocomplete should show link status', async () => {
      // Create nations, one linked and one not
      database.createOrUpdateNation({ name: 'LinkedNation', gdp: 1000, stability: 50, population: 1000000, taxRate: 20 });
      database.createOrUpdateNation({ name: 'AvailableNation', gdp: 2000, stability: 60, population: 2000000, taxRate: 25 });
      
      // Link one nation
      database.createOrUpdateUserLink('123456789012345678', 'LinkedNation');

      const mockClient = createMockClient(database) as BotClient;
      const mockInteraction = createMockInteraction({
        focused: 'nation'
      }) as AutocompleteInteraction;

      await linkCommand.autocomplete(mockInteraction, mockClient);

      expect(mockInteraction.respond).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ 
            name: expect.stringContaining('🔗 Linked'),
            value: 'LinkedNation'
          }),
          expect.objectContaining({ 
            name: expect.stringContaining('🔓 Available'),
            value: 'AvailableNation'
          })
        ])
      );
    });
  });
});}
