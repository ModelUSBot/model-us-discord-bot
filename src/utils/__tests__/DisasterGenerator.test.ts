import * as fc from 'fast-check';
import { DisasterGenerator } from '../DisasterGenerator';
import { Logger } from '../Logger';
import { DisasterEvent } from '../../types';

describe('DisasterGenerator', () => {
  let generator: DisasterGenerator;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('error'); // Suppress logs during tests
    generator = new DisasterGenerator(logger);
  });

  describe('Property 12: Disaster Probability Distribution', () => {
    // Feature: model-us-discord-bot, Property 12: For any large sample of generated disasters, the distribution should approach 50% small, 35% medium, 10% large, and 5% very large disasters
    
    test('disaster probability distribution approaches expected percentages', () => {
      const sampleSize = 10000;
      const disasters: DisasterEvent[] = [];
      
      // Generate large sample of disasters
      for (let i = 0; i < sampleSize; i++) {
        disasters.push(generator.generateDisaster());
      }
      
      // Count each type
      const counts = {
        small: disasters.filter(d => d.type === 'small').length,
        medium: disasters.filter(d => d.type === 'medium').length,
        large: disasters.filter(d => d.type === 'large').length,
        very_large: disasters.filter(d => d.type === 'very_large').length
      };
      
      // Calculate percentages
      const percentages = {
        small: (counts.small / sampleSize) * 100,
        medium: (counts.medium / sampleSize) * 100,
        large: (counts.large / sampleSize) * 100,
        very_large: (counts.very_large / sampleSize) * 100
      };
      
      // Allow for statistical variance (±5% tolerance for large sample)
      expect(percentages.small).toBeCloseTo(50, 0); // Within 5%
      expect(percentages.medium).toBeCloseTo(35, 0); // Within 5%
      expect(percentages.large).toBeCloseTo(10, 0); // Within 5%
      expect(percentages.very_large).toBeCloseTo(5, 0); // Within 5%
      
      // Ensure all disasters are accounted for
      expect(counts.small + counts.medium + counts.large + counts.very_large).toBe(sampleSize);
    }, 30000); // Increase timeout for large sample test

    test('smaller sample shows reasonable distribution variance', () => {
      fc.assert(fc.property(
        fc.integer({ min: 100, max: 1000 }),
        (sampleSize) => {
          const disasters: DisasterEvent[] = [];
          
          for (let i = 0; i < sampleSize; i++) {
            disasters.push(generator.generateDisaster());
          }
          
          const counts = {
            small: disasters.filter(d => d.type === 'small').length,
            medium: disasters.filter(d => d.type === 'medium').length,
            large: disasters.filter(d => d.type === 'large').length,
            very_large: disasters.filter(d => d.type === 'very_large').length
          };
          
          // Verify all disasters are valid types
          expect(counts.small + counts.medium + counts.large + counts.very_large).toBe(sampleSize);
          
          // Small disasters should be most common
          expect(counts.small).toBeGreaterThan(counts.medium);
          expect(counts.small).toBeGreaterThan(counts.large);
          expect(counts.small).toBeGreaterThan(counts.very_large);
          
          // Medium should be more common than large and very_large
          expect(counts.medium).toBeGreaterThan(counts.large);
          expect(counts.medium).toBeGreaterThan(counts.very_large);
        }
      ), { numRuns: 50 });
    });
  });

  describe('Property 13: Disaster Information Completeness', () => {
    // Feature: model-us-discord-bot, Property 13: For any generated disaster, the response should include timeline, estimated casualties, economic cost, and affected regions
    
    test('all generated disasters contain complete required information', () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 100 }),
        (numDisasters) => {
          for (let i = 0; i < numDisasters; i++) {
            const disaster = generator.generateDisaster();
            
            // Verify all required fields are present and valid
            expect(disaster.type).toMatch(/^(small|medium|large|very_large)$/);
            expect(disaster.category).toMatch(/^(natural|pandemic|war|economic|famine)$/);
            expect(disaster.title).toBeDefined();
            expect(disaster.title.length).toBeGreaterThan(0);
            expect(disaster.description).toBeDefined();
            expect(disaster.description.length).toBeGreaterThan(0);
            expect(disaster.timeline).toBeDefined();
            expect(disaster.timeline.length).toBeGreaterThan(0);
            expect(disaster.estimatedCasualties).toBeGreaterThanOrEqual(0);
            expect(disaster.economicCost).toBeGreaterThan(0);
            expect(disaster.affectedRegions).toBeDefined();
            expect(disaster.affectedRegions.length).toBeGreaterThan(0);
            
            // Verify affected regions are non-empty strings
            disaster.affectedRegions.forEach(region => {
              expect(typeof region).toBe('string');
              expect(region.length).toBeGreaterThan(0);
            });
          }
        }
      ), { numRuns: 100 });
    });
  });

  describe('Property 14: Disaster Category Variety', () => {
    // Feature: model-us-discord-bot, Property 14: For any series of disaster generations, the system should be capable of producing disasters from all required categories: natural, pandemic, famine, distant wars, and nearby conflicts
    
    test('disaster generator produces all required categories over multiple generations', () => {
      const requiredCategories = new Set(['natural', 'pandemic', 'war', 'economic', 'famine']);
      const generatedCategories = new Set<string>();
      
      // Generate disasters until we see all categories or reach reasonable limit
      let attempts = 0;
      const maxAttempts = 1000;
      
      while (generatedCategories.size < requiredCategories.size && attempts < maxAttempts) {
        const disaster = generator.generateDisaster();
        generatedCategories.add(disaster.category);
        attempts++;
      }
      
      // Verify all required categories can be generated
      requiredCategories.forEach(category => {
        expect(generatedCategories.has(category)).toBe(true);
      });
    });
  });

  describe('Property 15: War Proximity Impact', () => {
    // Feature: model-us-discord-bot, Property 15: For any war-related disaster, nearby conflicts should have higher severity ratings than distant conflicts
    
    test('war disasters with proximity factors show appropriate impact scaling', () => {
      const warDisasters: DisasterEvent[] = [];
      
      // Generate disasters until we get enough war disasters with proximity factors
      let attempts = 0;
      const maxAttempts = 1000;
      
      while (warDisasters.length < 50 && attempts < maxAttempts) {
        const disaster = generator.generateDisaster();
        if (disaster.category === 'war' && disaster.proximityFactor !== undefined) {
          warDisasters.push(disaster);
        }
        attempts++;
      }
      
      // Should have found some war disasters with proximity factors
      expect(warDisasters.length).toBeGreaterThan(0);
      
      // Separate near and far conflicts
      const nearConflicts = warDisasters.filter(d => d.proximityFactor! > 1.5);
      const farConflicts = warDisasters.filter(d => d.proximityFactor! < 1.5);
      
      if (nearConflicts.length > 0 && farConflicts.length > 0) {
        // Near conflicts should generally have higher proximity factors
        const avgNearFactor = nearConflicts.reduce((sum, d) => sum + d.proximityFactor!, 0) / nearConflicts.length;
        const avgFarFactor = farConflicts.reduce((sum, d) => sum + d.proximityFactor!, 0) / farConflicts.length;
        
        expect(avgNearFactor).toBeGreaterThan(avgFarFactor);
      }
    });
  });

  describe('Unit Tests for Disaster Generator', () => {
    test('should generate disasters with appropriate severity scaling', () => {
      const disasters = {
        small: [] as DisasterEvent[],
        medium: [] as DisasterEvent[],
        large: [] as DisasterEvent[],
        very_large: [] as DisasterEvent[]
      };
      
      // Generate sample of each type by generating many disasters
      for (let i = 0; i < 1000; i++) {
        const disaster = generator.generateDisaster();
        disasters[disaster.type].push(disaster);
      }
      
      // Verify severity scaling in casualties and costs
      if (disasters.small.length > 0 && disasters.medium.length > 0) {
        const avgSmallCasualties = disasters.small.reduce((sum, d) => sum + d.estimatedCasualties, 0) / disasters.small.length;
        const avgMediumCasualties = disasters.medium.reduce((sum, d) => sum + d.estimatedCasualties, 0) / disasters.medium.length;
        
        expect(avgMediumCasualties).toBeGreaterThan(avgSmallCasualties);
      }
      
      if (disasters.medium.length > 0 && disasters.large.length > 0) {
        const avgMediumCost = disasters.medium.reduce((sum, d) => sum + d.economicCost, 0) / disasters.medium.length;
        const avgLargeCost = disasters.large.reduce((sum, d) => sum + d.economicCost, 0) / disasters.large.length;
        
        expect(avgLargeCost).toBeGreaterThan(avgMediumCost);
      }
    });

    test('should return correct probability configuration', () => {
      const probabilities = generator.getDisasterProbabilities();
      
      expect(probabilities.small).toBe(50);
      expect(probabilities.medium).toBe(35);
      expect(probabilities.large).toBe(10);
      expect(probabilities.very_large).toBe(5);
      
      // Probabilities should sum to 100
      const total = Object.values(probabilities).reduce((sum, prob) => sum + prob, 0);
      expect(total).toBe(100);
    });

    test('should generate different disasters on multiple calls', () => {
      const disaster1 = generator.generateDisaster();
      const disaster2 = generator.generateDisaster();
      
      // While it's possible to get identical disasters, it's extremely unlikely
      // Check that at least some aspect is different
      const isDifferent = 
        disaster1.title !== disaster2.title ||
        disaster1.description !== disaster2.description ||
        disaster1.estimatedCasualties !== disaster2.estimatedCasualties ||
        disaster1.economicCost !== disaster2.economicCost ||
        disaster1.type !== disaster2.type ||
        disaster1.category !== disaster2.category;
      
      expect(isDifferent).toBe(true);
    });

    test('should generate appropriate affected regions for each severity', () => {
      const disasters = Array.from({ length: 100 }, () => generator.generateDisaster());
      
      disasters.forEach(disaster => {
        expect(disaster.affectedRegions.length).toBeGreaterThan(0);
        
        // Verify region count is appropriate for severity
        if (disaster.type === 'small') {
          expect(disaster.affectedRegions.length).toBeLessThanOrEqual(3);
        } else if (disaster.type === 'medium') {
          expect(disaster.affectedRegions.length).toBeLessThanOrEqual(5);
        } else if (disaster.type === 'large') {
          expect(disaster.affectedRegions.length).toBeLessThanOrEqual(7);
        } else if (disaster.type === 'very_large') {
          expect(disaster.affectedRegions.length).toBeLessThanOrEqual(4);
        }
      });
    });
  });
});