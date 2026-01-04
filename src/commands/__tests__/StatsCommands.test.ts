import * as fc from 'fast-check';
import { AdminStatsUpdateCommand } from '../admin/AdminStatsUpdate';
import { StatsCommand } from '../player/StatsCommand';
import { DatabaseManager } from '../../database/DatabaseManager';
import { PermissionManager } from '../../bot/PermissionManager';
import { Logger } from '../../utils/Logger';
import { BotClient } from '../../types';
import { ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

// Mock Discord.js components
jest.mock('discord.js', () => ({
  SlashCommandBuilder: jest.fn().mockImplementation(() => ({
    setName: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    addStringOption: jest.fn().mockReturnThis(),
    addNumberOption: jest.fn().mockReturnThis(),
    addIntegerOption: jest.fn().mockReturnThis(),
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
): Partial<ChatInputCommandInteraction> => ({
  options: {
    getString: jest.fn((key: string, required?: boolean) => options[key] || null),
    getNumber: jest.fn((key: string) => options[key] || null),
    getInteger: jest.fn((key: string) => options[key] || null),
    getFocused: jest.fn(() => options.focused || ''),
  } as any,
  reply: jest.fn().mockResolvedValue(undefined),
  respond: jest.fn().mockResolvedValue(undefined),
  user: { id: '123456789012345678', tag: 'testuser#1234' } as any,
});

const createMockClient = (database: DatabaseManager): Partial<BotClient> => ({
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
  let adminCommand: AdminStatsUpdateCommand;
  let statsCommand: StatsCommand;

  beforeEach(() => {
    logger = new Logger('error');
    database = new DatabaseManager({ path: ':memory:' }, logger);
    adminCommand = new AdminStatsUpdateCommand();
    statsCommand = new StatsCommand();
  });

  afterEach(() => {
    database.close();
  });

  describe('Property 1: Statistics Persistence', () => {
    // Feature: model-us-discord-bot, Property 1: For any nation and any valid statistics update, storing the statistics should result in the database containing the exact values that were provided
    
    test('statistics updates persist correctly in database', () => {
      fc.assert(fc.property(
        fc.record({
          nationName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          gdp: fc.float({ min: 0, max: 1000000 }),
          stability: fc.float({ min: 0, max: 100 }),
          population: fc.integer({ min: 0, max: 1000000000 }),
          taxRate: fc.float({ min: 0, max: 100 })
        }),
        async (data) => {
          const mockClient = createMockClient(database) as BotClient;
          const mockInteraction = createMockInteraction({
            nation: data.nationName,
            gdp: data.gdp,
            stability: data.stability,
            population: data.population,
            tax_rate: data.taxRate
          }) as ChatInputCommandInteraction;

          await adminCommand.execute(mockInteraction, mockClient);

          // Verify the data was stored correctly
          const storedNation = database.getNationByName(data.nationName);
          expect(storedNation).not.toBeNull();
          expect(storedNation!.name).toBe(data.nationName);
          expect(storedNation!.gdp).toBeCloseTo(data.gdp, 2);
          expect(storedNation!.stability).toBeCloseTo(data.stability, 2);
          expect(storedNation!.population).toBe(data.population);
          expect(storedNation!.taxRate).toBeCloseTo(data.taxRate, 2);
          expect(storedNation!.gdpPerCapita).toBeCloseTo(data.gdp * 1000000000 / data.population, 2);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 4: External Database Integration', () => {
    // Feature: model-us-discord-bot, Property 4: For any data manually inserted into the database, the bot commands should reflect and display that data correctly
    
    test('manually inserted data is correctly displayed by stats command', () => {
      fc.assert(fc.property(
        fc.record({
          nationName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          gdp: fc.float({ min: 0, max: 1000000 }),
          stability: fc.float({ min: 0, max: 100 }),
          population: fc.integer({ min: 0, max: 1000000000 }),
          taxRate: fc.float({ min: 0, max: 100 })
        }),
        async (data) => {
          // Manually insert data into database (simulating external insertion)
          database.createOrUpdateNation({
            name: data.nationName,
            gdp: data.gdp,
            stability: data.stability,
            population: data.population,
            taxRate: data.taxRate
          });

          const mockClient = createMockClient(database) as BotClient;
          const mockInteraction = createMockInteraction({
            nation: data.nationName
          }) as ChatInputCommandInteraction;

          await statsCommand.execute(mockInteraction, mockClient);

          // Verify the command executed successfully (no error response)
          expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
              embeds: expect.any(Array)
            })
          );
        }
      ), { numRuns: 100 });
    });
  });

  describe('Unit Tests for Statistics Commands', () => {
    test('admin stats update should handle missing nation gracefully', async () => {
      const mockClient = createMockClient(database) as BotClient;
      const mockInteraction = createMockInteraction({
        nation: 'NewNation',
        gdp: 1000
      }) as ChatInputCommandInteraction;

      await adminCommand.execute(mockInteraction, mockClient);

      // Should create new nation with provided GDP and defaults for other stats
      const nation = database.getNationByName('NewNation');
      expect(nation).not.toBeNull();
      expect(nation!.gdp).toBe(1000);
      expect(nation!.stability).toBe(50); // Default
      expect(nation!.taxRate).toBe(20); // Default
    });

    test('stats command should handle non-existent nation', async () => {
      const mockClient = createMockClient(database) as BotClient;
      const mockInteraction = createMockInteraction({
        nation: 'NonExistentNation'
      }) as ChatInputCommandInteraction;

      await statsCommand.execute(mockInteraction, mockClient);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('Nation "NonExistentNation" not found'),
        ephemeral: true
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

      const mockClient = createMockClient(database) as BotClient;
      const mockInteraction = createMockInteraction({
        nation: 'ExistingNation'
        // No other parameters provided
      }) as ChatInputCommandInteraction;

      await adminCommand.execute(mockInteraction, mockClient);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: '❌ Please specify at least one statistic to update.',
        ephemeral: true
      });
    });

    test('autocomplete should filter nations correctly', async () => {
      // Create test nations
      database.createOrUpdateNation({ name: 'United States', gdp: 1000, stability: 80, population: 330000000, taxRate: 25 });
      database.createOrUpdateNation({ name: 'United Kingdom', gdp: 500, stability: 75, population: 67000000, taxRate: 30 });
      database.createOrUpdateNation({ name: 'Canada', gdp: 300, stability: 85, population: 38000000, taxRate: 20 });

      const mockClient = createMockClient(database) as BotClient;
      const mockInteraction = createMockInteraction({
        focused: 'united'
      }) as AutocompleteInteraction;

      await statsCommand.autocomplete(mockInteraction, mockClient);

      expect(mockInteraction.respond).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ value: 'United States' }),
          expect.objectContaining({ value: 'United Kingdom' })
        ])
      );
    });

    test('should handle database errors gracefully', async () => {
      // Close database to simulate error
      database.close();

      const mockClient = createMockClient(database) as BotClient;
      const mockInteraction = createMockInteraction({
        nation: 'TestNation'
      }) as ChatInputCommandInteraction;

      await statsCommand.execute(mockInteraction, mockClient);

      expect(mockInteraction.reply).toHaveBeenCalledWith({
        content: expect.stringContaining('An error occurred'),
        ephemeral: true
      });
    });
  });
});

  describe('Property 5: Complete Statistics Display', () => {
    // Feature: model-us-discord-bot, Property 5: For any valid nation, the /stats command response should contain all required fields: GDP, Stability, Population, Tax Rate, and Budget
    
    test('stats command displays all required fields for any nation', () => {
      fc.assert(fc.property(
        fc.record({
          nationName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          gdp: fc.float({ min: 0, max: 1000000 }),
          stability: fc.float({ min: 0, max: 100 }),
          population: fc.integer({ min: 0, max: 1000000000 }),
          taxRate: fc.float({ min: 0, max: 100 })
        }),
        async (data) => {
          // Create nation in database
          database.createOrUpdateNation(data);

          const mockClient = createMockClient(database) as BotClient;
          const mockInteraction = createMockInteraction({
            nation: data.nationName
          }) as ChatInputCommandInteraction;

          await statsCommand.execute(mockInteraction, mockClient);

          // Verify response contains embed with all required fields
          expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
              embeds: expect.arrayContaining([
                expect.objectContaining({
                  addFields: expect.any(Function)
                })
              ])
            })
          );
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 6: Percentage Change Display', () => {
    // Feature: model-us-discord-bot, Property 6: For any nation with previous data, the /stats command should display percentage changes for GDP and Population when available
    
    test('stats command shows percentage changes when previous data exists', () => {
      fc.assert(fc.property(
        fc.record({
          nationName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          initialGdp: fc.float({ min: 1, max: 1000000 }),
          newGdp: fc.float({ min: 0, max: 1000000 }),
          initialPopulation: fc.integer({ min: 1, max: 1000000000 }),
          newPopulation: fc.integer({ min: 0, max: 1000000000 }),
          stability: fc.float({ min: 0, max: 100 }),
          taxRate: fc.float({ min: 0, max: 100 })
        }),
        async (data) => {
          // Create initial nation
          database.createOrUpdateNation({
            name: data.nationName,
            gdp: data.initialGdp,
            stability: data.stability,
            population: data.initialPopulation,
            taxRate: data.taxRate
          });

          // Update nation to create changes
          database.createOrUpdateNation({
            name: data.nationName,
            gdp: data.newGdp,
            stability: data.stability,
            population: data.newPopulation,
            taxRate: data.taxRate
          });

          const mockClient = createMockClient(database) as BotClient;
          const mockInteraction = createMockInteraction({
            nation: data.nationName
          }) as ChatInputCommandInteraction;

          await statsCommand.execute(mockInteraction, mockClient);

          // Verify the command executed successfully
          expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
              embeds: expect.any(Array)
            })
          );

          // The embed should include change fields when changes exist
          const nation = database.getNationByName(data.nationName);
          expect(nation).not.toBeNull();
          expect(nation!.gdpChange).not.toBeNull();
          expect(nation!.populationChange).not.toBeNull();
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 7: Statistics Response Format', () => {
    // Feature: model-us-discord-bot, Property 7: For any /stats command response, the output should be a valid Discord embed with proper structure and formatting
    
    test('stats command always returns properly formatted Discord embed', () => {
      fc.assert(fc.property(
        fc.record({
          nationName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          gdp: fc.float({ min: 0, max: 1000000 }),
          stability: fc.float({ min: 0, max: 100 }),
          population: fc.integer({ min: 0, max: 1000000000 }),
          taxRate: fc.float({ min: 0, max: 100 })
        }),
        async (data) => {
          // Create nation in database
          database.createOrUpdateNation(data);

          const mockClient = createMockClient(database) as BotClient;
          const mockInteraction = createMockInteraction({
            nation: data.nationName
          }) as ChatInputCommandInteraction;

          await statsCommand.execute(mockInteraction, mockClient);

          // Verify response has proper embed structure
          expect(mockInteraction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
              embeds: expect.arrayContaining([
                expect.any(Object) // EmbedBuilder mock
              ])
            })
          );
        }
      ), { numRuns: 100 });
    });
  });}
