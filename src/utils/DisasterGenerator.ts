import { DisasterEvent, DisasterSeverity, USRegion } from '../types';
import { Logger } from './Logger';

interface DisasterTemplate {
  category: DisasterEvent['category'];
  disasterType: string; // Specific disaster type (earthquake, hurricane, etc.)
  allowedRegions?: string[]; // Regions where this disaster can occur
  titles: string[];
  descriptions: string[];
  timelineTemplates: string[];
  casualtyRanges: { min: number; max: number };
  costRanges: { min: number; max: number }; // In billions USD
}

interface RegionData {
  name: string;
  population: number;
  gdp: number; // In billions
  states: string[];
  populationDensity: number; // people per square mile
  economicTier: 'high' | 'medium' | 'low';
  riskFactors: string[]; // Natural disaster risks for this region
  urbanization: number; // Percentage urban (0.0 to 1.0)
}

export class DisasterGenerator {
  private logger: Logger;
  private disasterTemplates!: Record<DisasterSeverity, DisasterTemplate[]>;
  private regionData!: Record<string, RegionData>;
  private severityMultipliers!: Record<DisasterSeverity, { casualty: number; cost: number; severity: number }>;
  private databaseManager?: any; // Will be injected

  constructor(logger: Logger, databaseManager?: any) {
    this.logger = logger;
    this.databaseManager = databaseManager;
    this.initializeRegionData();
    this.initializeSeverityMultipliers();
    this.initializeTemplates();
  }

  private initializeRegionData(): void {
    // Enhanced region data with realistic US characteristics
    this.regionData = {
      // West Coast - High population density, earthquake/wildfire prone, high GDP
      'northern_california': { 
        name: 'Northern California', 
        population: 15500000, 
        gdp: 1400, 
        states: ['Northern California'],
        populationDensity: 485, // people per sq mile
        economicTier: 'high', // high/medium/low
        riskFactors: ['earthquake', 'wildfire', 'drought'],
        urbanization: 0.85 // 85% urban
      },
      'southern_california': { 
        name: 'Southern California', 
        population: 24000000, 
        gdp: 2200, 
        states: ['Southern California'],
        populationDensity: 670,
        economicTier: 'high',
        riskFactors: ['earthquake', 'wildfire', 'drought'],
        urbanization: 0.90
      },
      'cascadia': { 
        name: 'Cascadia', 
        population: 12000000, 
        gdp: 900, 
        states: ['Cascadia'],
        populationDensity: 180,
        economicTier: 'high',
        riskFactors: ['earthquake', 'tsunami', 'volcanic'],
        urbanization: 0.75
      },
      
      // East Coast - High density, hurricane prone, high GDP
      'florida': { 
        name: 'Florida', 
        population: 22600000, 
        gdp: 1100, 
        states: ['Florida'],
        populationDensity: 410,
        economicTier: 'medium',
        riskFactors: ['hurricane', 'flooding', 'tornado'],
        urbanization: 0.80
      },
      'carolina': { 
        name: 'Carolina', 
        population: 16000000, 
        gdp: 800, 
        states: ['Carolina'],
        populationDensity: 220,
        economicTier: 'medium',
        riskFactors: ['hurricane', 'tornado', 'flooding'],
        urbanization: 0.70
      },
      'new_england': { 
        name: 'New England', 
        population: 15000000, 
        gdp: 1200, 
        states: ['New England'],
        populationDensity: 240,
        economicTier: 'high',
        riskFactors: ['blizzard', 'hurricane', 'flooding'],
        urbanization: 0.85
      },
      'new_york': { 
        name: 'New York', 
        population: 19500000, 
        gdp: 2000, 
        states: ['New York'],
        populationDensity: 420,
        economicTier: 'high',
        riskFactors: ['blizzard', 'hurricane', 'flooding'],
        urbanization: 0.88
      },
      'maryland': { 
        name: 'Maryland', 
        population: 6200000, 
        gdp: 430, 
        states: ['Maryland'],
        populationDensity: 620,
        economicTier: 'high',
        riskFactors: ['hurricane', 'flooding', 'blizzard'],
        urbanization: 0.87
      },
      'virginia': { 
        name: 'Virginia', 
        population: 8600000, 
        gdp: 550, 
        states: ['Virginia'],
        populationDensity: 220,
        economicTier: 'medium',
        riskFactors: ['hurricane', 'tornado', 'flooding'],
        urbanization: 0.75
      },
      'georgia': { 
        name: 'Georgia', 
        population: 10900000, 
        gdp: 600, 
        states: ['Georgia'],
        populationDensity: 185,
        economicTier: 'medium',
        riskFactors: ['hurricane', 'tornado', 'drought'],
        urbanization: 0.75
      },
      'dixieland': { 
        name: 'Dixieland', 
        population: 18000000, 
        gdp: 700, 
        states: ['Dixieland'],
        populationDensity: 95,
        economicTier: 'low',
        riskFactors: ['hurricane', 'tornado', 'flooding'],
        urbanization: 0.60
      },
      
      // Texas - Large, diverse risks, high GDP
      'texas': { 
        name: 'Texas', 
        population: 30000000, 
        gdp: 2400, 
        states: ['Texas'],
        populationDensity: 115,
        economicTier: 'high',
        riskFactors: ['hurricane', 'tornado', 'drought', 'flooding'],
        urbanization: 0.85
      },
      
      // Central - Tornado Alley, lower density, medium GDP
      'oklahoma': { 
        name: 'Oklahoma', 
        population: 4000000, 
        gdp: 200, 
        states: ['Oklahoma'],
        populationDensity: 58,
        economicTier: 'low',
        riskFactors: ['tornado', 'drought', 'flooding'],
        urbanization: 0.65
      },
      'missouri': { 
        name: 'Missouri', 
        population: 6200000, 
        gdp: 320, 
        states: ['Missouri'],
        populationDensity: 90,
        economicTier: 'medium',
        riskFactors: ['tornado', 'flooding', 'earthquake'],
        urbanization: 0.70
      },
      'illinois': { 
        name: 'Illinois', 
        population: 12800000, 
        gdp: 900, 
        states: ['Illinois'],
        populationDensity: 230,
        economicTier: 'high',
        riskFactors: ['tornado', 'blizzard', 'flooding'],
        urbanization: 0.88
      },
      'ohio': { 
        name: 'Ohio', 
        population: 11800000, 
        gdp: 800, 
        states: ['Ohio'],
        populationDensity: 285,
        economicTier: 'medium',
        riskFactors: ['tornado', 'blizzard', 'flooding'],
        urbanization: 0.78
      },
      'kentucky': { 
        name: 'Kentucky', 
        population: 4500000, 
        gdp: 220, 
        states: ['Kentucky'],
        populationDensity: 115,
        economicTier: 'low',
        riskFactors: ['tornado', 'flooding', 'drought'],
        urbanization: 0.58
      },
      
      // Northern - Low density, blizzard prone, medium GDP
      'michigan': { 
        name: 'Michigan', 
        population: 10000000, 
        gdp: 550, 
        states: ['Michigan'],
        populationDensity: 175,
        economicTier: 'medium',
        riskFactors: ['blizzard', 'flooding', 'tornado'],
        urbanization: 0.75
      },
      'mindak': { 
        name: 'MinDak', 
        population: 1700000, 
        gdp: 115, 
        states: ['MinDak'],
        populationDensity: 12,
        economicTier: 'low',
        riskFactors: ['blizzard', 'drought', 'flooding'],
        urbanization: 0.45
      },
      'yellowstone': { 
        name: 'Yellowstone', 
        population: 1100000, 
        gdp: 95, 
        states: ['Yellowstone'],
        populationDensity: 8,
        economicTier: 'low',
        riskFactors: ['blizzard', 'wildfire', 'volcanic'],
        urbanization: 0.35
      },
      
      // Mountain/Desert - Low density, varied risks
      'colorado': { 
        name: 'Colorado', 
        population: 5800000, 
        gdp: 400, 
        states: ['Colorado'],
        populationDensity: 56,
        economicTier: 'medium',
        riskFactors: ['blizzard', 'wildfire', 'drought'],
        urbanization: 0.86
      },
      'arizona': { 
        name: 'Arizona', 
        population: 7400000, 
        gdp: 380, 
        states: ['Arizona'],
        populationDensity: 65,
        economicTier: 'medium',
        riskFactors: ['drought', 'wildfire', 'flooding'],
        urbanization: 0.90
      },
      'pennsylvania': { 
        name: 'Pennsylvania', 
        population: 13000000, 
        gdp: 900, 
        states: ['Pennsylvania'],
        populationDensity: 290,
        economicTier: 'medium',
        riskFactors: ['blizzard', 'flooding', 'tornado'],
        urbanization: 0.79
      },
      
      // Additional regions from autocomplete
      'new_jersey': { 
        name: 'New Jersey', 
        population: 9300000, 
        gdp: 650, 
        states: ['New Jersey'],
        populationDensity: 1210,
        economicTier: 'high',
        riskFactors: ['hurricane', 'blizzard', 'flooding'],
        urbanization: 0.95
      },
      'dakota': { 
        name: 'Dakota', 
        population: 1700000, 
        gdp: 115, 
        states: ['Dakota'],
        populationDensity: 12,
        economicTier: 'low',
        riskFactors: ['blizzard', 'drought', 'flooding'],
        urbanization: 0.45
      },
      'nuevo_arizona': { 
        name: 'Nuevo Arizona', 
        population: 9200000, 
        gdp: 480, 
        states: ['Nuevo Arizona'],
        populationDensity: 65,
        economicTier: 'medium',
        riskFactors: ['drought', 'wildfire', 'flooding'],
        urbanization: 0.90
      },
      'indiana': { 
        name: 'Indiana', 
        population: 6800000, 
        gdp: 380, 
        states: ['Indiana'],
        populationDensity: 185,
        economicTier: 'medium',
        riskFactors: ['tornado', 'blizzard', 'flooding'],
        urbanization: 0.72
      },
      'wisconsin': { 
        name: 'Wisconsin', 
        population: 5900000, 
        gdp: 350, 
        states: ['Wisconsin'],
        populationDensity: 108,
        economicTier: 'medium',
        riskFactors: ['blizzard', 'tornado', 'flooding'],
        urbanization: 0.70
      },
      
      // Special case for multi-region disasters
      'multiple_nations': { 
        name: 'Multiple Nations', 
        population: 335000000, 
        gdp: 26900, 
        states: ['Multiple Nations'],
        populationDensity: 95,
        economicTier: 'high',
        riskFactors: ['various'],
        urbanization: 0.82
      }
    };
  }

  private initializeSeverityMultipliers(): void {
    this.severityMultipliers = {
      'very_small': { casualty: 0.1, cost: 0.05, severity: 1 },
      'small': { casualty: 0.3, cost: 0.2, severity: 2 },
      'medium': { casualty: 1.0, cost: 1.0, severity: 3 },
      'large': { casualty: 3.0, cost: 5.0, severity: 4 },
      'major': { casualty: 8.0, cost: 15.0, severity: 5 },
      'catastrophic': { casualty: 20.0, cost: 50.0, severity: 6 }
    };
  }

  private initializeTemplates(): void {
    // Define region groups for Kappa's region locks
    const westCoast = ['northern_california', 'southern_california', 'cascadia'];
    const eastAndGulfCoast = ['florida', 'carolina', 'new_england', 'new_york', 'new_jersey', 'maryland', 'virginia', 'georgia', 'dixieland', 'texas'];
    const centralNations = ['oklahoma', 'kansas', 'missouri', 'iowa', 'illinois', 'indiana', 'ohio', 'kentucky', 'tennessee'];
    const northernNations = ['michigan', 'wisconsin', 'dakota', 'yellowstone'];
    const allRegions = Object.keys(this.regionData).filter(r => r !== 'multiple_nations');

    this.disasterTemplates = {
      very_small: [
        // Natural Disasters - Region-specific
        {
          category: 'natural',
          disasterType: 'earthquake',
          allowedRegions: westCoast,
          titles: [
            'Minor Earthquake in {region}',
            'Small Tremor Shakes {region}',
            'Light Seismic Activity in {region}',
            'Brief Earthquake Rattles {region}'
          ],
          descriptions: [
            'A magnitude 4.2 earthquake struck {region}, causing minor structural damage to older buildings and brief power outages. Emergency services report {casualties} minor injuries and property damage estimated at ${cost} million.',
            'A small earthquake has shaken {region}, with residents reporting brief tremors and minor damage to infrastructure. {casualties} people were affected with total damages reaching ${cost} million.'
          ],
          timelineTemplates: [
            'Initial tremor: 30 seconds. Aftershocks: {duration}. Full assessment: 2-4 hours.',
            'Earthquake duration: 45 seconds. Emergency response: {duration}. Recovery: 1-2 days.'
          ],
          casualtyRanges: { min: 5, max: 50 },
          costRanges: { min: 10, max: 100 }
        },
        {
          category: 'natural',
          disasterType: 'tornado',
          allowedRegions: centralNations,
          titles: [
            'Small Tornado Touches Down in {region}',
            'EF1 Tornado Strikes {region}',
            'Minor Tornado Damages {region}',
            'Weak Tornado Hits Rural {region}'
          ],
          descriptions: [
            'An EF1 tornado with winds up to 110 mph touched down in rural {region}, damaging farm buildings and mobile homes. {casualties} people were injured and damages total ${cost} million.',
            'A small tornado struck {region}, destroying several structures and downing power lines. Emergency responders report {casualties} injuries with property damage of ${cost} million.'
          ],
          timelineTemplates: [
            'Tornado formation: 15 minutes. Path duration: {duration}. Cleanup: 2-3 days.',
            'Warning issued: 20 minutes. Tornado active: {duration}. Recovery: 1 week.'
          ],
          casualtyRanges: { min: 2, max: 25 },
          costRanges: { min: 5, max: 80 }
        },
        {
          category: 'natural',
          disasterType: 'blizzard',
          allowedRegions: northernNations,
          titles: [
            'Winter Storm Hits {region}',
            'Blizzard Blankets {region}',
            'Heavy Snow Paralyzes {region}',
            'Ice Storm Strikes {region}'
          ],
          descriptions: [
            'A winter storm dumped 18 inches of snow across {region}, closing schools and businesses. {casualties} people required medical attention due to weather-related incidents, with economic losses of ${cost} million.',
            'A blizzard with 50 mph winds created whiteout conditions in {region}. {casualties} weather-related injuries were reported with damages totaling ${cost} million.'
          ],
          timelineTemplates: [
            'Storm approach: 6 hours. Peak intensity: {duration}. Road clearing: 2-3 days.',
            'Blizzard warning: 12 hours. Storm duration: {duration}. Recovery: 1 week.'
          ],
          casualtyRanges: { min: 10, max: 100 },
          costRanges: { min: 20, max: 150 }
        },
        {
          category: 'artificial',
          disasterType: 'blackout',
          allowedRegions: allRegions,
          titles: [
            'Power Outage Affects {region}',
            'Electrical Grid Failure in {region}',
            'Blackout Hits {region}',
            'Power System Down in {region}'
          ],
          descriptions: [
            'A power grid failure has caused widespread blackouts across {region}, affecting {casualties} residents and businesses. Utility restoration efforts are estimated to cost ${cost} million.',
            'An electrical system malfunction has left {casualties} people without power in {region}. Emergency generators and repair costs total ${cost} million.'
          ],
          timelineTemplates: [
            'Power loss: immediate. Grid assessment: {duration}. Full restoration: 4-12 hours.',
            'Blackout duration: 2-8 hours. Emergency response: {duration}. System repair: 1-2 days.'
          ],
          casualtyRanges: { min: 100, max: 1000 },
          costRanges: { min: 50, max: 300 }
        }
      ],
      small: [
        {
          category: 'natural',
          disasterType: 'earthquake',
          allowedRegions: westCoast,
          titles: [
            'Moderate Earthquake Strikes {region}',
            'Significant Tremor Hits {region}',
            'Earthquake Damages {region}',
            'Seismic Event Rocks {region}'
          ],
          descriptions: [
            'A magnitude 5.4 earthquake struck {region}, causing moderate structural damage and widespread power outages. Emergency services report {casualties} injuries and property damage estimated at ${cost} million.',
            'A moderate earthquake has shaken {region}, causing significant damage to infrastructure and buildings. {casualties} people were affected with total damages reaching ${cost} million.'
          ],
          timelineTemplates: [
            'Initial tremor: 45 seconds. Aftershocks: {duration}. Full assessment: 4-8 hours.',
            'Earthquake duration: 60 seconds. Emergency response: {duration}. Recovery: 3-5 days.'
          ],
          casualtyRanges: { min: 50, max: 300 },
          costRanges: { min: 200, max: 800 }
        },
        {
          category: 'natural',
          disasterType: 'hurricane',
          allowedRegions: eastAndGulfCoast,
          titles: [
            'Category 1 Hurricane Strikes {region}',
            'Hurricane Makes Landfall in {region}',
            'Tropical Storm Batters {region}',
            'Hurricane Winds Lash {region}'
          ],
          descriptions: [
            'Hurricane with 85 mph winds made landfall in {region}, causing flooding and wind damage. {casualties} people were injured and damages total ${cost} million.',
            'A Category 1 hurricane struck {region} with storm surge and heavy rainfall. Emergency responders report {casualties} casualties with property damage of ${cost} million.'
          ],
          timelineTemplates: [
            'Hurricane approach: 24 hours. Landfall duration: {duration}. Recovery: 1-2 weeks.',
            'Evacuation orders: 48 hours. Storm passage: {duration}. Cleanup: 2 weeks.'
          ],
          casualtyRanges: { min: 25, max: 200 },
          costRanges: { min: 300, max: 1200 }
        }
      ],
      medium: [
        {
          category: 'natural',
          disasterType: 'earthquake',
          allowedRegions: westCoast,
          titles: [
            'Major Earthquake Devastates {region}',
            'Powerful Tremor Rocks {region}',
            'Destructive Earthquake Hits {region}',
            'Severe Seismic Event in {region}'
          ],
          descriptions: [
            'A magnitude 6.2 earthquake has devastated {region}, causing severe structural damage and infrastructure collapse. Emergency services report {casualties} casualties and property damage estimated at ${cost} billion.',
            'A major earthquake has rocked {region}, causing widespread destruction and significant casualties. {casualties} people were affected with total damages reaching ${cost} billion.'
          ],
          timelineTemplates: [
            'Initial tremor: 90 seconds. Aftershocks: {duration}. Full assessment: 12-24 hours.',
            'Earthquake duration: 2 minutes. Emergency response: {duration}. Recovery: 1-2 weeks.'
          ],
          casualtyRanges: { min: 300, max: 1500 },
          costRanges: { min: 1, max: 5 }
        },
        {
          category: 'natural',
          disasterType: 'tornado',
          allowedRegions: centralNations,
          titles: [
            'EF3 Tornado Devastates {region}',
            'Violent Tornado Strikes {region}',
            'Destructive Tornado Levels {region}',
            'Major Tornado Outbreak in {region}'
          ],
          descriptions: [
            'An EF3 tornado with 165 mph winds carved a path of destruction through {region}, leveling neighborhoods and businesses. {casualties} people were injured and damages total ${cost} billion.',
            'A violent tornado struck {region}, destroying hundreds of structures and causing widespread devastation. Emergency responders report {casualties} casualties with property damage of ${cost} billion.'
          ],
          timelineTemplates: [
            'Tornado warning: 30 minutes. Path duration: {duration}. Search and rescue: 3 days.',
            'Storm development: 2 hours. Tornado active: {duration}. Recovery: 2-4 weeks.'
          ],
          casualtyRanges: { min: 150, max: 800 },
          costRanges: { min: 0.8, max: 3.5 }
        }
      ],
      large: [
        {
          category: 'natural',
          disasterType: 'earthquake',
          allowedRegions: westCoast,
          titles: [
            'Devastating Earthquake Strikes {region}',
            'Catastrophic Tremor Destroys {region}',
            'Massive Earthquake Devastates {region}',
            'Historic Seismic Disaster in {region}'
          ],
          descriptions: [
            'A magnitude 7.1 earthquake has devastated {region}, causing catastrophic structural damage and infrastructure collapse. Emergency services report {casualties} casualties and property damage estimated at ${cost} billion.',
            'A devastating earthquake has destroyed much of {region}, causing massive casualties and unprecedented destruction. {casualties} people were affected with total damages reaching ${cost} billion.'
          ],
          timelineTemplates: [
            'Initial tremor: 2 minutes. Aftershocks: {duration}. Full assessment: 24-48 hours.',
            'Earthquake duration: 3 minutes. Emergency response: {duration}. Recovery: 2-4 weeks.'
          ],
          casualtyRanges: { min: 1500, max: 7500 },
          costRanges: { min: 5, max: 25 }
        },
        {
          category: 'natural',
          disasterType: 'hurricane',
          allowedRegions: eastAndGulfCoast,
          titles: [
            'Category 4 Hurricane Devastates {region}',
            'Major Hurricane Destroys {region}',
            'Catastrophic Hurricane Strikes {region}',
            'Historic Hurricane Levels {region}'
          ],
          descriptions: [
            'A Category 4 hurricane with 150 mph winds devastated {region}, causing catastrophic flooding and wind damage. {casualties} people were killed or injured and damages total ${cost} billion.',
            'A major hurricane struck {region} with unprecedented storm surge and rainfall. Emergency responders report {casualties} casualties with property damage of ${cost} billion.'
          ],
          timelineTemplates: [
            'Hurricane approach: 72 hours. Landfall duration: {duration}. Recovery: 2-6 months.',
            'Evacuation orders: 96 hours. Storm passage: {duration}. Cleanup: 3-6 months.'
          ],
          casualtyRanges: { min: 800, max: 4000 },
          costRanges: { min: 8, max: 35 }
        }
      ],
      major: [
        {
          category: 'natural',
          disasterType: 'earthquake',
          allowedRegions: westCoast,
          titles: [
            'Historic Earthquake Devastates {region}',
            'Unprecedented Seismic Disaster in {region}',
            'Massive Earthquake Destroys {region}',
            'Catastrophic Tremor Levels {region}'
          ],
          descriptions: [
            'A magnitude 7.8 earthquake has caused unprecedented devastation in {region}, with catastrophic structural collapse and infrastructure failure. Emergency services report {casualties} casualties and property damage estimated at ${cost} billion.',
            'A historic earthquake has leveled much of {region}, causing massive casualties and complete destruction of entire districts. {casualties} people were affected with total damages reaching ${cost} billion.'
          ],
          timelineTemplates: [
            'Initial tremor: 3 minutes. Aftershocks: {duration}. Full assessment: 48-72 hours.',
            'Earthquake duration: 4 minutes. Emergency response: {duration}. Recovery: 1-3 months.'
          ],
          casualtyRanges: { min: 7500, max: 25000 },
          costRanges: { min: 25, max: 100 }
        }
      ],
      catastrophic: [
        {
          category: 'natural',
          disasterType: 'earthquake',
          allowedRegions: westCoast,
          titles: [
            'Apocalyptic Earthquake Destroys {region}',
            'Civilization-Ending Seismic Event in {region}',
            'Total Devastation: Earthquake Annihilates {region}',
            'The Great Earthquake of {region}'
          ],
          descriptions: [
            'A magnitude 8.5+ earthquake has caused apocalyptic devastation in {region}, with complete infrastructure collapse and societal breakdown. Emergency services report {casualties} casualties and property damage estimated at ${cost} billion.',
            'A civilization-ending earthquake has completely destroyed {region}, causing unprecedented casualties and total societal collapse. {casualties} people were affected with damages reaching ${cost} billion.'
          ],
          timelineTemplates: [
            'Initial tremor: 5 minutes. Aftershocks: {duration}. Full assessment: weeks.',
            'Earthquake duration: 6 minutes. Emergency response: {duration}. Recovery: months to years.'
          ],
          casualtyRanges: { min: 25000, max: 100000 },
          costRanges: { min: 100, max: 500 }
        }
      ]
    };
  }

  public generateDisaster(severity: DisasterSeverity, region: USRegion = 'random', category?: DisasterEvent['category']): DisasterEvent {
    this.logger.debug(`Generating ${severity} disaster for region: ${region}`);
    
    // Select region data
    const selectedRegion = region === 'random' ? this.selectRandomRegion() : region;
    const regionInfo = this.regionData[selectedRegion];
    if (!regionInfo) {
      throw new Error(`Region data not found for: ${selectedRegion}`);
    }
    
    // Select disaster category if not specified
    const selectedCategory = category || this.selectRandomCategory();
    
    // Get templates for this severity and category
    let templates = this.disasterTemplates[severity].filter(t => t.category === selectedCategory);
    
    // Apply Kappa's region locks - filter templates by allowed regions
    if (region !== 'random') {
      templates = templates.filter(t => 
        !t.allowedRegions || t.allowedRegions.includes(selectedRegion)
      );
    }
    
    if (!templates || templates.length === 0) {
      // If no templates available for this region, try to find a suitable region for the disaster type
      if (region !== 'random') {
        throw new Error(`No ${selectedCategory} disasters of severity ${severity} are allowed in ${selectedRegion} due to region restrictions`);
      }
      throw new Error(`No templates available for ${severity} ${selectedCategory} disasters`);
    }
    
    const template = templates[Math.floor(Math.random() * templates.length)];
    if (!template) {
      throw new Error(`Failed to select template for ${severity} ${selectedCategory} disaster`);
    }
    
    // If region is random and template has region restrictions, select appropriate region
    let finalRegion = selectedRegion;
    if (region === 'random' && template.allowedRegions && template.allowedRegions.length > 0) {
      const selectedAllowedRegion = template.allowedRegions[Math.floor(Math.random() * template.allowedRegions.length)];
      if (selectedAllowedRegion) {
        finalRegion = selectedAllowedRegion;
        const finalRegionInfo = this.regionData[finalRegion];
        if (finalRegionInfo) {
          // Update region info for calculations
          Object.assign(regionInfo, finalRegionInfo);
        }
      }
    }
    
    // Generate disaster details with realistic scaling
    const multiplier = this.severityMultipliers[severity];
    const title = this.selectRandomFromArray(template.titles);
    const description = this.selectRandomFromArray(template.descriptions);
    const timeline = this.selectRandomFromArray(template.timelineTemplates);
    
    if (!title || !description || !timeline) {
      throw new Error('Failed to select template content');
    }
    
    // Calculate realistic casualties based on region characteristics
    const densityMultiplier = Math.log10(regionInfo.populationDensity + 1) / 3; // Higher density = more casualties
    const urbanMultiplier = regionInfo.urbanization * 1.5 + 0.5; // Urban areas more vulnerable
    const baseCasualties = Math.floor(
      regionInfo.population * 0.00001 * multiplier.casualty * densityMultiplier * urbanMultiplier
    );
    const casualties = Math.max(1, Math.floor(
      baseCasualties + (Math.random() * baseCasualties * 0.8)
    ));
    
    // Calculate realistic economic cost based on region characteristics
    const economicTierMultiplier = regionInfo.economicTier === 'high' ? 2.0 : 
                                  regionInfo.economicTier === 'medium' ? 1.0 : 0.6;
    const infrastructureCost = regionInfo.gdp * 0.008 * multiplier.cost * economicTierMultiplier;
    const densityCostMultiplier = Math.log10(regionInfo.populationDensity + 1) / 2; // Denser = more expensive
    const cost = Math.max(0.1, 
      infrastructureCost * (1 + densityCostMultiplier) + (Math.random() * infrastructureCost * 0.4)
    );
    
    // Generate affected regions based on severity
    const affectedRegions = this.generateAffectedRegions(finalRegion, severity);
    
    const disaster: DisasterEvent = {
      type: severity,
      category: template.category,
      title: this.personalizeTitle(title, regionInfo.name),
      description: this.personalizeDescription(description, regionInfo.name, casualties, cost),
      timeline: this.personalizeTimeline(timeline, severity),
      estimatedCasualties: casualties,
      economicCost: cost,
      affectedRegions,
      severity: multiplier.severity
    };

    // Record disaster in database for tracking
    if (this.databaseManager) {
      try {
        this.databaseManager.recordDisaster({
          severity,
          category: template.category,
          title: disaster.title,
          description: disaster.description,
          affectedRegions: disaster.affectedRegions,
          estimatedCasualties: disaster.estimatedCasualties,
          economicCost: disaster.economicCost,
          generatedBy: 'system'
        });
      } catch (error) {
        this.logger.error('Failed to record disaster in database:', { error: error as Error });
      }
    }

    return disaster;
  }

  // Method to select disaster severity using Kappa's dynamic probability system
  public selectDisasterSeverity(testMode: boolean = false): DisasterSeverity {
    if (!this.databaseManager) {
      // Fallback to base odds if no database
      const severities: DisasterSeverity[] = ['small', 'medium', 'large', 'major', 'catastrophic'];
      const weights = [67, 20, 10, 2.5, 0.5];
      return this.weightedRandomSelect(severities, weights);
    }

    const probabilities = this.getDisasterProbabilities(testMode);
    const severities: DisasterSeverity[] = ['small', 'medium', 'large', 'major', 'catastrophic'];
    const weights = [
      (probabilities.small || 0.67) * 100,
      (probabilities.medium || 0.20) * 100,
      (probabilities.large || 0.10) * 100,
      (probabilities.major || 0.025) * 100,
      (probabilities.catastrophic || 0.005) * 100
    ];

    const selectedSeverity = this.weightedRandomSelect(severities, weights);

    // Update odds based on Kappa's rules (only if not in test mode)
    if (!testMode && this.databaseManager) {
      this.updateOddsAfterGeneration(selectedSeverity);
    }

    return selectedSeverity;
  }

  // Get current disaster probabilities from Kappa's system
  public getDisasterProbabilities(testMode: boolean = false): Record<string, number> {
    if (!this.databaseManager || testMode) {
      // Return base odds for test mode or when no database
      return {
        small: 0.67,
        medium: 0.20,
        large: 0.10,
        major: 0.025,
        catastrophic: 0.005
      };
    }

    try {
      const odds = this.databaseManager.getCurrentDisasterOdds();
      return {
        small: odds.small || 0.67,
        medium: odds.medium || 0.20,
        large: odds.large || 0.10,
        major: odds.major || 0.025,
        catastrophic: odds.catastrophic || 0.005
      };
    } catch (error) {
      this.logger.error('Failed to get disaster odds from database:', { error: error as Error });
      // Fallback to base odds
      return {
        small: 0.67,
        medium: 0.20,
        large: 0.10,
        major: 0.025,
        catastrophic: 0.005
      };
    }
  }

  // Generate advanced disaster with additional options
  public generateAdvancedDisaster(
    severity: DisasterSeverity,
    region: USRegion = 'random',
    options: {
      category?: DisasterEvent['category'];
      minCasualties?: number;
      maxCasualties?: number;
      minCost?: number;
      maxCost?: number;
      multiRegion?: boolean;
      customTitle?: string;
      duration?: string;
      generatedBy?: string;
    } = {}
  ): DisasterEvent {
    const disaster = this.generateDisaster(severity, region, options.category);

    // Apply custom overrides
    if (options.customTitle) {
      disaster.title = options.customTitle;
    }

    if (options.minCasualties !== undefined || options.maxCasualties !== undefined) {
      const min = options.minCasualties || 0;
      const max = options.maxCasualties || disaster.estimatedCasualties;
      disaster.estimatedCasualties = Math.floor(Math.random() * (max - min + 1)) + min;
    }

    if (options.minCost !== undefined || options.maxCost !== undefined) {
      const min = options.minCost || 0;
      const max = options.maxCost || disaster.economicCost;
      disaster.economicCost = Math.random() * (max - min) + min;
    }

    if (options.multiRegion && disaster.affectedRegions.length === 1) {
      // Add additional regions for multi-region disasters
      const additionalRegions = this.generateAffectedRegions(region === 'random' ? this.selectRandomRegion() : region, 'major');
      disaster.affectedRegions = [...new Set([...disaster.affectedRegions, ...additionalRegions])];
    }

    return disaster;
  }

  // Get templates for preview
  public getTemplatesForPreview(severity: DisasterSeverity, category: DisasterEvent['category']): any[] {
    const templates = this.disasterTemplates[severity]?.filter(t => t.category === category) || [];
    return templates;
  }

  // Get system statistics
  public getSystemStats(): {
    totalTemplates: number;
    categories: number;
    severityLevels: number;
    regions: number;
    templatesByCategory: Record<string, number>;
    templatesBySeverity: Record<string, number>;
  } {
    let totalTemplates = 0;
    const templatesByCategory: Record<string, number> = {};
    const templatesBySeverity: Record<string, number> = {};

    for (const [severity, templates] of Object.entries(this.disasterTemplates)) {
      templatesBySeverity[severity] = templates.length;
      totalTemplates += templates.length;

      for (const template of templates) {
        templatesByCategory[template.category] = (templatesByCategory[template.category] || 0) + 1;
      }
    }

    return {
      totalTemplates,
      categories: Object.keys(templatesByCategory).length,
      severityLevels: Object.keys(this.disasterTemplates).length,
      regions: Object.keys(this.regionData).length,
      templatesByCategory,
      templatesBySeverity
    };
  }

  // Simulate multiple disasters for testing
  public simulateDisasters(
    count: number,
    categoryFilter?: DisasterEvent['category'],
    testMode: boolean = false
  ): {
    total: number;
    severityDistribution: Record<string, number>;
    categoryDistribution: Record<string, number>;
    avgCasualties: number;
    avgCost: number;
    mostCommonSeverity: DisasterSeverity;
    mostCommonCategory: DisasterEvent['category'];
    mostAffectedRegion: string;
  } {
    const disasters: DisasterEvent[] = [];
    const severityDistribution: Record<string, number> = {};
    const categoryDistribution: Record<string, number> = {};
    const regionCount: Record<string, number> = {};

    for (let i = 0; i < count; i++) {
      const severity = this.selectDisasterSeverity(testMode);
      const disaster = this.generateDisaster(severity, 'random', categoryFilter);
      disasters.push(disaster);

      // Track distributions
      severityDistribution[disaster.type] = (severityDistribution[disaster.type] || 0) + 1;
      categoryDistribution[disaster.category] = (categoryDistribution[disaster.category] || 0) + 1;
      
      // Track regions
      for (const region of disaster.affectedRegions) {
        regionCount[region] = (regionCount[region] || 0) + 1;
      }
    }

    // Calculate statistics
    const totalCasualties = disasters.reduce((sum, d) => sum + d.estimatedCasualties, 0);
    const totalCost = disasters.reduce((sum, d) => sum + d.economicCost, 0);

    const severityEntries = Object.entries(severityDistribution).sort(([,a], [,b]) => b - a);
    const categoryEntries = Object.entries(categoryDistribution).sort(([,a], [,b]) => b - a);
    const regionEntries = Object.entries(regionCount).sort(([,a], [,b]) => b - a);

    return {
      total: count,
      severityDistribution,
      categoryDistribution,
      avgCasualties: totalCasualties / count,
      avgCost: totalCost / count,
      mostCommonSeverity: (severityEntries[0]?.[0] as DisasterSeverity) || 'small',
      mostCommonCategory: (categoryEntries[0]?.[0] as DisasterEvent['category']) || 'natural',
      mostAffectedRegion: regionEntries[0]?.[0] || 'Unknown'
    };
  }

  // Helper method for weighted random selection
  private weightedRandomSelect<T>(items: T[], weights: number[]): T {
    if (items.length === 0) {
      throw new Error('Cannot select from empty array');
    }
    
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      const weight = weights[i];
      if (weight !== undefined) {
        random -= weight;
        if (random <= 0) {
          return items[i]!; // We know this exists because we checked length
        }
      }
    }

    return items[items.length - 1]!; // Fallback - we know this exists
  }

  // Update odds after disaster generation according to Kappa's rules
  private updateOddsAfterGeneration(generatedSeverity: DisasterSeverity): void {
    if (!this.databaseManager) return;

    try {
      const currentOdds = this.databaseManager.getCurrentDisasterOdds();
      const newOdds = { ...currentOdds };

      if (generatedSeverity === 'small') {
        // Small rolled: -20% Small, +10% Medium, +10% Large
        newOdds.small = Math.max(0.01, newOdds.small * 0.8); // -20%
        newOdds.medium = Math.min(0.9, newOdds.medium * 1.1); // +10%
        newOdds.large = Math.min(0.9, newOdds.large * 1.1); // +10%
      } else if (generatedSeverity === 'medium' || generatedSeverity === 'large') {
        // Medium/Large rolled: Reset to base, restore Small losses
        newOdds.small = 0.67;
        newOdds.medium = 0.20;
        newOdds.large = 0.10;
        newOdds.major = 0.025;
        // Catastrophic stays at 3% (0.03) - never changes
      }
      // Catastrophic odds never change (always 3%)

      this.databaseManager.updateDisasterOdds(newOdds, 'system');
    } catch (error) {
      this.logger.error('Failed to update disaster odds:', { error: error as Error });
    }
  }

  private selectRandomRegion(): string {
    const regions = Object.keys(this.regionData).filter(r => r !== 'multiple_nations');
    if (regions.length === 0) {
      return 'northern_california'; // Fallback
    }
    return regions[Math.floor(Math.random() * regions.length)]!; // We know this exists
  }

  private selectRandomCategory(): DisasterEvent['category'] {
    // Only Kappa's approved disaster categories
    const categories: DisasterEvent['category'][] = ['natural', 'artificial'];
    return categories[Math.floor(Math.random() * categories.length)]!; // We know this exists
  }

  private selectRandomFromArray<T>(array: T[]): T {
    if (!array || array.length === 0) {
      throw new Error('Cannot select from empty array');
    }
    return array[Math.floor(Math.random() * array.length)]!; // We know this exists
  }

  private personalizeTitle(title: string, regionName: string): string {
    return title.replace(/\{region\}/g, regionName);
  }

  private personalizeDescription(description: string, regionName: string, casualties: number, cost: number): string {
    return description
      .replace(/\{region\}/g, regionName)
      .replace(/\{casualties\}/g, casualties.toLocaleString())
      .replace(/\{cost\}/g, cost.toLocaleString());
  }

  private personalizeTimeline(timeline: string, severity: DisasterSeverity): string {
    const durations: Record<DisasterSeverity, string> = {
      'very_small': '2-6 hours',
      'small': '6-12 hours',
      'medium': '12-24 hours',
      'large': '1-3 days',
      'major': '3-7 days',
      'catastrophic': '1-4 weeks'
    };
    
    return timeline.replace(/\{duration\}/g, durations[severity]);
  }

  private generateAffectedRegions(selectedRegion: string, severity: DisasterSeverity): string[] {
    const regionInfo = this.regionData[selectedRegion];
    if (!regionInfo) {
      return ['Unknown Region'];
    }

    const affectedRegions = [regionInfo.name];
    
    // For higher severity disasters, potentially affect neighboring regions
    const severitySpread: Record<DisasterSeverity, number> = {
      'very_small': 0,    // Only affects the primary region
      'small': 0,         // Only affects the primary region
      'medium': 1,        // Can spread to 1 neighboring region
      'large': 2,         // Can spread to 2 neighboring regions
      'major': 3,         // Can spread to 3 neighboring regions
      'catastrophic': 5   // Can spread to up to 5 neighboring regions
    };

    const spreadCount = severitySpread[severity];
    if (spreadCount > 0) {
      // Add neighboring regions based on severity
      const allRegions = Object.keys(this.regionData).filter(r => r !== 'multiple_nations' && r !== selectedRegion);
      const shuffledRegions = allRegions.sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < Math.min(spreadCount, shuffledRegions.length); i++) {
        if (Math.random() < 0.3) { // 30% chance to spread to each potential region
          const regionKey = shuffledRegions[i];
          if (regionKey) {
            const neighborRegionInfo = this.regionData[regionKey];
            if (neighborRegionInfo) {
              affectedRegions.push(neighborRegionInfo.name);
            }
          }
        }
      }
    }

    return affectedRegions;
  }
}