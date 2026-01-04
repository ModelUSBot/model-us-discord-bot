import { DisasterEvent, DisasterSeverity, USRegion } from '../types';
import { Logger } from './Logger';

interface DisasterTemplate {
  category: DisasterEvent['category'];
  titles: string[];
  descriptions: string[];
  timelineTemplates: string[];
  casualtyRanges: { min: number; max: number };
  costRanges: { min: number; max: number }; // In billions USD
  proximityFactors?: { near: number; far: number }; // For war disasters
}

interface RegionData {
  name: string;
  population: number;
  gdp: number; // In billions
  states: string[];
}

export class DisasterGenerator {
  private logger: Logger;
  private disasterTemplates!: Record<DisasterSeverity, DisasterTemplate[]>;
  private regionData!: Record<string, RegionData>;
  private severityMultipliers!: Record<DisasterSeverity, { casualty: number; cost: number; severity: number }>;

  constructor(logger: Logger) {
    this.logger = logger;
    this.initializeRegionData();
    this.initializeSeverityMultipliers();
    this.initializeTemplates();
  }

  private initializeRegionData(): void {
    // Actual nations in the Model US world
    this.regionData = {
      'new_york': { name: 'New York', population: 19500000, gdp: 2000, states: ['New York'] },
      'texas': { name: 'Texas', population: 30000000, gdp: 2400, states: ['Texas'] },
      'southern_california': { name: 'Southern California', population: 24000000, gdp: 2200, states: ['Southern California'] },
      'northern_california': { name: 'Northern California', population: 15500000, gdp: 1400, states: ['Northern California'] },
      'florida': { name: 'Florida', population: 22600000, gdp: 1100, states: ['Florida'] },
      'new_england': { name: 'New England', population: 15000000, gdp: 1200, states: ['New England'] },
      'cascadia': { name: 'Cascadia', population: 12000000, gdp: 900, states: ['Cascadia'] },
      'carolina': { name: 'Carolina', population: 16000000, gdp: 800, states: ['Carolina'] },
      'illinois': { name: 'Illinois', population: 12800000, gdp: 900, states: ['Illinois'] },
      'pennsylvania': { name: 'Pennsylvania', population: 13000000, gdp: 900, states: ['Pennsylvania'] },
      'dixieland': { name: 'Dixieland', population: 18000000, gdp: 700, states: ['Dixieland'] },
      'ohio': { name: 'Ohio', population: 11800000, gdp: 800, states: ['Ohio'] },
      'georgia': { name: 'Georgia', population: 10900000, gdp: 600, states: ['Georgia'] },
      'virginia': { name: 'Virginia', population: 8600000, gdp: 550, states: ['Virginia'] },
      'new_jersey': { name: 'New Jersey', population: 9300000, gdp: 650, states: ['New Jersey'] },
      'maryland': { name: 'Maryland', population: 6200000, gdp: 430, states: ['Maryland'] },
      'oklahoma': { name: 'Oklahoma', population: 4000000, gdp: 200, states: ['Oklahoma'] },
      'michigan': { name: 'Michigan', population: 10000000, gdp: 550, states: ['Michigan'] },
      'dakota': { name: 'Dakota', population: 1700000, gdp: 115, states: ['Dakota'] },
      'nuevo_arizona': { name: 'Nuevo Arizona', population: 9200000, gdp: 480, states: ['Nuevo Arizona'] },
      'tennessee': { name: 'Tennessee', population: 6900000, gdp: 380, states: ['Tennessee'] },
      'colorado': { name: 'Colorado', population: 5800000, gdp: 400, states: ['Colorado'] },
      'indiana': { name: 'Indiana', population: 6800000, gdp: 380, states: ['Indiana'] },
      'wisconsin': { name: 'Wisconsin', population: 5900000, gdp: 350, states: ['Wisconsin'] },
      'missouri': { name: 'Missouri', population: 6200000, gdp: 320, states: ['Missouri'] },
      'utah': { name: 'Utah', population: 3300000, gdp: 200, states: ['Utah'] },
      'kansas': { name: 'Kansas', population: 2900000, gdp: 180, states: ['Kansas'] },
      'kentucky': { name: 'Kentucky', population: 4500000, gdp: 220, states: ['Kentucky'] },
      'iowa': { name: 'Iowa', population: 3200000, gdp: 200, states: ['Iowa'] },
      'yellowstone': { name: 'Yellowstone', population: 1100000, gdp: 95, states: ['Yellowstone'] },
      'multiple_nations': { name: 'Multiple Nations', population: 335000000, gdp: 26900, states: ['Multiple Nations'] }
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
    this.disasterTemplates = {
      very_small: [
        {
          category: 'natural',
          titles: [
            'Minor Earthquake in {region}',
            'Small Wildfire Outbreak in {region}',
            'Localized Flooding in {region}',
            'Severe Thunderstorm System in {region}',
            'Minor Tornado Touches Down in {region}',
            'Small Landslide Affects {region}',
            'Hailstorm Damages {region}',
            'Flash Drought Impacts {region}',
            'Minor Coastal Erosion in {region}',
            'Small Sinkhole Opens in {region}',
            'Brief Ice Storm Hits {region}',
            'Minor Volcanic Activity in {region}',
            'Severe Lightning Storm in {region}',
            'Minor Mudslide in {region}',
            'Small Rockfall Blocks Roads in {region}',
            'Flash Freeze Warning in {region}',
            'Minor Dust Devil Activity in {region}',
            'Small Creek Flooding in {region}',
            'Brief Power Line Fire in {region}',
            'Minor Soil Erosion in {region}',
            'Small Brush Fire in {region}',
            'Minor Avalanche Risk in {region}',
            'Severe Wind Gusts in {region}',
            'Minor Fog Bank Disruption in {region}',
            'Small Debris Flow in {region}',
            'Brief Waterspout Sighting in {region}',
            'Minor Ground Subsidence in {region}',
            'Small Pond Overflow in {region}',
            'Brief Microburst Event in {region}',
            'Minor Tree Fall Incidents in {region}'
          ],
          descriptions: [
            'A magnitude 4.2 earthquake struck {region}, causing minor structural damage to older buildings and brief power outages. Emergency services report {casualties} minor injuries and property damage estimated at {cost}. Most infrastructure remains operational.',
            'A small wildfire has burned approximately 2,500 acres in {region}, threatening rural communities. Firefighting efforts are ongoing with {casualties} evacuations reported. Economic impact includes {cost} in firefighting costs and property damage.',
            'Heavy rainfall has caused localized flooding in {region}, affecting low-lying areas and causing {casualties} water rescues. Transportation disruptions and property damage are estimated at {cost}.',
            'A severe thunderstorm system moved through {region}, producing damaging winds and heavy rain. {casualties} people were affected by power outages and minor structural damage. Total economic impact reaches {cost}.',
            'An EF1 tornado briefly touched down in {region}, damaging several buildings and uprooting trees. {casualties} residents were affected by the storm. Cleanup and repair costs are estimated at {cost}.',
            'A small landslide occurred in {region} following heavy rains, blocking local roads and affecting {casualties} residents. Infrastructure damage and cleanup costs total {cost}.',
            'A severe hailstorm struck {region}, producing golf ball-sized hail that damaged vehicles and roofs. {casualties} people were affected by property damage totaling {cost}.',
            'A flash drought has developed in {region}, affecting local agriculture and water supplies. {casualties} farmers and residents are impacted. Economic losses reach {cost}.',
            'Minor coastal erosion has affected {region}, threatening beachfront properties and infrastructure. {casualties} residents are impacted by property damage estimated at {cost}.',
            'A small sinkhole opened in {region}, swallowing part of a roadway and affecting local traffic. {casualties} people were evacuated as a precaution. Repair costs total {cost}.',
            'A brief ice storm hit {region}, coating roads and power lines with dangerous ice. {casualties} people experienced power outages and travel disruptions. Emergency response costs reach {cost}.',
            'Minor volcanic activity has been detected in {region}, prompting monitoring and safety precautions. {casualties} residents in nearby areas are on alert. Monitoring and safety costs total {cost}.',
            'A severe lightning storm struck {region}, causing multiple power outages and small fires. {casualties} people were affected by electrical disruptions. Repair and response costs amount to {cost}.',
            'A minor mudslide has blocked several roads in {region} following heavy rainfall. {casualties} commuters are affected by transportation delays. Cleanup costs reach {cost}.',
            'Small rockfalls have blocked mountain roads in {region}, affecting {casualties} travelers and local residents. Road clearing and safety measures cost {cost}.'
          ],
          timelineTemplates: [
            'Initial impact: 2-6 hours. Recovery efforts: {duration}. Full restoration expected within 1 week.',
            'Event duration: {duration}. Emergency response: 24-48 hours. Cleanup and recovery: 3-5 days.',
            'Immediate response: 4-8 hours. Assessment period: {duration}. Complete recovery: 5-10 days.',
            'Natural event: 1-4 hours. Emergency operations: {duration}. Infrastructure repair: 1-2 weeks.',
            'Weather impact: 2-8 hours. Cleanup efforts: {duration}. Normal operations: 3-7 days.'
          ],
          casualtyRanges: { min: 5, max: 50 },
          costRanges: { min: 10, max: 100 }
        },
        {
          category: 'cyber',
          titles: [
            'Minor Cyber Incident in {region}',
            'Small Data Breach Affects {region}',
            'Local Network Disruption in {region}',
            'Minor Ransomware Attack in {region}',
            'Small-Scale Phishing Campaign in {region}',
            'Local Government Website Hack in {region}',
            'Minor DDoS Attack on {region} Services',
            'Small Business Cyber Incident in {region}',
            'Local School District Hack in {region}',
            'Minor Healthcare Data Breach in {region}',
            'Email System Compromise in {region}',
            'Minor Banking System Glitch in {region}',
            'Local WiFi Network Breach in {region}',
            'Small Social Media Account Hack in {region}',
            'Minor Credit Card Skimming in {region}',
            'Local Database Corruption in {region}',
            'Small Identity Theft Ring in {region}',
            'Minor Online Shopping Fraud in {region}',
            'Local Password Database Leak in {region}',
            'Small Cryptocurrency Theft in {region}',
            'Minor Mobile App Vulnerability in {region}',
            'Local Cloud Storage Breach in {region}',
            'Small Tech Support Scam in {region}',
            'Minor Smart Device Hack in {region}',
            'Local Internet Service Disruption in {region}',
            'Small Online Banking Fraud in {region}',
            'Minor Digital Wallet Compromise in {region}',
            'Local Surveillance System Hack in {region}',
            'Small GPS Tracking Breach in {region}',
            'Minor Voice Assistant Compromise in {region}'
          ],
          descriptions: [
            'A minor cyber incident has affected local government systems in {region}, causing temporary service disruptions. {casualties} residents experienced delays in accessing online services. Recovery costs total {cost}.',
            'A small data breach has compromised personal information of {casualties} residents in {region}. Local businesses and services are working to restore security. Total impact estimated at {cost}.',
            'Network disruptions have affected internet and phone services across parts of {region}. {casualties} people experienced connectivity issues. Service restoration and security upgrades cost {cost}.',
            'A minor ransomware attack targeted several small businesses in {region}, encrypting files and demanding payment. {casualties} employees were affected. Recovery and security improvements total {cost}.',
            'A phishing campaign targeted residents of {region}, attempting to steal personal information. {casualties} people were affected by identity theft attempts. Mitigation efforts cost {cost}.',
            'Local government websites in {region} were compromised by hackers, exposing citizen data. {casualties} residents are affected by the breach. Security upgrades cost {cost}.',
            'A DDoS attack temporarily shut down online services in {region}, affecting {casualties} users. Service restoration and protection measures cost {cost}.',
            'Small businesses in {region} experienced cyber attacks affecting their payment systems. {casualties} customers had their data compromised. Security improvements cost {cost}.',
            'A school district in {region} suffered a cyber attack compromising student records. {casualties} students and families are affected. System recovery costs {cost}.',
            'Healthcare facilities in {region} experienced a minor data breach affecting patient records. {casualties} patients are impacted. Security enhancements cost {cost}.'
          ],
          timelineTemplates: [
            'Attack duration: 2-4 hours. System restoration: {duration}. Security upgrades: 1-2 weeks.',
            'Incident period: 1-6 hours. Recovery efforts: {duration}. Full security restoration: 3-7 days.',
            'Breach duration: 3-8 hours. Containment: {duration}. System hardening: 1-3 weeks.',
            'Cyber event: 1-4 hours. Response efforts: {duration}. Prevention measures: 2-4 weeks.'
          ],
          casualtyRanges: { min: 10, max: 100 },
          costRanges: { min: 5, max: 50 }
        },
        {
          category: 'infrastructure',
          titles: [
            'Minor Power Outage in {region}',
            'Small Water Main Break in {region}',
            'Local Bridge Closure in {region}',
            'Minor Gas Line Leak in {region}',
            'Small Telecommunications Outage in {region}',
            'Local Road Collapse in {region}',
            'Minor Sewage System Backup in {region}',
            'Small Airport Closure in {region}',
            'Local Train Service Disruption in {region}',
            'Minor Port Operations Halt in {region}',
            'Traffic Light System Failure in {region}',
            'Minor Elevator Malfunction in {region}',
            'Small Parking Garage Collapse in {region}',
            'Local Fiber Optic Cable Cut in {region}',
            'Minor Dam Inspection Closure in {region}',
            'Small Tunnel Lighting Failure in {region}',
            'Local Cell Tower Malfunction in {region}',
            'Minor Pipeline Pressure Drop in {region}',
            'Small Electrical Substation Fire in {region}',
            'Local Water Treatment Issue in {region}',
            'Minor Highway Overpass Crack in {region}',
            'Small Radio Tower Collapse in {region}',
            'Local Streetlight Grid Failure in {region}',
            'Minor Waste Treatment Backup in {region}',
            'Small Construction Crane Failure in {region}',
            'Local Internet Hub Outage in {region}',
            'Minor Building HVAC Failure in {region}',
            'Small Parking Meter System Down in {region}',
            'Local Emergency Siren Malfunction in {region}',
            'Minor Public Transit Delay in {region}'
          ],
          descriptions: [
            'A minor power outage has affected parts of {region}, leaving {casualties} residents without electricity. Utility crews are working to restore service. Economic impact totals {cost}.',
            'A water main break has disrupted service to {casualties} customers in {region}. Emergency repairs are underway with temporary water distribution points established. Repair costs reach {cost}.',
            'A local bridge in {region} has been closed due to structural concerns, affecting {casualties} daily commuters. Traffic is being rerouted while repairs costing {cost} are completed.',
            'A minor gas line leak has prompted evacuations of {casualties} residents in {region}. Emergency crews have contained the leak and repairs are underway. Total costs amount to {cost}.',
            'Telecommunications infrastructure has failed in parts of {region}, affecting {casualties} customers. Service restoration efforts are underway. Repair costs total {cost}.',
            'A section of local road has collapsed in {region}, affecting {casualties} commuters and residents. Emergency detours are in place while repairs costing {cost} proceed.',
            'Sewage system backups have affected {casualties} properties in {region}. Emergency cleanup and repair crews are responding. Total costs reach {cost}.',
            'A small regional airport in {region} has temporarily closed due to equipment failure, affecting {casualties} travelers. Repairs and rebooking costs amount to {cost}.',
            'Local train services in {region} are disrupted due to signal failures, affecting {casualties} commuters. Alternative transportation and repairs cost {cost}.',
            'Port operations have been halted in {region} due to equipment malfunction, affecting {casualties} workers and cargo operations. Repair costs total {cost}.'
          ],
          timelineTemplates: [
            'Outage duration: 2-8 hours. Repair work: {duration}. Full restoration: 1-3 days.',
            'Service disruption: 4-12 hours. Emergency repairs: {duration}. Complete fix: 2-5 days.',
            'Infrastructure failure: 1-6 hours. Assessment: {duration}. Repair completion: 3-7 days.',
            'System malfunction: 2-10 hours. Emergency response: {duration}. Service restoration: 1-4 days.'
          ],
          casualtyRanges: { min: 50, max: 500 },
          costRanges: { min: 25, max: 200 }
        },
        {
          category: 'pandemic',
          titles: [
            'Minor Disease Outbreak in {region}',
            'Small Food Poisoning Incident in {region}',
            'Local Flu Surge in {region}',
            'Minor Norovirus Outbreak in {region}',
            'Small Respiratory Illness Cluster in {region}',
            'Local Stomach Bug Outbreak in {region}',
            'Minor Skin Infection Spread in {region}',
            'Small Eye Infection Cluster in {region}',
            'Local Cold and Cough Surge in {region}',
            'Minor Allergic Reaction Wave in {region}',
            'Small Bacterial Infection in {region}',
            'Local Viral Gastroenteritis in {region}',
            'Minor Conjunctivitis Outbreak in {region}',
            'Small Strep Throat Cluster in {region}',
            'Local Ear Infection Surge in {region}',
            'Minor Rash Outbreak in {region}',
            'Small Sinus Infection Wave in {region}',
            'Local Headache Epidemic in {region}',
            'Minor Fatigue Syndrome in {region}',
            'Small Fever Cluster in {region}',
            'Local Nausea Outbreak in {region}',
            'Minor Dizziness Wave in {region}',
            'Small Cough Epidemic in {region}',
            'Local Sore Throat Surge in {region}',
            'Minor Body Ache Cluster in {region}',
            'Small Runny Nose Outbreak in {region}',
            'Local Sneezing Wave in {region}',
            'Minor Congestion Epidemic in {region}',
            'Small Weakness Syndrome in {region}',
            'Local Chills Outbreak in {region}'
          ],
          descriptions: [
            'A minor disease outbreak has been reported in {region}, affecting {casualties} individuals. Health officials are monitoring the situation and implementing containment measures. Healthcare costs total {cost}.',
            'A food poisoning incident has affected {casualties} people in {region} after consuming contaminated food from a local establishment. Health services are providing treatment. Total costs reach {cost}.',
            'A local flu surge has overwhelmed clinics in {region}, affecting {casualties} residents. Additional medical staff and resources are being deployed. Healthcare costs amount to {cost}.',
            'A norovirus outbreak has spread through {region}, affecting {casualties} people with gastrointestinal symptoms. Sanitation and treatment efforts cost {cost}.',
            'A cluster of respiratory illness has been identified in {region}, affecting {casualties} individuals. Health monitoring and treatment programs cost {cost}.',
            'A stomach bug outbreak has affected {casualties} residents in {region}. Public health measures and medical treatment cost {cost}.',
            'Skin infections have spread among {casualties} people in {region}. Dermatological treatment and prevention measures cost {cost}.',
            'An eye infection cluster has affected {casualties} individuals in {region}. Ophthalmological care and prevention efforts cost {cost}.',
            'A surge in cold and cough cases has affected {casualties} residents in {region}. Additional medical supplies and treatment cost {cost}.',
            'Allergic reactions have affected {casualties} people in {region} due to environmental factors. Treatment and investigation costs reach {cost}.'
          ],
          timelineTemplates: [
            'Outbreak duration: 1-2 weeks. Containment efforts: {duration}. Full recovery: 3-4 weeks.',
            'Incident period: 3-7 days. Treatment phase: {duration}. Complete resolution: 2-3 weeks.',
            'Health emergency: 5-10 days. Medical response: {duration}. System normalization: 4-6 weeks.',
            'Disease spread: 1-3 weeks. Public health response: {duration}. Community recovery: 2-5 weeks.'
          ],
          casualtyRanges: { min: 20, max: 200 },
          costRanges: { min: 15, max: 150 }
        },
        {
          category: 'economic',
          titles: [
            'Minor Market Volatility in {region}',
            'Small Business Closure Wave in {region}',
            'Local Currency Fluctuation in {region}',
            'Minor Trade Disruption in {region}',
            'Small Agricultural Price Drop in {region}',
            'Local Stock Market Dip in {region}',
            'Minor Real Estate Decline in {region}',
            'Small Retail Sales Drop in {region}',
            'Local Employment Decrease in {region}',
            'Minor Tourism Revenue Loss in {region}',
            'Small Manufacturing Slowdown in {region}',
            'Local Service Sector Decline in {region}',
            'Minor Construction Delays in {region}',
            'Small Energy Cost Spike in {region}',
            'Local Transportation Cost Rise in {region}',
            'Minor Food Price Increase in {region}',
            'Small Housing Market Shift in {region}',
            'Local Banking Fee Increase in {region}',
            'Minor Insurance Rate Hike in {region}',
            'Small Tax Revenue Shortfall in {region}',
            'Local Budget Deficit in {region}',
            'Minor Investment Losses in {region}',
            'Small Pension Fund Decline in {region}',
            'Local Credit Rating Drop in {region}',
            'Minor Debt Increase in {region}',
            'Small Savings Rate Decline in {region}',
            'Local Spending Reduction in {region}',
            'Minor Income Stagnation in {region}',
            'Small Profit Margin Squeeze in {region}',
            'Local Economic Uncertainty in {region}'
          ],
          descriptions: [
            'Minor market volatility has affected local businesses in {region}, causing temporary financial stress for {casualties} workers. Economic adjustments are underway with losses totaling {cost}.',
            'A wave of small business closures has impacted {region}, affecting {casualties} employees. Local economic support programs are being implemented. Total economic impact reaches {cost}.',
            'Local currency fluctuations have affected businesses in {region}, impacting {casualties} workers and consumers. Economic stabilization efforts cost {cost}.',
            'Trade disruptions have affected {casualties} workers in {region}. Economic support and adjustment programs cost {cost}.',
            'Agricultural price drops have impacted {casualties} farmers and agricultural workers in {region}. Support programs and subsidies cost {cost}.',
            'Local stock market declines have affected {casualties} investors in {region}. Financial counseling and support services cost {cost}.',
            'Real estate market declines have impacted {casualties} property owners in {region}. Market stabilization efforts cost {cost}.',
            'Retail sales drops have affected {casualties} retail workers in {region}. Business support and retraining programs cost {cost}.',
            'Employment decreases have affected {casualties} workers in {region}. Job placement and support services cost {cost}.',
            'Tourism revenue losses have impacted {casualties} hospitality workers in {region}. Industry support programs cost {cost}.'
          ],
          timelineTemplates: [
            'Market adjustment: 1-2 weeks. Stabilization efforts: {duration}. Recovery period: 1-2 months.',
            'Economic disruption: 2-4 weeks. Support measures: {duration}. Full recovery: 2-3 months.',
            'Financial impact: 1-3 weeks. Intervention programs: {duration}. Market stabilization: 6-12 weeks.',
            'Economic decline: 2-6 weeks. Recovery efforts: {duration}. Business normalization: 2-4 months.'
          ],
          casualtyRanges: { min: 100, max: 1000 },
          costRanges: { min: 50, max: 500 }
        },
        {
          category: 'war',
          titles: [
            'Border Tension with Canada Affects {region}',
            'Mexican Cartel Activity Near {region}',
            'Naval Dispute with China Impacts {region}',
            'Russian Military Activity Concerns {region}',
            'Iranian Proxy Conflict Affects {region}',
            'North Korean Missile Test Impacts {region}',
            'European Trade Dispute Affects {region}',
            'Middle East Conflict Impacts {region}',
            'Chinese Trade War Affects {region}',
            'Cuban Refugee Crisis Impacts {region}',
            'Venezuelan Crisis Affects {region}',
            'Brazilian Border Dispute Near {region}',
            'Japanese Maritime Dispute Impacts {region}',
            'South Korean Alliance Issue Affects {region}',
            'Indian Ocean Conflict Impacts {region}',
            'African Peacekeeping Mission from {region}',
            'Australian Defense Pact Affects {region}',
            'NATO Article 5 Activation Impacts {region}',
            'UN Peacekeeping Deployment from {region}',
            'International Sanctions Affect {region}'
          ],
          descriptions: [
            'Border tensions with Canada have created security concerns affecting {region}, impacting {casualties} military personnel and local residents. Enhanced security measures are in place. Economic impact totals {cost}.',
            'Mexican cartel activity near the border has affected security operations in {region}, impacting {casualties} law enforcement and military personnel. Counter-narcotics operations cost {cost}.',
            'Naval disputes in the Pacific with China have created tension affecting military operations in {region}, impacting {casualties} personnel. Defense preparations cost {cost}.',
            'Russian military activity has raised security concerns affecting {region}, with {casualties} military and civilian personnel impacted. Defense readiness measures cost {cost}.',
            'Conflict involving Iranian proxies has affected military deployments from {region}, impacting {casualties} service members and their families. Support operations cost {cost}.',
            'North Korean missile tests have prompted increased security measures affecting {region}, with {casualties} military personnel on high alert. Defense preparations cost {cost}.',
            'A trade dispute with European nations has created economic tensions affecting {region}, impacting {casualties} workers and businesses. Economic adjustments cost {cost}.',
            'Middle East conflicts have required military support from {region}, affecting {casualties} deployed personnel and their families. Mission support costs reach {cost}.',
            'Trade war tensions with China have affected businesses and workers in {region}, impacting {casualties} people. Economic support measures cost {cost}.',
            'A refugee crisis from Cuba has created humanitarian challenges for {region}, affecting {casualties} people. Relief operations cost {cost}.'
          ],
          timelineTemplates: [
            'Incident duration: 1-3 days. Security response: {duration}. Normalization: 1-2 weeks.',
            'Disruption period: 2-5 days. Resolution efforts: {duration}. Full restoration: 2-3 weeks.',
            'Conflict impact: 3-7 days. Military response: {duration}. Stabilization: 2-4 weeks.',
            'Crisis duration: 1-2 weeks. Emergency measures: {duration}. Recovery: 1-2 months.'
          ],
          casualtyRanges: { min: 25, max: 250 },
          costRanges: { min: 30, max: 300 },
          proximityFactors: { near: 1.5, far: 0.8 }
        },
        {
          category: 'famine',
          titles: [
            'Minor Food Shortage in {region}',
            'Small Crop Failure in {region}',
            'Local Food Distribution Issue in {region}',
            'Minor Agricultural Crisis in {region}',
            'Small Livestock Disease in {region}',
            'Local Grocery Supply Disruption in {region}',
            'Minor Fishing Industry Decline in {region}',
            'Small Dairy Production Drop in {region}',
            'Local Meat Processing Issue in {region}',
            'Minor Vegetable Shortage in {region}',
            'Small Fruit Harvest Failure in {region}',
            'Local Grain Storage Problem in {region}',
            'Minor Poultry Disease Outbreak in {region}',
            'Small Cattle Health Issue in {region}',
            'Local Pig Farm Contamination in {region}',
            'Minor Sheep Disease Spread in {region}',
            'Small Bee Colony Collapse in {region}',
            'Local Aquaculture Problem in {region}',
            'Minor Seed Supply Shortage in {region}',
            'Small Fertilizer Shortage in {region}',
            'Local Pesticide Shortage in {region}',
            'Minor Farm Equipment Failure in {region}',
            'Small Irrigation System Issue in {region}',
            'Local Food Processing Delay in {region}',
            'Minor Restaurant Supply Chain Issue in {region}',
            'Small School Lunch Program Disruption in {region}',
            'Local Food Bank Shortage in {region}',
            'Minor Farmers Market Closure in {region}',
            'Small Food Truck Permit Issue in {region}',
            'Local Community Garden Problem in {region}'
          ],
          descriptions: [
            'A minor food shortage has developed in {region} due to supply chain disruptions, affecting {casualties} residents. Emergency food distribution is underway. Total costs amount to {cost}.',
            'A small crop failure has impacted local farmers in {region}, affecting food supplies for {casualties} people. Agricultural support programs are being implemented. Economic losses reach {cost}.',
            'Food distribution issues have affected {casualties} residents in {region}. Emergency food programs and logistics improvements cost {cost}.',
            'An agricultural crisis has impacted {casualties} farmers and consumers in {region}. Support programs and crop assistance cost {cost}.',
            'Livestock disease has affected {casualties} farmers and meat supplies in {region}. Veterinary care and compensation programs cost {cost}.',
            'Grocery supply disruptions have affected {casualties} shoppers in {region}. Alternative supply chains and emergency food distribution cost {cost}.',
            'Fishing industry declines have impacted {casualties} fishermen and seafood supplies in {region}. Industry support and alternative protein programs cost {cost}.',
            'Dairy production drops have affected {casualties} consumers in {region}. Emergency milk supplies and farmer support cost {cost}.',
            'Meat processing issues have impacted {casualties} consumers and workers in {region}. Alternative processing and safety measures cost {cost}.',
            'Vegetable shortages have affected {casualties} consumers in {region}. Emergency produce distribution and farmer support cost {cost}.'
          ],
          timelineTemplates: [
            'Shortage period: 2-4 weeks. Relief efforts: {duration}. Supply restoration: 1-2 months.',
            'Crisis duration: 1-3 weeks. Emergency response: {duration}. Full recovery: 6-8 weeks.',
            'Food emergency: 3-6 weeks. Distribution efforts: {duration}. System recovery: 2-3 months.',
            'Agricultural issue: 2-8 weeks. Support programs: {duration}. Production recovery: 3-6 months.'
          ],
          casualtyRanges: { min: 50, max: 500 },
          costRanges: { min: 20, max: 200 }
        },
        {
          category: 'death',
          titles: [
            'Tragic Accident Claims Lives in {region}',
            'Fatal Incident Shocks {region}'
          ],
          descriptions: [
            'A tragic accident has claimed {casualties} lives in {region}, sending shockwaves through the community. Emergency services responded immediately but were unable to prevent the casualties. The incident has prompted safety reviews costing {cost}.',
            'A fatal incident has resulted in {casualties} deaths in {region}, devastating families and the local community. Investigations are underway to determine the cause. Support services and safety improvements cost {cost}.'
          ],
          timelineTemplates: [
            'Incident duration: 1-2 hours. Emergency response: {duration}. Investigation: 2-4 weeks.',
            'Tragic event: immediate. Rescue efforts: {duration}. Community support: ongoing.'
          ],
          casualtyRanges: { min: 1, max: 10 },
          costRanges: { min: 1, max: 10 }
        }
      ],
      
      small: [
        {
          category: 'natural',
          titles: [
            'Moderate Earthquake Strikes {region}',
            'Wildfire Emergency in {region}',
            'Flash Flood Warning in {region}',
            'Severe Winter Storm in {region}',
            'Tornado Outbreak in {region}',
            'Significant Landslide in {region}',
            'Major Hailstorm Devastates {region}',
            'Drought Conditions Worsen in {region}',
            'Coastal Storm Surge in {region}',
            'Significant Sinkhole Formation in {region}',
            'Severe Ice Storm in {region}',
            'Volcanic Ash Cloud Affects {region}',
            'Major Dust Storm in {region}',
            'Significant Avalanche in {region}',
            'Severe Heat Wave in {region}'
          ],
          descriptions: [
            'A magnitude 5.4 earthquake has struck {region}, causing significant damage to infrastructure and buildings. Emergency services report {casualties} injuries and widespread power outages. Damage assessment indicates {cost} in economic losses.',
            'Multiple wildfires are burning across {region}, consuming over 15,000 acres. Mandatory evacuations are in effect for {casualties} residents. Firefighting operations and property damage costs are estimated at {cost}.',
            'Severe flooding has inundated {region} following record rainfall. {casualties} people have been evacuated from flood zones. Infrastructure damage and economic losses total {cost}.',
            'A severe winter storm has paralyzed {region} with heavy snow and ice. {casualties} residents are without power or heat. Emergency response and recovery costs reach {cost}.',
            'A tornado outbreak has struck {region}, with multiple EF2-EF3 tornadoes causing widespread damage. {casualties} people are affected by destroyed homes and businesses. Total damages amount to {cost}.',
            'A significant landslide has blocked major transportation routes in {region}, affecting {casualties} residents and commuters. Cleanup and infrastructure repair costs total {cost}.',
            'A major hailstorm with baseball-sized hail has devastated {region}, causing extensive property damage. {casualties} people are affected by damaged vehicles and structures. Economic losses reach {cost}.',
            'Drought conditions have significantly worsened in {region}, affecting agriculture and water supplies. {casualties} farmers and residents face water restrictions. Economic impact totals {cost}.',
            'A coastal storm surge has flooded low-lying areas of {region}, forcing {casualties} residents to evacuate. Flood damage and recovery costs are estimated at {cost}.',
            'A significant sinkhole has opened in {region}, swallowing buildings and infrastructure. {casualties} people have been evacuated from the danger zone. Repair and relocation costs total {cost}.'
          ],
          timelineTemplates: [
            'Emergency phase: 12-24 hours. Active response: {duration}. Recovery period: 2-4 weeks.',
            'Event duration: {duration}. Evacuation period: 3-7 days. Full recovery: 3-6 weeks.',
            'Crisis phase: 1-3 days. Emergency operations: {duration}. Complete restoration: 4-8 weeks.'
          ],
          casualtyRanges: { min: 25, max: 200 },
          costRanges: { min: 100, max: 500 }
        },
        {
          category: 'cyber',
          titles: [
            'Regional Cyber Attack Hits {region}',
            'Data Breach Affects {region} Systems',
            'Cyber Incident Disrupts {region} Services',
            'Ransomware Attack Cripples {region}',
            'Major Phishing Campaign in {region}',
            'Government Systems Hack in {region}',
            'Healthcare Cyber Attack in {region}',
            'Financial Services Breach in {region}',
            'Educational Network Compromise in {region}',
            'Utility Systems Cyber Incident in {region}',
            'Transportation Network Hack in {region}',
            'Supply Chain Cyber Attack in {region}'
          ],
          descriptions: [
            'A coordinated cyber attack has targeted government and business systems across {region}, causing temporary service disruptions and data compromises. {casualties} people are affected by system outages. Economic losses reach {cost}.',
            'A significant data breach has compromised personal information and disrupted digital services across {region}. {casualties} individuals are impacted by this cyber incident. Total damages amount to {cost}.',
            'A ransomware attack has encrypted critical systems across {region}, demanding payment for data recovery. {casualties} businesses and residents are affected. Recovery and security costs total {cost}.',
            'A sophisticated phishing campaign has targeted residents and businesses in {region}, stealing credentials and financial information. {casualties} people are victims of identity theft. Mitigation costs reach {cost}.',
            'Government computer systems in {region} have been compromised by hackers, exposing sensitive data. {casualties} citizens are affected by the breach. Security upgrades and response costs total {cost}.',
            'A cyber attack on healthcare systems in {region} has disrupted patient care and exposed medical records. {casualties} patients are affected by service interruptions. Recovery costs amount to {cost}.'
          ],
          timelineTemplates: [
            'Attack duration: 2-6 hours. System restoration: 1-3 days. Full recovery: 1-2 weeks.',
            'Incident period: 4-12 hours. Service restoration: 2-5 days. Security upgrades: 2-4 weeks.',
            'Breach duration: 6-18 hours. Containment efforts: 3-7 days. Complete recovery: 3-6 weeks.'
          ],
          casualtyRanges: { min: 100, max: 1000 },
          costRanges: { min: 50, max: 500 }
        },
        {
          category: 'infrastructure',
          titles: [
            'Power Grid Failure Affects {region}',
            'Transportation Disruption in {region}',
            'Water System Issues Impact {region}',
            'Major Bridge Collapse in {region}',
            'Telecommunications Outage in {region}',
            'Gas Pipeline Rupture in {region}',
            'Sewage Treatment Failure in {region}',
            'Airport Operations Suspended in {region}',
            'Rail System Breakdown in {region}',
            'Port Closure Affects {region}',
            'Highway System Failure in {region}',
            'Internet Infrastructure Down in {region}'
          ],
          descriptions: [
            'A power grid failure has caused widespread blackouts across {region}, affecting businesses and residents. {casualties} people are without electricity. Economic losses total {cost}.',
            'Transportation infrastructure problems have disrupted travel and commerce in {region}. {casualties} people are affected by service interruptions. Economic impact reaches {cost}.',
            'Water treatment facilities in {region} have failed, leaving {casualties} residents without clean water. Emergency water distribution is underway. Repair costs total {cost}.',
            'A major bridge collapse has severed a critical transportation link in {region}, affecting {casualties} daily commuters. Emergency repairs and rerouting costs reach {cost}.',
            'Telecommunications infrastructure has failed across {region}, leaving {casualties} people without phone or internet service. Service restoration costs amount to {cost}.',
            'A gas pipeline rupture has forced evacuations of {casualties} residents in {region}. Emergency repairs and safety measures cost {cost}.'
          ],
          timelineTemplates: [
            'Outage duration: 4-12 hours. Repairs: 1-3 days. Full restoration: 1 week.',
            'Disruption period: 6-18 hours. Emergency fixes: 2-4 days. Complete repair: 2-3 weeks.',
            'System failure: 8-24 hours. Restoration efforts: 3-7 days. Full recovery: 1-2 weeks.'
          ],
          casualtyRanges: { min: 200, max: 2000 },
          costRanges: { min: 75, max: 750 }
        },
        {
          category: 'pandemic',
          titles: [
            'Disease Outbreak Spreads in {region}',
            'Food Contamination Crisis in {region}',
            'Respiratory Illness Surge in {region}',
            'Hospital System Strain in {region}',
            'Vaccine-Preventable Disease in {region}',
            'Waterborne Illness Outbreak in {region}',
            'Infectious Disease Cluster in {region}',
            'Public Health Emergency in {region}'
          ],
          descriptions: [
            'A disease outbreak has spread across {region}, affecting {casualties} individuals. Health officials have declared a public health emergency and are implementing containment measures. Healthcare costs total {cost}.',
            'A food contamination crisis has sickened {casualties} people across {region}. Multiple establishments have been closed and investigations are underway. Treatment and response costs reach {cost}.',
            'A surge in respiratory illness has overwhelmed healthcare facilities in {region}, affecting {casualties} patients. Additional medical resources are being deployed. Total costs amount to {cost}.',
            'Hospital systems in {region} are experiencing severe strain due to a sudden influx of {casualties} patients. Emergency medical protocols are in effect. Healthcare costs total {cost}.'
          ],
          timelineTemplates: [
            'Outbreak duration: 2-4 weeks. Containment efforts: {duration}. Full recovery: 6-8 weeks.',
            'Crisis period: 1-3 weeks. Treatment phase: {duration}. Complete resolution: 4-6 weeks.',
            'Emergency phase: 3-6 weeks. Recovery efforts: {duration}. System normalization: 8-12 weeks.'
          ],
          casualtyRanges: { min: 200, max: 2000 },
          costRanges: { min: 150, max: 1500 }
        },
        {
          category: 'economic',
          titles: [
            'Regional Economic Downturn in {region}',
            'Major Business Failures in {region}',
            'Market Crash Affects {region}',
            'Trade War Impact on {region}',
            'Currency Devaluation in {region}',
            'Banking Crisis Hits {region}',
            'Real Estate Market Collapse in {region}',
            'Agricultural Market Crash in {region}',
            'Energy Price Spike in {region}',
            'Manufacturing Shutdown in {region}'
          ],
          descriptions: [
            'A regional economic downturn has severely impacted {region}, with {casualties} workers facing unemployment. Emergency economic measures are being implemented. Total economic losses reach {cost}.',
            'Major business failures have created a crisis in {region}, affecting {casualties} employees and their families. Government support programs are being activated. Economic impact totals {cost}.',
            'A market crash has devastated investments and retirement funds in {region}, affecting {casualties} individuals. Financial recovery programs are underway. Losses amount to {cost}.',
            'Trade war impacts have severely affected businesses in {region}, with {casualties} workers facing layoffs. Economic support measures are being considered. Total impact reaches {cost}.'
          ],
          timelineTemplates: [
            'Economic decline: 2-6 weeks. Intervention measures: {duration}. Recovery period: 6-12 months.',
            'Crisis duration: 1-2 months. Support programs: {duration}. Economic stabilization: 8-18 months.',
            'Market disruption: 3-8 weeks. Recovery efforts: {duration}. Full restoration: 12-24 months.'
          ],
          casualtyRanges: { min: 1000, max: 10000 },
          costRanges: { min: 500, max: 5000 }
        },
        {
          category: 'war',
          titles: [
            'Military Conflict Near {region}',
            'Defense Contractor Crisis in {region}',
            'Veterans Healthcare Crisis in {region}',
            'Military Base Emergency in {region}',
            'Border Security Incident in {region}',
            'Military Equipment Failure in {region}',
            'Defense Industry Disruption in {region}',
            'Military Personnel Crisis in {region}'
          ],
          descriptions: [
            'A military conflict near {region} has created security concerns and affected {casualties} military personnel and civilians. Enhanced security measures are in place. Economic impact totals {cost}.',
            'A defense contractor crisis has disrupted military operations affecting {region}, impacting {casualties} workers and service members. Emergency contracts are being negotiated. Costs reach {cost}.',
            'A veterans healthcare crisis has overwhelmed facilities in {region}, affecting {casualties} veterans. Additional medical resources are being deployed. Healthcare costs total {cost}.',
            'A military base emergency has affected operations in {region}, impacting {casualties} personnel and local residents. Security protocols are being enhanced. Response costs amount to {cost}.'
          ],
          timelineTemplates: [
            'Conflict duration: 1-2 weeks. Security response: {duration}. Normalization: 4-8 weeks.',
            'Crisis period: 2-4 weeks. Resolution efforts: {duration}. Full restoration: 6-12 weeks.',
            'Emergency phase: 1-3 weeks. Recovery operations: {duration}. Complete recovery: 8-16 weeks.'
          ],
          casualtyRanges: { min: 250, max: 2500 },
          costRanges: { min: 300, max: 3000 },
          proximityFactors: { near: 1.8, far: 0.6 }
        },
        {
          category: 'famine',
          titles: [
            'Food Shortage Crisis in {region}',
            'Crop Failure Devastates {region}',
            'Food Distribution Breakdown in {region}',
            'Agricultural Disaster in {region}',
            'Livestock Disease Outbreak in {region}',
            'Food Supply Chain Collapse in {region}',
            'Severe Malnutrition Crisis in {region}',
            'Food Security Emergency in {region}'
          ],
          descriptions: [
            'A food shortage crisis has developed in {region} due to multiple supply chain failures, affecting {casualties} residents. Emergency food distribution centers have been established. Total costs amount to {cost}.',
            'Widespread crop failures have devastated agricultural production in {region}, affecting food supplies for {casualties} people. Federal agricultural disaster relief is being deployed. Economic losses reach {cost}.',
            'The food distribution system has broken down in {region}, leaving {casualties} people without adequate access to nutrition. Emergency food programs are being implemented. Response costs total {cost}.',
            'An agricultural disaster has destroyed crops and livestock in {region}, affecting {casualties} farmers and consumers. Disaster relief and food assistance programs cost {cost}.'
          ],
          timelineTemplates: [
            'Shortage period: 4-8 weeks. Relief efforts: {duration}. Supply restoration: 3-6 months.',
            'Crisis duration: 2-6 weeks. Emergency response: {duration}. Full recovery: 4-8 months.',
            'Food emergency: 6-12 weeks. Distribution efforts: {duration}. System recovery: 6-12 months.'
          ],
          casualtyRanges: { min: 500, max: 5000 },
          costRanges: { min: 200, max: 2000 }
        },
        {
          category: 'death',
          titles: [
            'Major Accident Results in Multiple Fatalities in {region}',
            'Deadly Incident Claims Several Lives in {region}'
          ],
          descriptions: [
            'A major accident has resulted in {casualties} fatalities in {region}, creating a regional tragedy. Emergency services and investigators are working to understand the cause. Community support and safety improvements cost {cost}.',
            'A deadly incident has claimed {casualties} lives in {region}, shocking the regional community. Federal investigators have been called in to determine the cause. Response and prevention measures cost {cost}.'
          ],
          timelineTemplates: [
            'Incident duration: 2-4 hours. Emergency response: {duration}. Investigation: 1-3 months.',
            'Tragic event: 1-6 hours. Rescue operations: {duration}. Community recovery: 6-12 months.'
          ],
          casualtyRanges: { min: 5, max: 50 },
          costRanges: { min: 5, max: 50 }
        }
      ],
      
      medium: [
        {
          category: 'natural',
          titles: [
            'Major Earthquake Devastates {region}',
            'Large-Scale Wildfire Crisis in {region}',
            'Significant Flooding Event in {region}',
            'Destructive Hurricane Impacts {region}',
            'Massive Tornado Outbreak in {region}',
            'Major Landslide Disaster in {region}',
            'Severe Blizzard Paralyzes {region}',
            'Extreme Drought Emergency in {region}',
            'Major Coastal Erosion in {region}',
            'Significant Volcanic Eruption in {region}',
            'Extreme Heat Dome Over {region}',
            'Major Ice Storm Devastates {region}',
            'Severe Dust Storm Engulfs {region}',
            'Large Avalanche Disaster in {region}',
            'Major Sinkhole Complex in {region}'
          ],
          descriptions: [
            'A powerful magnitude 6.8 earthquake has devastated {region}, causing widespread structural damage and infrastructure collapse. Emergency services report {casualties} casualties and extensive damage to critical facilities. Economic impact reaches {cost}.',
            'A massive wildfire complex has burned over 100,000 acres in {region}, destroying communities and critical infrastructure. {casualties} people have been affected by evacuations and smoke exposure. Total economic losses exceed {cost}.',
            'Catastrophic flooding has overwhelmed {region} following dam failures and record precipitation. {casualties} people are affected by the disaster. Infrastructure damage and economic losses total {cost}.',
            'A destructive Category 3 hurricane has made landfall in {region}, bringing devastating winds and storm surge. {casualties} residents are affected by widespread damage. Recovery costs are estimated at {cost}.',
            'A massive tornado outbreak with multiple EF4 tornadoes has devastated {region}, destroying entire neighborhoods. {casualties} people are affected by the unprecedented destruction. Damage totals {cost}.',
            'A major landslide has buried parts of {region}, blocking rivers and destroying infrastructure. {casualties} people are missing or displaced. Search, rescue, and recovery operations cost {cost}.',
            'A severe blizzard has paralyzed {region} with record snowfall and hurricane-force winds. {casualties} people are stranded without power or heat. Emergency response costs reach {cost}.',
            'An extreme drought emergency has gripped {region}, causing widespread crop failures and water shortages. {casualties} people are affected by water restrictions and agricultural losses totaling {cost}.'
          ],
          timelineTemplates: [
            'Crisis phase: 2-5 days. Emergency response: {duration}. Recovery timeline: 3-6 months.',
            'Active disaster period: {duration}. Evacuation duration: 1-3 weeks. Reconstruction: 6-12 months.',
            'Emergency phase: 1-2 weeks. Relief operations: {duration}. Full recovery: 8-18 months.'
          ],
          casualtyRanges: { min: 100, max: 1000 },
          costRanges: { min: 500, max: 2000 }
        },
        {
          category: 'cyber',
          titles: [
            'Major Cyber Warfare Attack on {region}',
            'Critical Infrastructure Hack in {region}',
            'Massive Data Breach Affects {region}',
            'Coordinated Ransomware Campaign in {region}',
            'State-Sponsored Cyber Attack on {region}',
            'Financial System Cyber Crisis in {region}',
            'Healthcare Network Compromise in {region}',
            'Government Systems Infiltration in {region}',
            'Power Grid Cyber Attack in {region}',
            'Transportation Network Hack in {region}'
          ],
          descriptions: [
            'A major cyber warfare attack has targeted critical infrastructure across {region}, causing widespread system failures. {casualties} people are affected by power outages and service disruptions. Economic losses reach {cost}.',
            'Critical infrastructure systems in {region} have been compromised by sophisticated hackers, affecting essential services. {casualties} residents face disruptions to power, water, and communications. Recovery costs total {cost}.',
            'A massive data breach has exposed personal information of {casualties} residents in {region}, compromising government and business databases. Identity protection and system recovery costs amount to {cost}.',
            'A coordinated ransomware campaign has encrypted systems across {region}, demanding millions in payment. {casualties} businesses and residents are affected by service outages. Response and recovery costs reach {cost}.'
          ],
          timelineTemplates: [
            'Attack duration: 1-3 days. System restoration: 1-2 weeks. Full recovery: 1-3 months.',
            'Cyber crisis: 2-7 days. Emergency response: {duration}. Complete security restoration: 2-6 months.',
            'Breach period: 3-10 days. Containment efforts: {duration}. System rebuild: 3-8 months.'
          ],
          casualtyRanges: { min: 1000, max: 10000 },
          costRanges: { min: 500, max: 5000 }
        },
        {
          category: 'infrastructure',
          titles: [
            'Major Infrastructure Collapse in {region}',
            'Critical Systems Failure Across {region}',
            'Transportation Network Breakdown in {region}',
            'Power Grid Catastrophic Failure in {region}',
            'Water System Complete Failure in {region}',
            'Communications Blackout in {region}',
            'Major Dam Failure in {region}',
            'Airport System Shutdown in {region}',
            'Rail Network Collapse in {region}',
            'Port Infrastructure Failure in {region}'
          ],
          descriptions: [
            'Major infrastructure has collapsed across {region}, affecting transportation, utilities, and communications. {casualties} people are impacted by widespread service failures. Reconstruction costs total {cost}.',
            'Critical systems have failed simultaneously across {region}, creating a cascading infrastructure crisis. {casualties} residents are without essential services. Emergency repairs and upgrades cost {cost}.',
            'The transportation network has completely broken down in {region}, stranding {casualties} people and disrupting commerce. Emergency transportation and repair costs reach {cost}.',
            'A catastrophic power grid failure has left {region} in complete darkness, affecting {casualties} residents and businesses. Grid reconstruction and emergency power costs total {cost}.'
          ],
          timelineTemplates: [
            'System failure: 1-2 days. Emergency repairs: {duration}. Full reconstruction: 6-18 months.',
            'Infrastructure collapse: 2-5 days. Restoration efforts: {duration}. Complete rebuild: 12-36 months.',
            'Critical failure: 3-7 days. Emergency response: {duration}. System recovery: 8-24 months.'
          ],
          casualtyRanges: { min: 2000, max: 20000 },
          costRanges: { min: 1000, max: 10000 }
        },
        {
          category: 'pandemic',
          titles: [
            'Major Disease Pandemic in {region}',
            'Healthcare System Collapse in {region}',
            'Widespread Infectious Disease in {region}',
            'Public Health Crisis in {region}',
            'Hospital Overflow Emergency in {region}',
            'Vaccine-Resistant Outbreak in {region}',
            'Multi-State Health Emergency in {region}',
            'Critical Medical Supply Shortage in {region}'
          ],
          descriptions: [
            'A major disease pandemic has spread rapidly across {region}, overwhelming healthcare systems. {casualties} people are infected or affected by service disruptions. Healthcare costs and economic losses total {cost}.',
            'Healthcare systems in {region} have collapsed under the strain of a massive outbreak, affecting {casualties} patients. Emergency medical facilities are being established. Total costs reach {cost}.',
            'A widespread infectious disease has created a public health crisis in {region}, affecting {casualties} individuals. Quarantine measures and medical response efforts cost {cost}.',
            'A public health crisis has overwhelmed medical facilities across {region}, with {casualties} people requiring treatment. Emergency medical resources and response costs total {cost}.'
          ],
          timelineTemplates: [
            'Pandemic phase: 2-6 months. Peak crisis: {duration}. Recovery period: 12-24 months.',
            'Health emergency: 1-4 months. Medical response: {duration}. System recovery: 8-18 months.',
            'Outbreak duration: 3-8 months. Containment efforts: {duration}. Full recovery: 18-36 months.'
          ],
          casualtyRanges: { min: 2000, max: 20000 },
          costRanges: { min: 1500, max: 15000 }
        },
        {
          category: 'economic',
          titles: [
            'Major Economic Recession in {region}',
            'Financial System Collapse in {region}',
            'Mass Business Bankruptcies in {region}',
            'Regional Market Meltdown in {region}',
            'Banking System Crisis in {region}',
            'Currency Collapse Affects {region}',
            'Real Estate Market Crash in {region}',
            'Industrial Sector Collapse in {region}',
            'Agricultural Economy Devastation in {region}',
            'Energy Sector Crisis in {region}'
          ],
          descriptions: [
            'A major economic recession has devastated {region}, with {casualties} workers losing their jobs. Emergency economic measures and unemployment benefits are being deployed. Total economic impact reaches {cost}.',
            'The financial system has collapsed in {region}, affecting {casualties} individuals and businesses. Emergency banking measures and bailout programs are being implemented. Costs total {cost}.',
            'Mass business bankruptcies have created an economic crisis in {region}, affecting {casualties} employees and their families. Economic recovery programs are being established. Losses amount to {cost}.',
            'A regional market meltdown has wiped out investments and savings in {region}, affecting {casualties} people. Financial recovery and support programs cost {cost}.'
          ],
          timelineTemplates: [
            'Economic collapse: 1-3 months. Crisis response: {duration}. Recovery period: 2-5 years.',
            'Financial crisis: 2-6 months. Intervention measures: {duration}. Economic stabilization: 3-7 years.',
            'Market crash: 1-2 months. Support programs: {duration}. Full recovery: 4-10 years.'
          ],
          casualtyRanges: { min: 10000, max: 100000 },
          costRanges: { min: 5000, max: 50000 }
        },
        {
          category: 'war',
          titles: [
            'Regional Military Conflict in {region}',
            'Major Defense Crisis in {region}',
            'Military Infrastructure Attack on {region}',
            'Large-Scale Veterans Crisis in {region}',
            'Defense Industry Collapse in {region}',
            'Military Base Evacuation in {region}',
            'Border War Affects {region}',
            'Military Supply Chain Crisis in {region}'
          ],
          descriptions: [
            'A regional military conflict has escalated near {region}, affecting {casualties} military personnel and civilians. Enhanced security measures and military deployments are underway. Costs total {cost}.',
            'A major defense crisis has impacted military operations in {region}, affecting {casualties} service members and contractors. Emergency military protocols are in effect. Response costs reach {cost}.',
            'Military infrastructure in {region} has been attacked, affecting {casualties} personnel and disrupting operations. Security enhancements and repairs cost {cost}.',
            'A large-scale veterans crisis has overwhelmed support systems in {region}, affecting {casualties} veterans and their families. Emergency assistance programs cost {cost}.'
          ],
          timelineTemplates: [
            'Military crisis: 2-8 weeks. Security response: {duration}. Stabilization: 6-18 months.',
            'Conflict period: 1-3 months. Military operations: {duration}. Recovery phase: 12-36 months.',
            'Defense emergency: 3-12 weeks. Response efforts: {duration}. Full restoration: 8-24 months.'
          ],
          casualtyRanges: { min: 2500, max: 25000 },
          costRanges: { min: 3000, max: 30000 },
          proximityFactors: { near: 2.2, far: 0.4 }
        },
        {
          category: 'famine',
          titles: [
            'Major Food Crisis in {region}',
            'Agricultural Collapse in {region}',
            'Severe Malnutrition Emergency in {region}',
            'Food System Breakdown in {region}',
            'Widespread Crop Failure in {region}',
            'Livestock Disease Pandemic in {region}',
            'Food Distribution Crisis in {region}',
            'Nutritional Emergency in {region}'
          ],
          descriptions: [
            'A major food crisis has developed in {region} due to widespread agricultural failures, affecting {casualties} residents. Emergency food distribution and agricultural aid programs are being deployed. Total costs amount to {cost}.',
            'Agricultural systems have collapsed across {region}, creating food shortages for {casualties} people. Federal disaster relief and food assistance programs are being implemented. Economic losses reach {cost}.',
            'A severe malnutrition emergency has developed in {region}, affecting {casualties} individuals, particularly children and elderly. Emergency nutrition programs and medical care cost {cost}.',
            'The food system has broken down across {region}, leaving {casualties} people without adequate nutrition. Emergency food programs and system reconstruction costs total {cost}.'
          ],
          timelineTemplates: [
            'Food crisis: 3-8 months. Emergency response: {duration}. Agricultural recovery: 12-36 months.',
            'Famine period: 2-6 months. Relief efforts: {duration}. Food system rebuild: 18-48 months.',
            'Nutritional emergency: 4-12 months. Aid programs: {duration}. Complete recovery: 24-60 months.'
          ],
          casualtyRanges: { min: 5000, max: 50000 },
          costRanges: { min: 2000, max: 20000 }
        },
        {
          category: 'death',
          titles: [
            'Catastrophic Accident Results in Mass Casualties in {region}',
            'Deadly Disaster Claims Dozens of Lives in {region}'
          ],
          descriptions: [
            'A catastrophic accident has resulted in {casualties} fatalities in {region}, creating a state-wide tragedy. Federal emergency management and investigators are coordinating the response. Community support and comprehensive safety overhauls cost {cost}.',
            'A deadly disaster has claimed {casualties} lives in {region}, prompting a federal investigation. The incident has led to calls for major safety reforms and victim support programs costing {cost}.'
          ],
          timelineTemplates: [
            'Disaster duration: 4-12 hours. Emergency response: {duration}. Investigation: 3-12 months.',
            'Tragic event: 2-8 hours. Rescue operations: {duration}. Community recovery: 1-3 years.'
          ],
          casualtyRanges: { min: 25, max: 250 },
          costRanges: { min: 25, max: 250 }
        }
      ],
      
      large: [
        {
          category: 'natural',
          titles: [
            'Catastrophic Earthquake Strikes {region}',
            'Massive Wildfire Disaster in {region}',
            'Extreme Flooding Crisis in {region}',
            'Major Hurricane Devastation in {region}',
            'Historic Tornado Super Outbreak in {region}',
            'Catastrophic Landslide Complex in {region}',
            'Extreme Blizzard Emergency in {region}',
            'Severe Drought Catastrophe in {region}',
            'Major Volcanic Eruption in {region}',
            'Extreme Weather Multi-Hazard Event in {region}',
            'Historic Ice Storm Disaster in {region}',
            'Massive Dust Bowl Event in {region}',
            'Major Avalanche Disaster in {region}',
            'Catastrophic Sinkhole Formation in {region}',
            'Extreme Heat Emergency in {region}'
          ],
          descriptions: [
            'A devastating magnitude 7.5 earthquake has struck {region}, causing catastrophic damage across multiple states. {casualties} people are confirmed affected with widespread infrastructure collapse. Economic losses are estimated at {cost}.',
            'An unprecedented wildfire disaster has consumed over 500,000 acres across {region}, creating a regional emergency. {casualties} people have been evacuated or affected. Total economic impact reaches {cost}.',
            'Extreme flooding has created a humanitarian crisis across {region}, with multiple river systems overflowing. {casualties} people are displaced or affected. Infrastructure damage totals {cost}.',
            'A major Category 4 hurricane has devastated {region}, bringing catastrophic winds and historic storm surge. {casualties} residents are affected by unprecedented destruction. Recovery costs exceed {cost}.',
            'A historic tornado super outbreak with multiple EF5 tornadoes has devastated {region}, destroying entire cities. {casualties} people are affected by the unprecedented destruction. Damage totals {cost}.',
            'A catastrophic landslide complex has buried large areas of {region}, damming rivers and destroying communities. {casualties} people are missing or displaced. Search and recovery operations cost {cost}.',
            'An extreme blizzard has created a regional emergency in {region} with record snowfall and life-threatening conditions. {casualties} people are stranded in dangerous conditions. Emergency response costs reach {cost}.',
            'A severe drought catastrophe has created a multi-state emergency in {region}, causing widespread crop failures and water crises. {casualties} people are affected by water shortages and agricultural devastation totaling {cost}.'
          ],
          timelineTemplates: [
            'Disaster phase: 1-2 weeks. Emergency operations: {duration}. Recovery period: 1-2 years.',
            'Crisis duration: {duration}. Mass evacuation: 2-6 weeks. Rebuilding timeline: 12-24 months.',
            'Catastrophic phase: 2-4 weeks. Relief operations: {duration}. Full recovery: 18-48 months.'
          ],
          casualtyRanges: { min: 500, max: 5000 },
          costRanges: { min: 2000, max: 10000 }
        },
        {
          category: 'cyber',
          titles: [
            'Massive Cyber Warfare Campaign Against {region}',
            'Critical National Infrastructure Hack in {region}',
            'State-Sponsored Cyber Attack Devastates {region}',
            'Major Financial System Cyber Crisis in {region}',
            'Healthcare Network Cyber Catastrophe in {region}',
            'Government Systems Cyber Warfare in {region}',
            'Power Grid Cyber Attack Cripples {region}',
            'Transportation Cyber Crisis in {region}',
            'Communications Network Cyber Attack in {region}',
            'Multi-Sector Cyber Warfare in {region}'
          ],
          descriptions: [
            'A massive cyber warfare campaign has targeted all critical infrastructure in {region}, causing widespread system failures and chaos. {casualties} people are affected by complete service breakdowns. Economic losses reach {cost}.',
            'Critical national infrastructure has been compromised by sophisticated nation-state hackers in {region}, affecting power, water, and communications. {casualties} residents face life-threatening service disruptions. Recovery costs total {cost}.',
            'A state-sponsored cyber attack has devastated digital infrastructure across {region}, crippling government and business operations. {casualties} people are affected by widespread system failures. Response and recovery costs amount to {cost}.',
            'The financial system has been crippled by a major cyber attack in {region}, affecting banking, markets, and payment systems. {casualties} individuals and businesses face financial chaos. Recovery costs reach {cost}.'
          ],
          timelineTemplates: [
            'Cyber warfare: 1-4 weeks. System restoration: 2-6 months. Full recovery: 12-36 months.',
            'Attack duration: 2-8 weeks. Emergency response: {duration}. Complete rebuild: 18-60 months.',
            'Cyber crisis: 3-12 weeks. Recovery efforts: {duration}. System reconstruction: 24-72 months.'
          ],
          casualtyRanges: { min: 10000, max: 100000 },
          costRanges: { min: 5000, max: 50000 }
        },
        {
          category: 'infrastructure',
          titles: [
            'Catastrophic Infrastructure Collapse Across {region}',
            'Critical Systems Multi-Failure in {region}',
            'Transportation Network Complete Breakdown in {region}',
            'Power Grid Catastrophic Collapse in {region}',
            'Water System Regional Failure in {region}',
            'Communications Infrastructure Collapse in {region}',
            'Major Dam System Failure in {region}',
            'Airport Network Shutdown in {region}',
            'Rail System Catastrophic Failure in {region}',
            'Port Infrastructure Collapse in {region}'
          ],
          descriptions: [
            'Catastrophic infrastructure has collapsed across {region}, affecting all major systems including power, water, transportation, and communications. {casualties} people are impacted by complete system failures. Reconstruction costs total {cost}.',
            'Critical systems have failed simultaneously across {region}, creating a cascading infrastructure catastrophe. {casualties} residents are without any essential services. Emergency reconstruction costs reach {cost}.',
            'The entire transportation network has collapsed in {region}, stranding {casualties} people and completely disrupting commerce. Emergency transportation and complete rebuild costs total {cost}.',
            'A catastrophic power grid collapse has left {region} in complete darkness for an extended period, affecting {casualties} residents and businesses. Grid reconstruction costs amount to {cost}.'
          ],
          timelineTemplates: [
            'Infrastructure collapse: 1-3 weeks. Emergency response: {duration}. Complete reconstruction: 2-7 years.',
            'System failure: 2-6 weeks. Restoration efforts: {duration}. Full rebuild: 3-10 years.',
            'Catastrophic failure: 1-4 weeks. Recovery operations: {duration}. System restoration: 5-15 years.'
          ],
          casualtyRanges: { min: 20000, max: 200000 },
          costRanges: { min: 10000, max: 100000 }
        },
        {
          category: 'pandemic',
          titles: [
            'Major Pandemic Devastates {region}',
            'Healthcare System Complete Collapse in {region}',
            'Widespread Disease Pandemic in {region}',
            'Critical Public Health Emergency in {region}',
            'Hospital System Regional Failure in {region}',
            'Multi-State Health Crisis in {region}',
            'Pandemic Healthcare Catastrophe in {region}',
            'Medical System Breakdown in {region}'
          ],
          descriptions: [
            'A major pandemic has devastated {region}, completely overwhelming all healthcare systems and causing widespread illness. {casualties} people are infected or affected by healthcare collapse. Medical costs and economic losses total {cost}.',
            'Healthcare systems have completely collapsed across {region} under the strain of a massive pandemic, affecting {casualties} patients. Military medical units are being deployed. Total costs reach {cost}.',
            'A widespread disease pandemic has created a regional health catastrophe in {region}, affecting {casualties} individuals. Emergency medical facilities and quarantine centers cost {cost}.',
            'A critical public health emergency has overwhelmed all medical facilities across {region}, with {casualties} people requiring treatment. Federal medical emergency response costs total {cost}.'
          ],
          timelineTemplates: [
            'Pandemic crisis: 6-18 months. Peak emergency: {duration}. Recovery period: 3-7 years.',
            'Health catastrophe: 4-12 months. Medical response: {duration}. System rebuild: 2-5 years.',
            'Disease outbreak: 8-24 months. Emergency operations: {duration}. Full recovery: 4-10 years.'
          ],
          casualtyRanges: { min: 20000, max: 200000 },
          costRanges: { min: 15000, max: 150000 }
        },
        {
          category: 'economic',
          titles: [
            'Severe Economic Depression in {region}',
            'Financial System Complete Collapse in {region}',
            'Mass Economic Devastation in {region}',
            'Regional Economic Catastrophe in {region}',
            'Banking System Total Failure in {region}',
            'Currency System Collapse in {region}',
            'Industrial Economy Devastation in {region}',
            'Agricultural Economy Complete Failure in {region}',
            'Energy Economy Crisis in {region}',
            'Trade System Collapse in {region}'
          ],
          descriptions: [
            'A severe economic depression has devastated {region}, with {casualties} workers losing their livelihoods. Emergency economic measures and massive relief programs are being deployed. Total economic impact reaches {cost}.',
            'The financial system has completely collapsed in {region}, affecting {casualties} individuals and businesses. Federal economic intervention and bailout programs are being implemented. Costs total {cost}.',
            'Mass economic devastation has created a regional crisis in {region}, affecting {casualties} families and businesses. Comprehensive economic recovery programs are being established. Losses amount to {cost}.',
            'A regional economic catastrophe has wiped out savings, investments, and livelihoods in {region}, affecting {casualties} people. Massive financial recovery programs cost {cost}.'
          ],
          timelineTemplates: [
            'Economic collapse: 3-12 months. Crisis response: {duration}. Recovery period: 5-15 years.',
            'Financial catastrophe: 6-18 months. Intervention measures: {duration}. Economic rebuild: 7-20 years.',
            'Economic crisis: 4-24 months. Support programs: {duration}. Full recovery: 10-25 years.'
          ],
          casualtyRanges: { min: 100000, max: 1000000 },
          costRanges: { min: 50000, max: 500000 }
        },
        {
          category: 'war',
          titles: [
            'Major Military Conflict Affects {region}',
            'Large-Scale Defense Crisis in {region}',
            'Military Infrastructure Devastation in {region}',
            'Massive Veterans Crisis in {region}',
            'Defense Industry Collapse in {region}',
            'Military Base Network Evacuation in {region}',
            'Regional War Impact on {region}',
            'Military Supply Crisis in {region}'
          ],
          descriptions: [
            'A major military conflict has severely impacted {region}, affecting {casualties} military personnel, veterans, and civilians. Massive military deployments and security measures are underway. Costs total {cost}.',
            'A large-scale defense crisis has devastated military operations in {region}, affecting {casualties} service members and defense contractors. Emergency military protocols and reinforcements cost {cost}.',
            'Military infrastructure across {region} has been devastated, affecting {casualties} personnel and completely disrupting operations. Security reconstruction and military rebuilding costs reach {cost}.',
            'A massive veterans crisis has overwhelmed all support systems in {region}, affecting {casualties} veterans and their families. Emergency assistance and healthcare programs cost {cost}.'
          ],
          timelineTemplates: [
            'Military crisis: 2-6 months. Security response: {duration}. Stabilization: 2-5 years.',
            'Conflict impact: 3-12 months. Military operations: {duration}. Recovery phase: 3-8 years.',
            'Defense emergency: 1-8 months. Response efforts: {duration}. Full restoration: 5-12 years.'
          ],
          casualtyRanges: { min: 25000, max: 250000 },
          costRanges: { min: 30000, max: 300000 },
          proximityFactors: { near: 2.8, far: 0.2 }
        },
        {
          category: 'famine',
          titles: [
            'Severe Famine Crisis in {region}',
            'Agricultural System Collapse in {region}',
            'Mass Malnutrition Emergency in {region}',
            'Food System Complete Breakdown in {region}',
            'Catastrophic Crop Failure in {region}',
            'Livestock Industry Collapse in {region}',
            'Food Distribution System Failure in {region}',
            'Regional Nutritional Catastrophe in {region}'
          ],
          descriptions: [
            'A severe famine crisis has developed across {region} due to complete agricultural system failure, affecting {casualties} residents. Massive emergency food distribution and agricultural reconstruction programs are being deployed. Total costs amount to {cost}.',
            'Agricultural systems have completely collapsed across {region}, creating widespread hunger for {casualties} people. Federal disaster relief and comprehensive food assistance programs are being implemented. Economic losses reach {cost}.',
            'A mass malnutrition emergency has developed in {region}, affecting {casualties} individuals with life-threatening hunger. Emergency nutrition programs and medical intervention cost {cost}.',
            'The food system has completely broken down across {region}, leaving {casualties} people facing starvation. Emergency food programs and complete system reconstruction costs total {cost}.'
          ],
          timelineTemplates: [
            'Famine crisis: 6-18 months. Emergency response: {duration}. Agricultural recovery: 3-8 years.',
            'Food emergency: 4-12 months. Relief efforts: {duration}. Food system rebuild: 5-12 years.',
            'Nutritional catastrophe: 8-24 months. Aid programs: {duration}. Complete recovery: 7-15 years.'
          ],
          casualtyRanges: { min: 50000, max: 500000 },
          costRanges: { min: 20000, max: 200000 }
        },
        {
          category: 'death',
          titles: [
            'Mass Casualty Event Devastates {region}',
            'Historic Tragedy Claims Hundreds of Lives in {region}'
          ],
          descriptions: [
            'A mass casualty event has resulted in {casualties} fatalities in {region}, creating one of the deadliest incidents in regional history. National emergency response teams are coordinating rescue and recovery efforts. Victim support and safety reforms cost {cost}.',
            'A historic tragedy has claimed {casualties} lives in {region}, shocking the nation. Federal investigators and emergency management are leading the response. Comprehensive victim support and prevention measures cost {cost}.'
          ],
          timelineTemplates: [
            'Tragedy duration: 6-24 hours. Emergency response: {duration}. Investigation: 6-24 months.',
            'Mass casualty event: 4-18 hours. Rescue operations: {duration}. Community recovery: 2-7 years.'
          ],
          casualtyRanges: { min: 100, max: 1000 },
          costRanges: { min: 100, max: 1000 }
        }
      ],
      
      major: [
        {
          category: 'natural',
          titles: [
            'Historic Earthquake Disaster in {region}',
            'Unprecedented Wildfire Emergency Across {region}',
            'Extreme Weather Crisis Impacts {region}',
            'Major Natural Disaster Strikes {region}',
            'Catastrophic Hurricane Devastation in {region}',
            'Historic Tornado Super Outbreak in {region}',
            'Massive Landslide Catastrophe in {region}',
            'Extreme Blizzard Disaster in {region}',
            'Historic Drought Emergency in {region}',
            'Major Volcanic Catastrophe in {region}',
            'Unprecedented Multi-Hazard Event in {region}',
            'Historic Ice Storm Catastrophe in {region}',
            'Massive Dust Bowl Crisis in {region}',
            'Major Avalanche Catastrophe in {region}',
            'Extreme Heat Catastrophe in {region}'
          ],
          descriptions: [
            'A historic magnitude 8.2 earthquake has created a multi-state disaster across {region}, with catastrophic infrastructure damage and widespread casualties. {casualties} people are confirmed affected in this unprecedented natural disaster. Economic losses exceed {cost}.',
            'An extreme wildfire crisis has engulfed {region}, burning over 1 million acres and creating a regional state of emergency. {casualties} people have been evacuated or affected by this historic disaster. Total economic impact reaches {cost}.',
            'A combination of extreme weather events has created a major disaster across {region}, affecting multiple states simultaneously. {casualties} people are impacted by this unprecedented crisis. Economic losses total {cost}.',
            'A major natural disaster has devastated {region}, combining multiple hazards into a catastrophic event. {casualties} people are affected by widespread destruction and infrastructure collapse. Recovery costs exceed {cost}.',
            'A catastrophic Category 5 hurricane has created historic devastation across {region}, bringing unprecedented destruction. {casualties} residents are affected by complete infrastructure collapse. Recovery costs reach {cost}.',
            'A historic tornado super outbreak with dozens of violent tornadoes has devastated {region}, destroying entire metropolitan areas. {casualties} people are affected by unprecedented destruction. Damage totals {cost}.',
            'A massive landslide catastrophe has buried vast areas of {region}, creating lakes and permanently altering the landscape. {casualties} people are missing or displaced. Search and recovery operations cost {cost}.',
            'An extreme blizzard disaster has created a multi-state emergency in {region} with record-breaking snowfall and life-threatening conditions. {casualties} people are in extreme danger. Emergency response costs reach {cost}.'
          ],
          timelineTemplates: [
            'Major disaster phase: 2-4 weeks. Emergency operations: {duration}. Long-term recovery: 2-5 years.',
            'Crisis period: {duration}. Mass displacement: 1-3 months. Reconstruction timeline: 3-5 years.',
            'Catastrophic phase: 1-2 months. Relief operations: {duration}. Complete recovery: 5-12 years.'
          ],
          casualtyRanges: { min: 2000, max: 20000 },
          costRanges: { min: 10000, max: 50000 }
        },
        {
          category: 'cyber',
          titles: [
            'Historic Cyber Warfare Campaign Against {region}',
            'National Security Cyber Catastrophe in {region}',
            'State-Sponsored Cyber Warfare Devastates {region}',
            'Critical Infrastructure Cyber Apocalypse in {region}',
            'Massive Cyber Attack Cripples {region}',
            'Government Systems Cyber Warfare in {region}',
            'Financial System Cyber Catastrophe in {region}',
            'Healthcare Cyber Warfare Crisis in {region}',
            'Power Grid Cyber Apocalypse in {region}',
            'Multi-Sector Cyber Warfare in {region}'
          ],
          descriptions: [
            'A historic cyber warfare campaign has targeted all critical systems in {region}, causing complete digital infrastructure collapse. {casualties} people are affected by total system breakdowns and chaos. Economic losses reach {cost}.',
            'A national security cyber catastrophe has compromised all government and military systems in {region}, creating a security crisis. {casualties} people face life-threatening service disruptions. Recovery costs total {cost}.',
            'State-sponsored cyber warfare has devastated all digital infrastructure across {region}, crippling society and government. {casualties} people are affected by complete system failures. Response and recovery costs amount to {cost}.',
            'A critical infrastructure cyber apocalypse has destroyed power, water, communications, and transportation systems in {region}. {casualties} residents face life-threatening conditions. Recovery costs reach {cost}.'
          ],
          timelineTemplates: [
            'Cyber warfare: 2-8 weeks. System restoration: 6-18 months. Full recovery: 3-10 years.',
            'Attack duration: 1-3 months. Emergency response: {duration}. Complete rebuild: 5-15 years.',
            'Cyber apocalypse: 3-6 months. Recovery efforts: {duration}. System reconstruction: 7-20 years.'
          ],
          casualtyRanges: { min: 100000, max: 1000000 },
          costRanges: { min: 50000, max: 500000 }
        },
        {
          category: 'infrastructure',
          titles: [
            'Historic Infrastructure Collapse Across {region}',
            'Critical Systems Apocalypse in {region}',
            'Transportation Network Catastrophic Collapse in {region}',
            'Power Grid Historic Failure in {region}',
            'Water System Regional Catastrophe in {region}',
            'Communications Infrastructure Apocalypse in {region}',
            'Major Dam System Catastrophic Failure in {region}',
            'Airport Network Complete Collapse in {region}',
            'Rail System Historic Failure in {region}',
            'Port Infrastructure Catastrophic Collapse in {region}'
          ],
          descriptions: [
            'Historic infrastructure has collapsed across {region}, affecting all major systems and creating a humanitarian crisis. {casualties} people are impacted by complete system failures. Reconstruction costs total {cost}.',
            'Critical systems have suffered an apocalyptic failure across {region}, creating cascading infrastructure collapse. {casualties} residents are without any essential services. Emergency reconstruction costs reach {cost}.',
            'The entire transportation network has catastrophically collapsed in {region}, completely isolating {casualties} people and destroying commerce. Emergency transportation and complete rebuild costs total {cost}.',
            'A historic power grid failure has left {region} in complete darkness for months, affecting {casualties} residents and businesses. Grid reconstruction costs amount to {cost}.'
          ],
          timelineTemplates: [
            'Infrastructure apocalypse: 2-8 weeks. Emergency response: {duration}. Complete reconstruction: 5-15 years.',
            'System collapse: 1-3 months. Restoration efforts: {duration}. Full rebuild: 7-20 years.',
            'Catastrophic failure: 3-12 weeks. Recovery operations: {duration}. System restoration: 10-25 years.'
          ],
          casualtyRanges: { min: 200000, max: 2000000 },
          costRanges: { min: 100000, max: 1000000 }
        },
        {
          category: 'pandemic',
          titles: [
            'Historic Pandemic Devastates {region}',
            'Healthcare System Apocalypse in {region}',
            'Widespread Disease Catastrophe in {region}',
            'Critical Public Health Apocalypse in {region}',
            'Hospital System Complete Collapse in {region}',
            'Multi-State Health Catastrophe in {region}',
            'Pandemic Healthcare Apocalypse in {region}',
            'Medical System Historic Breakdown in {region}'
          ],
          descriptions: [
            'A historic pandemic has devastated {region}, completely destroying all healthcare systems and causing mass casualties. {casualties} people are infected or affected by healthcare apocalypse. Medical costs and economic losses total {cost}.',
            'Healthcare systems have suffered an apocalyptic collapse across {region} under a devastating pandemic, affecting {casualties} patients. Military medical emergency response costs reach {cost}.',
            'A widespread disease catastrophe has created a regional health apocalypse in {region}, affecting {casualties} individuals. Emergency medical facilities and mass treatment centers cost {cost}.',
            'A critical public health apocalypse has overwhelmed all medical capacity across {region}, with {casualties} people requiring emergency treatment. Federal medical disaster response costs total {cost}.'
          ],
          timelineTemplates: [
            'Pandemic catastrophe: 12-36 months. Peak emergency: {duration}. Recovery period: 7-15 years.',
            'Health apocalypse: 8-24 months. Medical response: {duration}. System rebuild: 5-12 years.',
            'Disease catastrophe: 18-48 months. Emergency operations: {duration}. Full recovery: 10-25 years.'
          ],
          casualtyRanges: { min: 200000, max: 2000000 },
          costRanges: { min: 150000, max: 1500000 }
        },
        {
          category: 'economic',
          titles: [
            'Historic Economic Collapse in {region}',
            'Financial System Apocalypse in {region}',
            'Mass Economic Catastrophe in {region}',
            'Regional Economic Apocalypse in {region}',
            'Banking System Historic Collapse in {region}',
            'Currency System Apocalypse in {region}',
            'Industrial Economy Historic Devastation in {region}',
            'Agricultural Economy Apocalypse in {region}',
            'Energy Economy Historic Crisis in {region}',
            'Trade System Apocalypse in {region}'
          ],
          descriptions: [
            'A historic economic collapse has devastated {region}, with {casualties} workers losing everything. Emergency economic measures and massive reconstruction programs are being deployed. Total economic impact reaches {cost}.',
            'The financial system has suffered an apocalyptic collapse in {region}, affecting {casualties} individuals and businesses. Federal economic intervention and comprehensive bailout programs cost {cost}.',
            'Mass economic catastrophe has created a regional apocalypse in {region}, affecting {casualties} families and destroying livelihoods. Comprehensive economic reconstruction programs cost {cost}.',
            'A regional economic apocalypse has wiped out all savings, investments, and economic activity in {region}, affecting {casualties} people. Massive financial reconstruction programs cost {cost}.'
          ],
          timelineTemplates: [
            'Economic apocalypse: 6-24 months. Crisis response: {duration}. Recovery period: 10-25 years.',
            'Financial catastrophe: 12-36 months. Intervention measures: {duration}. Economic rebuild: 15-40 years.',
            'Economic collapse: 8-48 months. Support programs: {duration}. Full recovery: 20-50 years.'
          ],
          casualtyRanges: { min: 1000000, max: 10000000 },
          costRanges: { min: 500000, max: 5000000 }
        },
        {
          category: 'war',
          titles: [
            'Historic Military Conflict Devastates {region}',
            'Major Defense Catastrophe in {region}',
            'Military Infrastructure Apocalypse in {region}',
            'Massive Veterans Catastrophe in {region}',
            'Defense Industry Historic Collapse in {region}',
            'Military Base Network Catastrophe in {region}',
            'Regional War Devastation in {region}',
            'Military Supply Historic Crisis in {region}'
          ],
          descriptions: [
            'A historic military conflict has devastated {region}, affecting {casualties} military personnel, veterans, and civilians. Massive military mobilization and security reconstruction are underway. Costs total {cost}.',
            'A major defense catastrophe has destroyed military capabilities in {region}, affecting {casualties} service members and defense infrastructure. Emergency military reconstruction costs reach {cost}.',
            'Military infrastructure across {region} has suffered apocalyptic destruction, affecting {casualties} personnel and completely eliminating defense capabilities. Security reconstruction costs amount to {cost}.',
            'A massive veterans catastrophe has overwhelmed all support systems in {region}, affecting {casualties} veterans and their families. Emergency assistance and comprehensive care programs cost {cost}.'
          ],
          timelineTemplates: [
            'Military catastrophe: 6-18 months. Security response: {duration}. Stabilization: 5-12 years.',
            'Conflict devastation: 4-24 months. Military operations: {duration}. Recovery phase: 7-20 years.',
            'Defense apocalypse: 3-12 months. Response efforts: {duration}. Full restoration: 10-30 years.'
          ],
          casualtyRanges: { min: 250000, max: 2500000 },
          costRanges: { min: 300000, max: 3000000 },
          proximityFactors: { near: 3.5, far: 0.1 }
        },
        {
          category: 'famine',
          titles: [
            'Historic Famine Catastrophe in {region}',
            'Agricultural System Apocalypse in {region}',
            'Mass Starvation Emergency in {region}',
            'Food System Historic Collapse in {region}',
            'Catastrophic Agricultural Failure in {region}',
            'Livestock Industry Apocalypse in {region}',
            'Food Distribution Apocalypse in {region}',
            'Regional Nutritional Catastrophe in {region}'
          ],
          descriptions: [
            'A historic famine catastrophe has developed across {region} due to complete agricultural apocalypse, affecting {casualties} residents with mass starvation. Massive emergency food programs and agricultural reconstruction are being deployed. Total costs amount to {cost}.',
            'Agricultural systems have suffered an apocalyptic collapse across {region}, creating mass starvation for {casualties} people. Federal disaster relief and comprehensive food reconstruction programs cost {cost}.',
            'A mass starvation emergency has developed in {region}, affecting {casualties} individuals with life-threatening hunger and malnutrition. Emergency nutrition programs and medical intervention cost {cost}.',
            'The food system has historically collapsed across {region}, leaving {casualties} people facing death from starvation. Emergency food programs and complete system reconstruction costs total {cost}.'
          ],
          timelineTemplates: [
            'Famine catastrophe: 12-36 months. Emergency response: {duration}. Agricultural recovery: 7-20 years.',
            'Food apocalypse: 8-24 months. Relief efforts: {duration}. Food system rebuild: 10-25 years.',
            'Starvation crisis: 18-48 months. Aid programs: {duration}. Complete recovery: 15-40 years.'
          ],
          casualtyRanges: { min: 500000, max: 5000000 },
          costRanges: { min: 200000, max: 2000000 }
        },
        {
          category: 'death',
          titles: [
            'Historic Mass Casualty Disaster in {region}',
            'Unprecedented Tragedy Claims Thousands in {region}'
          ],
          descriptions: [
            'A historic mass casualty disaster has resulted in {casualties} fatalities in {region}, creating one of the deadliest events in American history. National emergency response and military units are coordinating massive rescue efforts. Victim support and comprehensive reforms cost {cost}.',
            'An unprecedented tragedy has claimed {casualties} lives in {region}, shocking the entire nation. The President has declared a national day of mourning. Comprehensive victim support and prevention programs cost {cost}.'
          ],
          timelineTemplates: [
            'Historic tragedy: 12-48 hours. Emergency response: {duration}. Investigation: 12-60 months.',
            'Mass casualty disaster: 8-36 hours. Rescue operations: {duration}. National recovery: 5-15 years.'
          ],
          casualtyRanges: { min: 500, max: 5000 },
          costRanges: { min: 500, max: 5000 }
        }
      ],
      
      catastrophic: [
        {
          category: 'natural',
          titles: [
            'Catastrophic Megaquake Devastates {region}',
            'Unprecedented Natural Disaster Across {region}',
            'Historic Climate Crisis Impacts {region}',
            'Catastrophic Multi-Hazard Event in {region}',
            'Apocalyptic Hurricane Devastation in {region}',
            'Historic Tornado Apocalypse in {region}',
            'Catastrophic Landslide Apocalypse in {region}',
            'Apocalyptic Blizzard Disaster in {region}',
            'Historic Drought Apocalypse in {region}',
            'Catastrophic Volcanic Apocalypse in {region}',
            'Unprecedented Multi-Disaster Event in {region}',
            'Historic Ice Age Event in {region}',
            'Catastrophic Dust Bowl Apocalypse in {region}',
            'Apocalyptic Avalanche Disaster in {region}',
            'Catastrophic Heat Apocalypse in {region}'
          ],
          descriptions: [
            'A catastrophic magnitude 9.1 earthquake has created an unprecedented disaster across {region}, causing massive infrastructure collapse and a humanitarian crisis. {casualties} people are confirmed affected in this historic natural disaster. Economic losses are estimated at {cost}, representing one of the costliest disasters in US history.',
            'An unprecedented combination of natural disasters has created a catastrophic emergency across {region}, affecting multiple states and millions of people. {casualties} individuals are impacted by this historic crisis. Total economic losses exceed {cost}, requiring massive federal intervention.',
            'A catastrophic climate event has devastated {region}, creating the largest natural disaster in recent history. {casualties} people are affected by this unprecedented crisis. Economic impact reaches {cost}, fundamentally altering the regional economy.',
            'A catastrophic multi-hazard event combining earthquakes, floods, and fires has devastated {region}, creating an apocalyptic scenario. {casualties} people are affected by unprecedented destruction. Recovery costs exceed {cost}.',
            'An apocalyptic Category 6-equivalent hurricane has created historic devastation across {region}, bringing unprecedented destruction never before seen. {casualties} residents are affected by complete regional devastation. Recovery costs reach {cost}.',
            'A historic tornado apocalypse with hundreds of violent tornadoes has devastated {region}, destroying entire states and creating a humanitarian crisis. {casualties} people are affected by unprecedented destruction. Damage totals {cost}.',
            'A catastrophic landslide apocalypse has buried entire regions of {region}, creating permanent geographical changes and massive casualties. {casualties} people are missing or displaced. Search and recovery operations cost {cost}.',
            'An apocalyptic blizzard disaster has created a multi-state catastrophe in {region} with record-breaking conditions and mass casualties. {casualties} people face life-threatening situations. Emergency response costs reach {cost}.'
          ],
          timelineTemplates: [
            'Catastrophic phase: 1-2 months. Emergency operations: {duration}. Recovery timeline: 5-10 years.',
            'Disaster duration: {duration}. Mass evacuation: 3-6 months. Complete reconstruction: 7-15 years.',
            'Apocalyptic phase: 2-6 months. Relief operations: {duration}. Full recovery: 10-25 years.'
          ],
          casualtyRanges: { min: 10000, max: 100000 },
          costRanges: { min: 50000, max: 200000 }
        },
        {
          category: 'cyber',
          titles: [
            'Catastrophic Cyber Attack Cripples {region}',
            'Massive Infrastructure Hack Devastates {region}',
            'Critical Systems Failure Across {region}',
            'Apocalyptic Cyber Warfare in {region}',
            'National Security Cyber Apocalypse in {region}',
            'Digital Infrastructure Apocalypse in {region}',
            'Catastrophic Government Hack in {region}',
            'Financial System Cyber Apocalypse in {region}',
            'Healthcare Cyber Apocalypse in {region}',
            'Power Grid Cyber Apocalypse in {region}'
          ],
          descriptions: [
            'A sophisticated nation-state cyber attack has completely crippled critical infrastructure across {region}, affecting power grids, financial systems, and emergency services. {casualties} people are impacted by widespread system failures. Economic losses reach {cost} as the region struggles to restore basic services.',
            'A coordinated cyber warfare campaign has devastated digital infrastructure across {region}, causing massive disruptions to government, healthcare, and financial systems. {casualties} people are affected by this unprecedented digital disaster. Total economic impact exceeds {cost}.',
            'An apocalyptic cyber warfare campaign has destroyed all digital infrastructure in {region}, creating a complete societal collapse. {casualties} people face life-threatening conditions without any digital services. Recovery costs reach {cost}.',
            'A national security cyber apocalypse has compromised all government, military, and civilian systems in {region}, creating chaos and panic. {casualties} people are affected by complete system breakdowns. Response costs total {cost}.',
            'Digital infrastructure has suffered an apocalyptic collapse across {region}, destroying all computer systems and digital communications. {casualties} residents face a return to pre-digital conditions. Recovery costs amount to {cost}.',
            'A catastrophic government hack has exposed all classified information and destroyed all government systems in {region}. {casualties} people are affected by security breaches and service failures. Recovery costs reach {cost}.'
          ],
          timelineTemplates: [
            'Attack duration: 2-4 weeks. System restoration: 3-6 months. Full recovery: 1-2 years.',
            'Crisis period: 1-3 months. Infrastructure rebuild: 6-12 months. Complete recovery: 2-5 years.',
            'Cyber apocalypse: 1-6 months. Emergency response: {duration}. System reconstruction: 3-10 years.'
          ],
          casualtyRanges: { min: 5000, max: 50000 },
          costRanges: { min: 20000, max: 100000 }
        },
        {
          category: 'infrastructure',
          titles: [
            'Catastrophic Infrastructure Collapse in {region}',
            'Critical Systems Failure Devastates {region}',
            'Massive Infrastructure Crisis Across {region}',
            'Apocalyptic Infrastructure Failure in {region}',
            'Transportation Apocalypse in {region}',
            'Power Grid Apocalypse in {region}',
            'Water System Apocalypse in {region}',
            'Communications Apocalypse in {region}',
            'Dam System Catastrophic Failure in {region}',
            'Airport Network Apocalypse in {region}'
          ],
          descriptions: [
            'A catastrophic failure of critical infrastructure has created a humanitarian crisis across {region}, with power grids, transportation networks, and water systems completely compromised. {casualties} people are affected by this unprecedented infrastructure disaster. Economic losses total {cost} as the region faces complete system reconstruction.',
            'Multiple infrastructure failures have created a cascading disaster across {region}, affecting millions of people and crippling essential services. {casualties} individuals are impacted by this historic crisis. Total economic impact reaches {cost}.',
            'An apocalyptic infrastructure failure has destroyed all essential systems across {region}, creating a humanitarian catastrophe. {casualties} people face life-threatening conditions without power, water, or communications. Recovery costs reach {cost}.',
            'Transportation systems have suffered an apocalyptic collapse across {region}, completely isolating millions of people and destroying all commerce. {casualties} residents are stranded without any means of travel. Recovery costs total {cost}.',
            'The power grid has suffered an apocalyptic failure across {region}, leaving the entire region in permanent darkness and chaos. {casualties} people face life-threatening conditions without electricity. Grid reconstruction costs amount to {cost}.',
            'Water systems have suffered catastrophic failure across {region}, leaving {casualties} people without clean water or sanitation. Emergency water distribution and system reconstruction costs reach {cost}.'
          ],
          timelineTemplates: [
            'Infrastructure failure: 1-2 weeks. Emergency repairs: 2-4 months. Complete rebuild: 2-5 years.',
            'Crisis duration: 3-6 weeks. System restoration: 6-18 months. Full reconstruction: 5-15 years.',
            'Apocalyptic failure: 1-3 months. Recovery operations: {duration}. Complete restoration: 10-25 years.'
          ],
          casualtyRanges: { min: 3000, max: 30000 },
          costRanges: { min: 15000, max: 75000 }
        },
        {
          category: 'pandemic',
          titles: [
            'Catastrophic Pandemic Devastates {region}',
            'Healthcare Apocalypse in {region}',
            'Mass Disease Catastrophe in {region}',
            'Public Health Apocalypse in {region}',
            'Medical System Apocalypse in {region}',
            'Hospital Network Collapse in {region}',
            'Disease Outbreak Apocalypse in {region}',
            'Health Infrastructure Collapse in {region}'
          ],
          descriptions: [
            'A catastrophic pandemic has devastated {region}, completely destroying healthcare systems and causing mass casualties on an unprecedented scale. {casualties} people are infected or affected by healthcare apocalypse. Medical costs and economic losses total {cost}.',
            'Healthcare systems have suffered an apocalyptic collapse across {region} under a devastating pandemic, with {casualties} patients facing life-threatening conditions. Military medical emergency response costs reach {cost}.',
            'A mass disease catastrophe has created a regional health apocalypse in {region}, affecting {casualties} individuals with a deadly pathogen. Emergency medical facilities and mass treatment centers cost {cost}.',
            'A public health apocalypse has overwhelmed all medical capacity across {region}, with {casualties} people facing death without treatment. Federal medical disaster response costs total {cost}.'
          ],
          timelineTemplates: [
            'Pandemic catastrophe: 18-60 months. Peak emergency: {duration}. Recovery period: 10-25 years.',
            'Health apocalypse: 12-48 months. Medical response: {duration}. System rebuild: 7-20 years.',
            'Disease catastrophe: 24-72 months. Emergency operations: {duration}. Full recovery: 15-40 years.'
          ],
          casualtyRanges: { min: 1000000, max: 10000000 },
          costRanges: { min: 1000000, max: 10000000 }
        },
        {
          category: 'economic',
          titles: [
            'Catastrophic Economic Collapse in {region}',
            'Financial Apocalypse in {region}',
            'Economic System Destruction in {region}',
            'Regional Economic Apocalypse in {region}',
            'Banking Apocalypse in {region}',
            'Currency System Collapse in {region}',
            'Industrial Apocalypse in {region}',
            'Agricultural Apocalypse in {region}'
          ],
          descriptions: [
            'A catastrophic economic collapse has devastated {region}, with {casualties} people losing everything and facing destitution. Emergency economic measures and massive reconstruction programs cost {cost}.',
            'A financial apocalypse has destroyed all economic activity in {region}, affecting {casualties} individuals and businesses. Federal economic intervention and comprehensive reconstruction programs cost {cost}.',
            'Economic systems have been completely destroyed across {region}, creating mass poverty for {casualties} people. Comprehensive economic reconstruction programs cost {cost}.',
            'A regional economic apocalypse has wiped out all wealth and economic activity in {region}, affecting {casualties} people. Massive financial reconstruction programs cost {cost}.'
          ],
          timelineTemplates: [
            'Economic apocalypse: 12-60 months. Crisis response: {duration}. Recovery period: 20-50 years.',
            'Financial collapse: 18-72 months. Intervention measures: {duration}. Economic rebuild: 25-75 years.',
            'Economic destruction: 24-96 months. Support programs: {duration}. Full recovery: 30-100 years.'
          ],
          casualtyRanges: { min: 10000000, max: 100000000 },
          costRanges: { min: 5000000, max: 50000000 }
        },
        {
          category: 'war',
          titles: [
            'Catastrophic Military Conflict in {region}',
            'Defense Apocalypse in {region}',
            'Military Infrastructure Destruction in {region}',
            'Veterans Apocalypse in {region}',
            'Defense Industry Apocalypse in {region}',
            'Military Apocalypse in {region}',
            'War Devastation in {region}',
            'Military Crisis Apocalypse in {region}'
          ],
          descriptions: [
            'A catastrophic military conflict has devastated {region}, affecting {casualties} military personnel, veterans, and civilians in unprecedented warfare. Massive military mobilization and reconstruction costs total {cost}.',
            'A defense apocalypse has destroyed all military capabilities in {region}, affecting {casualties} service members and completely eliminating defense infrastructure. Emergency military reconstruction costs reach {cost}.',
            'Military infrastructure has been completely destroyed across {region}, affecting {casualties} personnel and eliminating all defense capabilities. Security reconstruction costs amount to {cost}.',
            'A veterans apocalypse has overwhelmed all support systems in {region}, affecting {casualties} veterans facing life-threatening conditions. Emergency assistance and comprehensive care programs cost {cost}.'
          ],
          timelineTemplates: [
            'Military apocalypse: 12-36 months. Security response: {duration}. Stabilization: 10-25 years.',
            'Conflict devastation: 8-48 months. Military operations: {duration}. Recovery phase: 15-40 years.',
            'Defense apocalypse: 6-24 months. Response efforts: {duration}. Full restoration: 20-50 years.'
          ],
          casualtyRanges: { min: 2500000, max: 25000000 },
          costRanges: { min: 3000000, max: 30000000 },
          proximityFactors: { near: 4.0, far: 0.05 }
        },
        {
          category: 'famine',
          titles: [
            'Catastrophic Famine Apocalypse in {region}',
            'Agricultural Apocalypse in {region}',
            'Mass Starvation Catastrophe in {region}',
            'Food System Apocalypse in {region}',
            'Agricultural Destruction in {region}',
            'Livestock Apocalypse in {region}',
            'Food Apocalypse in {region}',
            'Nutritional Apocalypse in {region}'
          ],
          descriptions: [
            'A catastrophic famine apocalypse has developed across {region} due to complete agricultural destruction, affecting {casualties} residents with mass starvation and death. Massive emergency food programs and agricultural reconstruction cost {cost}.',
            'Agricultural systems have been completely destroyed across {region}, creating mass starvation for {casualties} people facing death. Federal disaster relief and comprehensive food reconstruction programs cost {cost}.',
            'A mass starvation catastrophe has developed in {region}, affecting {casualties} individuals facing death from hunger and malnutrition. Emergency nutrition programs and medical intervention cost {cost}.',
            'The food system has been completely destroyed across {region}, leaving {casualties} people facing mass death from starvation. Emergency food programs and complete system reconstruction costs total {cost}.'
          ],
          timelineTemplates: [
            'Famine apocalypse: 24-72 months. Emergency response: {duration}. Agricultural recovery: 15-40 years.',
            'Food apocalypse: 18-60 months. Relief efforts: {duration}. Food system rebuild: 20-50 years.',
            'Starvation catastrophe: 36-96 months. Aid programs: {duration}. Complete recovery: 25-75 years.'
          ],
          casualtyRanges: { min: 5000000, max: 50000000 },
          costRanges: { min: 2000000, max: 20000000 }
        },
        {
          category: 'death',
          titles: [
            'Catastrophic Mass Casualty Apocalypse in {region}',
            'Unprecedented National Tragedy in {region}'
          ],
          descriptions: [
            'A catastrophic mass casualty apocalypse has resulted in {casualties} fatalities in {region}, creating the deadliest event in American history. The entire federal government and military are mobilized for rescue and recovery. National victim support and comprehensive reforms cost {cost}.',
            'An unprecedented national tragedy has claimed {casualties} lives in {region}, fundamentally changing the nation. Congress has declared a national emergency and period of mourning. Comprehensive victim support and prevention programs cost {cost}.'
          ],
          timelineTemplates: [
            'Catastrophic tragedy: 24-168 hours. Emergency response: {duration}. Investigation: 24-120 months.',
            'National disaster: 12-96 hours. Rescue operations: {duration}. National recovery: 10-50 years.'
          ],
          casualtyRanges: { min: 2500, max: 25000 },
          costRanges: { min: 2500, max: 25000 }
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
    const templates = this.disasterTemplates[severity].filter(t => t.category === selectedCategory);
    if (!templates || templates.length === 0) {
      throw new Error(`No templates available for ${severity} ${selectedCategory} disasters`);
    }
    
    const template = templates[Math.floor(Math.random() * templates.length)];
    if (!template) {
      throw new Error(`Failed to select template for ${severity} ${selectedCategory} disaster`);
    }
    
    // Generate disaster details with realistic scaling
    const multiplier = this.severityMultipliers[severity];
    const title = this.selectRandomFromArray(template.titles);
    const description = this.selectRandomFromArray(template.descriptions);
    const timeline = this.selectRandomFromArray(template.timelineTemplates);
    
    if (!title || !description || !timeline) {
      throw new Error('Failed to generate disaster content from template');
    }
    
    // Calculate realistic casualties based on region population and severity
    const baseCasualties = Math.floor(regionInfo.population * 0.0001 * multiplier.casualty);
    const casualties = Math.floor(
      baseCasualties + (Math.random() * baseCasualties * 0.5)
    );
    
    // Calculate realistic economic cost based on region GDP and severity
    const baseCost = regionInfo.gdp * 0.01 * multiplier.cost;
    const cost = Math.floor(
      baseCost + (Math.random() * baseCost * 0.3)
    );
    
    // Apply proximity factor for war disasters
    let proximityFactor: number | undefined;
    if (template.category === 'war' && template.proximityFactors) {
      proximityFactor = Math.random() < 0.3 ? template.proximityFactors.near : template.proximityFactors.far;
    }
    
    // Generate affected regions based on severity
    const affectedRegions = this.generateAffectedRegions(selectedRegion, severity);
    
    const disaster: DisasterEvent = {
      type: severity,
      category: template.category,
      title: this.personalizeTitle(title, regionInfo.name),
      description: this.personalizeDescription(description, regionInfo.name, casualties, cost),
      timeline: this.personalizeTimeline(timeline, severity),
      estimatedCasualties: casualties,
      economicCost: cost,
      affectedRegions,
      proximityFactor: proximityFactor ?? undefined,
      severity: multiplier.severity
    };
    
    this.logger.debug(`Generated ${severity} ${template.category} disaster: ${disaster.title}`);
    
    return disaster;
  }

  private selectRandomRegion(): string {
    const nations = Object.keys(this.regionData).filter(r => r !== 'multiple_nations');
    const selectedRegion = nations[Math.floor(Math.random() * nations.length)];
    if (!selectedRegion) {
      return 'new_york'; // fallback to New York
    }
    return selectedRegion;
  }

  private getRegionAppropriateDisasters(region: string, category: DisasterEvent['category']): boolean {
    // Geographic realism for natural disasters
    if (category === 'natural') {
      const earthquakeProneRegions = ['california', 'west', 'pacific', 'alaska'];
      const hurricaneProneRegions = ['southeast', 'florida', 'texas', 'louisiana', 'north_carolina', 'south_carolina'];
      const tornadoProneRegions = ['midwest', 'texas', 'oklahoma', 'kansas', 'nebraska', 'iowa'];
      const wildfireProneRegions = ['california', 'west', 'texas', 'colorado', 'oregon', 'washington'];
      const floodProneRegions = ['southeast', 'midwest', 'louisiana', 'florida', 'texas'];
      const blizzardProneRegions = ['northeast', 'midwest', 'montana', 'north_dakota', 'minnesota'];
      
      // For now, allow all natural disasters in all regions but this could be enhanced
      return true;
    }
    
    // All other categories can happen anywhere
    return true;
  }

  private selectRandomCategory(): DisasterEvent['category'] {
    const categories: DisasterEvent['category'][] = ['natural', 'pandemic', 'war', 'economic', 'famine', 'cyber', 'infrastructure', 'death'];
    const selectedCategory = categories[Math.floor(Math.random() * categories.length)];
    if (!selectedCategory) {
      return 'natural';
    }
    return selectedCategory;
  }

  private selectRandomFromArray<T>(array: T[]): T {
    const selected = array[Math.floor(Math.random() * array.length)];
    if (!selected) {
      throw new Error('Failed to select from array');
    }
    return selected;
  }

  private personalizeTitle(title: string, regionName: string): string {
    return title.replace(/\{region\}/g, regionName);
  }

  private personalizeDescription(description: string, regionName: string, casualties: number, cost: number): string {
    return description
      .replace(/\{region\}/g, regionName)
      .replace(/\{casualties\}/g, casualties.toLocaleString())
      .replace(/\{cost\}/g, `$${cost.toFixed(1)} billion`);
  }

  private personalizeTimeline(timeline: string, severity: DisasterSeverity): string {
    const durations = {
      'very_small': '1-3 days',
      'small': '3-7 days', 
      'medium': '1-2 weeks',
      'large': '2-4 weeks',
      'major': '1-3 months',
      'catastrophic': '3-12 months'
    };
    
    return timeline.replace(/\{duration\}/g, durations[severity]);
  }

  private generateAffectedRegions(selectedRegion: string, severity: DisasterSeverity): string[] {
    const regionInfo = this.regionData[selectedRegion];
    if (!regionInfo) {
      return ['Unknown Region'];
    }

    const affectedRegions: string[] = [regionInfo.name];
    
    // State adjacency map - only bordering states
    const stateAdjacency: Record<string, string[]> = {
      'alabama': ['mississippi', 'tennessee', 'georgia', 'florida'],
      'alaska': [], // No bordering states
      'arizona': ['california', 'nevada', 'utah', 'colorado', 'new_mexico'],
      'arkansas': ['missouri', 'tennessee', 'mississippi', 'louisiana', 'texas', 'oklahoma'],
      'california': ['oregon', 'nevada', 'arizona'],
      'colorado': ['wyoming', 'nebraska', 'kansas', 'oklahoma', 'new_mexico', 'arizona', 'utah'],
      'connecticut': ['massachusetts', 'rhode_island', 'new_york'],
      'delaware': ['pennsylvania', 'maryland'],
      'florida': ['alabama', 'georgia'],
      'georgia': ['florida', 'alabama', 'tennessee', 'north_carolina', 'south_carolina'],
      'hawaii': [], // No bordering states
      'idaho': ['montana', 'wyoming', 'utah', 'nevada', 'oregon', 'washington'],
      'illinois': ['wisconsin', 'indiana', 'iowa', 'missouri', 'kentucky'],
      'indiana': ['michigan', 'ohio', 'kentucky', 'illinois'],
      'iowa': ['minnesota', 'wisconsin', 'illinois', 'missouri', 'kansas', 'nebraska', 'south_dakota'],
      'kansas': ['nebraska', 'missouri', 'oklahoma', 'colorado'],
      'kentucky': ['indiana', 'ohio', 'west_virginia', 'virginia', 'tennessee', 'missouri', 'illinois'],
      'louisiana': ['texas', 'arkansas', 'mississippi'],
      'maine': ['new_hampshire'],
      'maryland': ['pennsylvania', 'west_virginia', 'virginia', 'delaware'],
      'massachusetts': ['rhode_island', 'connecticut', 'new_york', 'vermont', 'new_hampshire'],
      'michigan': ['ohio', 'indiana', 'wisconsin'],
      'minnesota': ['wisconsin', 'iowa', 'south_dakota', 'north_dakota'],
      'mississippi': ['louisiana', 'arkansas', 'tennessee', 'alabama'],
      'missouri': ['iowa', 'illinois', 'kentucky', 'tennessee', 'arkansas', 'oklahoma', 'kansas', 'nebraska'],
      'montana': ['north_dakota', 'south_dakota', 'wyoming', 'idaho'],
      'nebraska': ['south_dakota', 'iowa', 'missouri', 'kansas', 'colorado', 'wyoming'],
      'nevada': ['idaho', 'utah', 'arizona', 'california', 'oregon'],
      'new_hampshire': ['maine', 'massachusetts', 'vermont'],
      'new_jersey': ['new_york', 'pennsylvania'],
      'new_mexico': ['colorado', 'oklahoma', 'texas', 'arizona'],
      'new_york': ['vermont', 'massachusetts', 'connecticut', 'new_jersey', 'pennsylvania'],
      'north_carolina': ['virginia', 'tennessee', 'georgia', 'south_carolina'],
      'north_dakota': ['minnesota', 'south_dakota', 'montana'],
      'ohio': ['pennsylvania', 'west_virginia', 'kentucky', 'indiana', 'michigan'],
      'oklahoma': ['kansas', 'missouri', 'arkansas', 'texas', 'new_mexico', 'colorado'],
      'oregon': ['washington', 'idaho', 'nevada', 'california'],
      'pennsylvania': ['new_york', 'new_jersey', 'delaware', 'maryland', 'west_virginia', 'ohio'],
      'rhode_island': ['connecticut', 'massachusetts'],
      'south_carolina': ['north_carolina', 'georgia'],
      'south_dakota': ['north_dakota', 'minnesota', 'iowa', 'nebraska', 'wyoming', 'montana'],
      'tennessee': ['kentucky', 'virginia', 'north_carolina', 'georgia', 'alabama', 'mississippi', 'arkansas', 'missouri'],
      'texas': ['new_mexico', 'oklahoma', 'arkansas', 'louisiana'],
      'utah': ['idaho', 'wyoming', 'colorado', 'arizona', 'nevada'],
      'vermont': ['new_hampshire', 'massachusetts', 'new_york'],
      'virginia': ['maryland', 'west_virginia', 'kentucky', 'tennessee', 'north_carolina'],
      'washington': ['idaho', 'oregon'],
      'west_virginia': ['pennsylvania', 'maryland', 'virginia', 'kentucky', 'ohio'],
      'wisconsin': ['michigan', 'minnesota', 'iowa', 'illinois'],
      'wyoming': ['montana', 'south_dakota', 'nebraska', 'colorado', 'utah', 'idaho']
    };

    // Add neighboring states based on severity
    const severitySpread = {
      'very_small': 0,    // Only affects the original state
      'small': 1,         // Can spread to 1 neighboring state
      'medium': 2,        // Can spread to 2 neighboring states
      'large': 3,         // Can spread to 3 neighboring states
      'major': 4,         // Can spread to 4 neighboring states
      'catastrophic': 6   // Can spread to up to 6 neighboring states
    };

    const spreadCount = severitySpread[severity];
    
    if (spreadCount > 0 && selectedRegion !== 'nationwide') {
      const neighboringStates = stateAdjacency[selectedRegion] || [];
      
      // Randomly select neighboring states up to the spread count
      const shuffledNeighbors = [...neighboringStates].sort(() => 0.5 - Math.random());
      
      for (let i = 0; i < Math.min(spreadCount, shuffledNeighbors.length); i++) {
        const neighborKey = shuffledNeighbors[i];
        if (neighborKey) {
          const neighborRegion = this.regionData[neighborKey];
          if (neighborRegion) {
            affectedRegions.push(neighborRegion.name);
          }
        }
      }
    }

    return affectedRegions;
  }

  // Legacy method for backward compatibility
  public selectDisasterSeverity(): DisasterSeverity {
    const random = Math.random();
    if (random < 0.50) return 'small';
    if (random < 0.85) return 'medium';
    if (random < 0.95) return 'large';
    return 'major';
  }
}