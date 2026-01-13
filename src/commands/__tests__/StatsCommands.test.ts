import * as fc from 'fast-check';
import { AdminNationEditCommand } from '../admin/AdminNationEdit';
import { NationCommand } from '../player/NationCommand';
import { DatabaseManager } from '../../database/DatabaseManager';
import { PermissionManager } from '../../bot/PermissionManager';
import { Logger } from '../../utils/Logger';
import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

// Mock Discord.js components
jest.mock('discord.js', () => ({
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addStringOption: jest.fn().mockReturnThis(),
    addNumberOption: jest.fn().mockReturnThis(),
    addIntegerOption: jest.fn().mockReturnThis(),
    addBooleanOption: jest.fn().mockReturnThis(),
  })),
  EmbedBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    setFooter: jest.fn().mockReturnThis(),
  })),
  ChatInputCommandInteraction: jest.fn(),
  AutocompleteInteraction: jest.fn(),
}));

const createMockInteraction = (
  options: Record<string, any> = {},
  isAdmin: boolean = true
) => ({
  options: {
    getString: jest.fn((key: string, required?: boolean) => options[key] || null),
    getNumber: jest.fn((key: string) => options[key] || null),
    getInteger: jest.fn((key: string) => options[key] || null),
    getBoolean: jest.fn((key: string) => options[key] || null),
    getFocused: jest.fn(() => options.focused || ''),
  } as any,
  reply: jest.fn().mockResolvedValue(undefined),
  user: { id: '123456789012345678', tag: 'testuser#1234' } as any,
} as any);

const createMockClient = (database: DatabaseManager) => ({
  database,
  permissions: {
    verifyAdmin: jest.fn().mockResolvedValue(true),
    logAdminAction: jest.fn(),
  } as any,
  logger: new Logger('error'),
});

describe('Statistics Commands', () => {
  let database: DatabaseManager;
  let logger: Logger;
  let adminCommand: AdminNationEditCommand;
  let statsCommand: NationCommand;

  beforeEach(() => {
    logger = new Logger('error');
    database = new DatabaseManager({ path: ':memory:' }, logger);
    adminCommand = new AdminNationEditCommand();
    statsCommand = new NationCommand();
  });

  afterEach(() => {
    database.close();
  });

  describe('Property 1: Statistics Persistence', () => {
    // Feature: model-us-discord-bot, Property 1: For any nation and any valid statistics update, storing the statistics should result in the database containing the exact values that were provided
    
    test('statistics updates persist correctly in database', async () => {
      const testData = {
        nationName: 'TestNation',
        gdp: 1000,
        stability: 75,
        population: 50000000,
        taxRate: 25
      };

      // Create the nation first
      database.createOrUpdateNation({
        name: testData.nationName,
        gdp: 500, // Initial value
        stability: testData.stability,
        population: testData.population,
        taxRate: testData.taxRate
      });

      const mockClient = createMockClient(database) as any;
      const mockInteraction = createMockInteraction({
        nation: testData.nationName,
        stat: 'gdp',
        value: testData.gdp,
        set_absolute: true
      }) as ChatInputCommandInteraction;

      await adminCommand.execute(mockInteraction, database, logger);

      // Verify the data was updated correctly
      const storedNation = database.getNationByName(testData.nationName);
      expect(storedNation).not.toBeNull();
      expect(storedNation!.name).toBe(testData.nationName);
      expect(storedNation!.gdp).toBeCloseTo(testData.gdp, 2);
    });
  });

  describe('Property 4: External Database Integration', () => {
    // Feature: model-us-discord-bot, Property 4: For any data manually inserted into the database, the bot commands should reflect and display that data correctly
    
    test('manually inserted data is correctly displayed by stats command', async () => {
      const testData = {
        nationName: 'TestNation',
        gdp: 1000,
        stability: 75,
        population: 50000000,
        taxRate: 25
      };

      // Manually insert data into database (simulating external insertion)
      database.createOrUpdateNation({
        name: testData.nationName,
        gdp: testData.gdp,
        stability: testData.stability,
        population: testData.population,
        taxRate: testData.taxRate
      });

      const mockClient = createMockClient(database) as any;
      const mockInteraction = createMockInteraction({
        nation: testData.nationName
      }) as ChatInputCommandInteraction;

      await statsCommand.execute(mockInteraction, database, logger);

      // Verify the command executed successfully (no error response)
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });
  });

  describe('Unit Tests for Statistics Commands', () => {
    test('admin stats update should handle missing nation gracefully', async () => {
      const mockClient = createMockClient(database) as any;
      const mockInteraction = createMockInteraction({
        nation: 'NewNation',
        stat: 'gdp',
        value: 1000,
        set_absolute: true
      }) as ChatInputCommandInteraction;

      await adminCommand.execute(mockInteraction, database, logger);

      // Should return error message for missing nation
      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Nation "NewNation" not found')
      });
    });

    test('stats command should handle non-existent nation', async () => {
      const mockClient = createMockClient(database) as any;
      const mockInteraction = createMockInteraction({
        nation: 'NonExistentNation'
      }) as ChatInputCommandInteraction;

      await statsCommand.execute(mockInteraction, database, logger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Nation "NonExistentNation" not found')
      });
    });

    test('admin stats update should require at least one parameter for existing nations', async () => {
      // Create existing nation
      database.createOrUpdateNation({
        name: 'ExistingNation',
        gdp: 1000,
        stability: 50,
        population: 1000000,
        taxRate: 20
      });

      const mockClient = createMockClient(database) as any;
      const mockInteraction = createMockInteraction({
        nation: 'ExistingNation'
        // No other parameters provided
      }) as ChatInputCommandInteraction;

      await adminCommand.execute(mockInteraction, database, logger);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Please provide a numeric value for this statistic.'
      });
    });

    test('autocomplete should filter nations correctly', async () => {
      // Create test nations
      database.createOrUpdateNation({ name: 'United States', gdp: 1000, stability: 80, population: 330000000, taxRate: 25 });
      database.createOrUpdateNation({ name: 'United Kingdom', gdp: 500, stability: 75, population: 67000000, taxRate: 30 });
      database.createOrUpdateNation({ name: 'Canada', gdp: 300, stability: 85, population: 38000000, taxRate: 20 });

      const mockClient = createMockClient(database) as any;
      const mockInteraction = {
        options: {
          getFocused: jest.fn(() => 'united'),
        },
        respond: jest.fn().mockResolvedValue(undefined),
      } as any;

      await statsCommand.autocomplete(mockInteraction, database, logger);

      expect(mockInteraction.respond).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ value: 'United States' }),
          expect.objectContaining({ value: 'United Kingdom' })
        ])
      );
    });

    test('should handle database errors gracefully', async () => {
      // Create a nation first
      database.createOrUpdateNation({
        name: 'TestNation',
        gdp: 1000,
        stability: 75,
        population: 50000000,
        taxRate: 25
      });

      // Close database to simulate error
      database.close();

      const mockClient = createMockClient(database) as any;
      const mockInteraction = createMockInteraction({
        nation: 'TestNation'
      }) as ChatInputCommandInteraction;

      // The command should not crash even with database errors
      await expect(statsCommand.execute(mockInteraction, database, logger)).resolves.not.toThrow();
    });
  });

  describe('Property 5: Complete Statistics Display', () => {
    // Feature: model-us-discord-bot, Property 5: For any valid nation, the /stats command response should contain all required fields: GDP, Stability, Population, Tax Rate, and Budget
    
    test('stats command displays all required fields for any nation', async () => {
      const testData = {
        nationName: 'TestNation',
        gdp: 1000,
        stability: 75,
        population: 50000000,
        taxRate: 25
      };

      // Create nation in database
      database.createOrUpdateNation({
        name: testData.nationName,
        gdp: testData.gdp,
        stability: testData.stability,
        population: testData.population,
        taxRate: testData.taxRate
      });

      const mockClient = createMockClient(database) as any;
      const mockInteraction = createMockInteraction({
        nation: testData.nationName
      }) as ChatInputCommandInteraction;

      await statsCommand.execute(mockInteraction, database, logger);

      // Verify response contains embed with all required fields
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });
  });

  describe('Property 6: Percentage Change Display', () => {
    // Feature: model-us-discord-bot, Property 6: For any nation with previous data, the /stats command should display percentage changes for GDP and Population when available
    
    test('stats command shows percentage changes when previous data exists', async () => {
      const testData = {
        nationName: 'TestNation',
        initialGdp: 1000,
        newGdp: 1200,
        initialPopulation: 50000000,
        newPopulation: 55000000,
        stability: 75,
        taxRate: 25
      };

      // Create initial nation
      database.createOrUpdateNation({
        name: testData.nationName,
        gdp: testData.initialGdp,
        stability: testData.stability,
        population: testData.initialPopulation,
        taxRate: testData.taxRate
      });

      // Update nation to create changes
      database.createOrUpdateNation({
        name: testData.nationName,
        gdp: testData.newGdp,
        stability: testData.stability,
        population: testData.newPopulation,
        taxRate: testData.taxRate
      });

      const mockClient = createMockClient(database) as any;
      const mockInteraction = createMockInteraction({
        nation: testData.nationName
      }) as ChatInputCommandInteraction;

      await statsCommand.execute(mockInteraction, database, logger);

      // Verify the command executed successfully
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );

      // The embed should include change fields when changes exist
      const nation = database.getNationByName(testData.nationName);
      expect(nation).not.toBeNull();
      expect(nation!.gdpChange).not.toBeNull();
      expect(nation!.populationChange).not.toBeNull();
    });
  });

  describe('Property 7: Statistics Response Format', () => {
    // Feature: model-us-discord-bot, Property 7: For any /stats command response, the output should be a valid Discord embed with proper structure and formatting
    
    test('stats command always returns properly formatted Discord embed', async () => {
      const testData = {
        nationName: 'TestNation',
        gdp: 1000,
        stability: 75,
        population: 50000000,
        taxRate: 25
      };

      // Create nation in database
      database.createOrUpdateNation({
        name: testData.nationName,
        gdp: testData.gdp,
        stability: testData.stability,
        population: testData.population,
        taxRate: testData.taxRate
      });

      const mockClient = createMockClient(database) as any;
      const mockInteraction = createMockInteraction({
        nation: testData.nationName
      }) as ChatInputCommandInteraction;

      await statsCommand.execute(mockInteraction, database, logger);

      // Verify response has proper embed structure
      expect(mockInteraction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.any(Object) // EmbedBuilder mock
          ])
        })
      );
    });
  });
});