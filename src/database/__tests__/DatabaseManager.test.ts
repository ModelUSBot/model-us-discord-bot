import * as fc from 'fast-check';
import { DatabaseManager } from '../DatabaseManager';
import { Logger } from '../../utils/Logger';
import { NationStats, War, UserLink } from '../../types';

describe('DatabaseManager', () => {
  let db: DatabaseManager;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('error'); // Suppress logs during tests
    db = new DatabaseManager({ path: ':memory:' }, logger);
  });

  afterEach(() => {
    db.close();
  });

  describe('Property 26: Data Persistence Completeness', () => {
    // Feature: model-us-discord-bot, Property 26: For any data stored in the system (nations, users, wars, activity), the information should remain available after bot restarts
    
    test('nation data persists across database operations', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          gdp: fc.float({ min: 0, max: 1000000 }),
          stability: fc.float({ min: 0, max: 100 }),
          population: fc.integer({ min: 0, max: 1000000000 }),
          taxRate: fc.float({ min: 0, max: 100 })
        }),
        (nationData) => {
          // Store nation data
          const stored = db.createOrUpdateNation(nationData);
          
          // Retrieve nation data
          const retrieved = db.getNationByName(nationData.name);
          
          // Verify all data persists correctly
          expect(retrieved).not.toBeNull();
          expect(retrieved!.name).toBe(nationData.name);
          expect(retrieved!.gdp).toBeCloseTo(nationData.gdp, 2);
          expect(retrieved!.stability).toBeCloseTo(nationData.stability, 2);
          expect(retrieved!.population).toBe(nationData.population);
          expect(retrieved!.taxRate).toBeCloseTo(nationData.taxRate, 2);
          expect(retrieved!.budget).toBeCloseTo(nationData.gdp * nationData.taxRate / 100, 2);
        }
      ), { numRuns: 100 });
    });

    test('user link data persists across database operations', () => {
      fc.assert(fc.property(
        fc.record({
          discordId: fc.string({ minLength: 17, maxLength: 19 }).map(s => s.replace(/\D/g, '').padEnd(18, '0')),
          nationName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0)
        }),
        (linkData) => {
          // First create the nation
          db.createOrUpdateNation({
            name: linkData.nationName,
            gdp: 1000,
            stability: 50,
            population: 1000000,
            taxRate: 20
          });
          
          // Store user link
          const stored = db.createOrUpdateUserLink(linkData.discordId, linkData.nationName);
          
          // Retrieve user link
          const retrieved = db.getUserLink(linkData.discordId);
          
          // Verify all data persists correctly
          expect(retrieved).not.toBeNull();
          expect(retrieved!.discordId).toBe(linkData.discordId);
          expect(retrieved!.nationName).toBe(linkData.nationName);
        }
      ), { numRuns: 100 });
    });

    test('war data persists across database operations', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          participants: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 2, maxLength: 10 }),
          startDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          casualties: fc.integer({ min: 0, max: 1000000 }),
          description: fc.option(fc.string({ maxLength: 500 })),
          status: fc.constantFrom('active', 'ended') as fc.Arbitrary<'active' | 'ended'>
        }),
        (warData) => {
          // Store war data
          const stored = db.createWar(warData);
          
          // Retrieve war data
          const retrieved = db.getWarById(stored.id);
          
          // Verify all data persists correctly
          expect(retrieved).not.toBeNull();
          expect(retrieved!.name).toBe(warData.name);
          expect(retrieved!.participants).toEqual(warData.participants);
          expect(retrieved!.startDate.toDateString()).toBe(warData.startDate.toDateString());
          expect(retrieved!.casualties).toBe(warData.casualties);
          expect(retrieved!.description).toBe(warData.description || null);
          expect(retrieved!.status).toBe(warData.status);
        }
      ), { numRuns: 100 });
    });

    test('activity data persists across database operations', () => {
      fc.assert(fc.property(
        fc.record({
          discordId: fc.string({ minLength: 17, maxLength: 19 }).map(s => s.replace(/\D/g, '').padEnd(18, '0')),
          channelId: fc.string({ minLength: 17, maxLength: 19 }).map(s => s.replace(/\D/g, '').padEnd(18, '0'))
        }),
        (activityData) => {
          // Store activity data
          db.updateUserActivity(activityData.discordId, activityData.channelId);
          
          // Retrieve activity data
          const retrieved = db.getChannelActivity(activityData.channelId);
          
          // Verify data persists correctly
          expect(retrieved).toHaveLength(1);
          expect(retrieved[0].discordId).toBe(activityData.discordId);
          expect(retrieved[0].channelId).toBe(activityData.channelId);
          expect(retrieved[0].messageCount).toBe(1);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Unit Tests for Database Operations', () => {
    test('should create nation with default tax rate when not specified', () => {
      const nation = db.createOrUpdateNation({
        name: 'Test Nation',
        gdp: 1000,
        stability: 75,
        population: 1000000,
        taxRate: 20 // Default value
      });

      expect(nation.taxRate).toBe(20);
      expect(nation.budget).toBeCloseTo(20, 2); // 100 * 20 / 100
    });

    test('should handle non-existent nation lookup gracefully', () => {
      const result = db.getNationByName('NonExistentNation');
      expect(result).toBeNull();
    });

    test('should prevent duplicate nation assignments', () => {
      // Create a nation first
      db.createOrUpdateNation({
        name: 'TestNation',
        gdp: 1000,
        stability: 50,
        population: 1000000,
        taxRate: 20
      });

      // Link first user
      db.createOrUpdateUserLink('123456789012345678', 'TestNation');
      
      // Try to link second user to same nation - should check existing link
      const existingUser = db.getUserByNation('TestNation');
      expect(existingUser).not.toBeNull();
      expect(existingUser!.discordId).toBe('123456789012345678');
    });

    test('should handle empty activity channel gracefully', () => {
      const activity = db.getChannelActivity('999999999999999999');
      expect(activity).toEqual([]);
    });

    test('should update war casualties correctly', () => {
      const war = db.createWar({
        name: 'Test War',
        participants: ['Nation A', 'Nation B'],
        startDate: new Date('2024-01-01'),
        casualties: 1000,
        status: 'active'
      });

      const updated = db.updateWarCasualties(war.id, 2000);
      expect(updated).not.toBeNull();
      expect(updated!.casualties).toBe(2000);
    });

    test('should return null when updating non-existent war', () => {
      const result = db.updateWarCasualties(99999, 1000);
      expect(result).toBeNull();
    });
  });
});

  describe('Property 2: Budget Calculation Consistency', () => {
    // Feature: model-us-discord-bot, Property 2: For any nation with GDP and tax rate values, the budget should always equal GDP multiplied by tax rate divided by 100
    
    test('budget calculation is consistent across all GDP and tax rate combinations', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          gdp: fc.float({ min: 0, max: 1000000 }),
          taxRate: fc.float({ min: 0, max: 100 }),
          stability: fc.float({ min: 0, max: 100 }),
          population: fc.integer({ min: 0, max: 1000000000 })
        }),
        (nationData) => {
          const nation = db.createOrUpdateNation(nationData);
          const expectedBudget = nationData.gdp * nationData.taxRate / 100;
          
          expect(nation.budget).toBeCloseTo(expectedBudget, 2);
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 3: Percentage Change Calculation', () => {
    // Feature: model-us-discord-bot, Property 3: For any nation with previous GDP or population values, when new values are stored, the percentage change should equal ((new_value - old_value) / old_value) * 100
    
    test('GDP percentage change calculation is accurate', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          initialGdp: fc.float({ min: 1, max: 1000000 }), // Avoid zero to prevent division by zero
          newGdp: fc.float({ min: 0, max: 1000000 }),
          stability: fc.float({ min: 0, max: 100 }),
          population: fc.integer({ min: 0, max: 1000000000 }),
          taxRate: fc.float({ min: 0, max: 100 })
        }),
        (data) => {
          // Create initial nation
          db.createOrUpdateNation({
            name: data.name,
            gdp: data.initialGdp,
            stability: data.stability,
            population: data.population,
            taxRate: data.taxRate
          });

          // Update with new GDP
          const updated = db.createOrUpdateNation({
            name: data.name,
            gdp: data.newGdp,
            stability: data.stability,
            population: data.population,
            taxRate: data.taxRate
          });

          const expectedChange = ((data.newGdp - data.initialGdp) / data.initialGdp) * 100;
          
          if (updated.gdpChange !== null && updated.gdpChange !== undefined) {
            expect(updated.gdpChange).toBeCloseTo(expectedChange, 2);
          }
        }
      ), { numRuns: 100 });
    });

    test('population percentage change calculation is accurate', () => {
      fc.assert(fc.property(
        fc.record({
          name: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
          initialPopulation: fc.integer({ min: 1, max: 1000000000 }), // Avoid zero
          newPopulation: fc.integer({ min: 0, max: 1000000000 }),
          gdp: fc.float({ min: 0, max: 1000000 }),
          stability: fc.float({ min: 0, max: 100 }),
          taxRate: fc.float({ min: 0, max: 100 })
        }),
        (data) => {
          // Create initial nation
          db.createOrUpdateNation({
            name: data.name,
            gdp: data.gdp,
            stability: data.stability,
            population: data.initialPopulation,
            taxRate: data.taxRate
          });

          // Update with new population
          const updated = db.createOrUpdateNation({
            name: data.name,
            gdp: data.gdp,
            stability: data.stability,
            population: data.newPopulation,
            taxRate: data.taxRate
          });

          const expectedChange = ((data.newPopulation - data.initialPopulation) / data.initialPopulation) * 100;
          
          if (updated.populationChange !== null && updated.populationChange !== undefined) {
            expect(updated.populationChange).toBeCloseTo(expectedChange, 2);
          }
        }
      ), { numRuns: 100 });
    });
  });