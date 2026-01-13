import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder, ChatInputCommandInteraction, AutocompleteInteraction } from 'discord.js';

// Core data types for the Model US Discord Bot

export interface Command {
  data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute(interaction: ChatInputCommandInteraction, dbManager: any, logger: any): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction, dbManager: any, logger: any): Promise<void>;
}

export interface NationStats {
  name: string;
  gdp: number;
  stability: number;
  population: number;
  taxRate: number;
  budget: number;
  gdpPerCapita: number;
  gdpChange?: number;
  populationChange?: number;
  updatedAt: Date;
  
  // Enhanced fields
  flag?: string;
  flagSetAt?: Date;
  capital?: string;
  leader?: string; // Discord username if linked (President)
  vicePresident?: string; // Discord username if linked (VP)
  description?: string;
  groundStrength?: number;   // 0-10 scale
  navalStrength?: number;    // 0-10 scale  
  airStrength?: number;      // 0-10 scale
  
  // New fields
  governmentType?: string;   // Democracy, Monarchy, Fascism, etc.
  provincialCapitals?: string[]; // Up to 3 provincial capitals
  nationalDebt?: number;     // Total debt amount
  tradingPartners?: string[]; // List of major trading partners
}

export interface War {
  id: number;
  name: string;
  participants: string[];
  startDate: Date;
  endDate?: Date | undefined;
  casualties: number;
  description?: string | undefined;
  status: 'active' | 'ended';
}

export interface UserLink {
  id: number;
  discordId: string;
  nationName: string;
  role: 'president' | 'vice_president';
  createdAt: Date;
}

export interface UserActivity {
  discordId: string;
  channelId: string;
  lastMessageAt: Date;
  messageCount: number;
  
  // Enhanced fields
  nationName?: string; // If user is linked
  relativeTime?: string; // Computed field
}

export interface DisasterEvent {
  type: 'very_small' | 'small' | 'medium' | 'large' | 'major' | 'catastrophic';
  category: 'natural' | 'artificial';
  title: string;
  description: string;
  timeline: string;
  estimatedCasualties: number;
  economicCost: number; // In billions USD
  affectedRegions: string[];
  proximityFactor?: number | undefined;
  severity: number; // 1-6 scale for calculations
}

export interface AdminAction {
  id: number;
  adminId: string;
  action: string;
  details: string;
  timestamp: Date;
}

export interface Alliance {
  id: number;
  nation1: string;
  nation2: string;
  status: 'pending' | 'active' | 'declined';
  requestedBy: string; // Discord ID of requester
  requestedAt: Date;
  approvedAt?: Date | undefined;
  createdBy?: string | undefined; // Admin ID if admin-created
}

export interface NationRename {
  id: number;
  oldName: string;
  newName: string;
  renamedBy: string; // Discord ID
  renamedAt: Date;
  isAdminRename: boolean;
}

export interface BackupRecord {
  id: number;
  filename: string;
  createdAt: Date;
  createdBy?: string | undefined; // Admin ID if manual backup
  size: number; // File size in bytes
  type: 'automatic' | 'manual';
}

export type RankingCategory = 'gdp' | 'population' | 'stability' | 'tax_rate' | 'gdp_per_capita' | 'air_strength' | 'naval_strength' | 'ground_strength';

export type DisasterSeverity = 'very_small' | 'small' | 'medium' | 'large' | 'major' | 'catastrophic';

export type USRegion = 'random' | 'northeast' | 'southeast' | 'midwest' | 'southwest' | 'west' | 'pacific' | 'nationwide' | 
  'alabama' | 'alaska' | 'arizona' | 'arkansas' | 'california' | 'colorado' | 'connecticut' | 'delaware' | 'florida' | 
  'georgia' | 'hawaii' | 'idaho' | 'illinois' | 'indiana' | 'iowa' | 'kansas' | 'kentucky' | 'louisiana' | 'maine' | 
  'maryland' | 'massachusetts' | 'michigan' | 'minnesota' | 'mississippi' | 'missouri' | 'montana' | 'nebraska' | 
  'nevada' | 'new_hampshire' | 'new_jersey' | 'new_mexico' | 'new_york' | 'north_carolina' | 'north_dakota' | 
  'ohio' | 'oklahoma' | 'oregon' | 'pennsylvania' | 'rhode_island' | 'south_carolina' | 'south_dakota' | 
  'tennessee' | 'texas' | 'utah' | 'vermont' | 'virginia' | 'washington' | 'west_virginia' | 'wisconsin' | 'wyoming';

export interface DatabaseConfig {
  path: string;
  enableWAL?: boolean;
  enableForeignKeys?: boolean;
  // Enhanced reliability options
  connectionTimeout?: number;
  retryAttempts?: number;
  backupInterval?: number;
  healthCheckInterval?: number;
  maxBackups?: number;
  enableHealthMonitoring?: boolean;
  enableAutoBackup?: boolean;
  enableSchemaValidation?: boolean;
}

export interface DatabaseHealth {
  isConnected: boolean;
  lastError: Error | undefined;
  queryCount: number;
  errorCount: number;
  averageQueryTime: number;
  lastHealthCheck: Date;
  databaseSize: number | undefined;
  backupStatus: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS' | undefined;
  lastBackup: Date | undefined;
}

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export enum DatabaseErrorType {
  CONNECTION_LOST = 'CONNECTION_LOST',
  QUERY_FAILED = 'QUERY_FAILED',
  SCHEMA_MISMATCH = 'SCHEMA_MISMATCH',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  CORRUPTION_DETECTED = 'CORRUPTION_DETECTED',
  BACKUP_FAILED = 'BACKUP_FAILED',
  MIGRATION_FAILED = 'MIGRATION_FAILED'
}

export enum ErrorSeverity {
  LOW = 'LOW',        // Retry automatically
  MEDIUM = 'MEDIUM',  // Retry with backoff
  HIGH = 'HIGH',      // Require manual intervention
  CRITICAL = 'CRITICAL' // System shutdown required
}

export interface DatabaseError {
  id: string;
  timestamp: Date;
  errorType: DatabaseErrorType;
  severity: ErrorSeverity;
  sqliteCode: string | undefined;
  message: string;
  query: string | undefined;
  parameters: any[] | undefined;
  stackTrace: string;
  resolved: boolean;
  retryCount: number;
}

export interface OperationQueue {
  id: string;
  operation: string;
  parameters: any[];
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface HealthMetrics {
  timestamp: Date;
  connectionStatus: boolean;
  queryCount: number;
  errorRate: number;
  averageResponseTime: number;
  databaseSize: number;
  backupStatus: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
  lastBackup: Date;
}

export interface SchemaVersion {
  version: number;
  description: string;
  migrations: string[];
  rollbackQueries?: string[];
}

export interface BotConfig {
  token: string;
  clientId: string;
  guildId?: string | undefined;
  adminUserIds: string[];
  database: DatabaseConfig;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  botLogChannelId?: string | undefined;
  timezone?: string | undefined;
}

// Law and Tag System Interfaces
export interface Law {
  id: number;
  name: string;
  bodyText: string;
  isPublic: boolean;
  nationName: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt?: Date;      // New
  editedBy?: string;    // New
  originalText?: string; // New
}

export interface Tag {
  id: number;
  name: string;
  description: string;
  createdBy: string;
  createdAt: Date;
}

export interface LawWithTags extends Law {
  tags: Tag[];
}

// Multi-Alliance System Interfaces
export interface MultiAlliance {
  id: number;
  name: string;
  description?: string;
  leaderNation: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  members?: MultiAllianceMember[];
}

export interface MultiAllianceMember {
  id: number;
  allianceId: number;
  nationName: string;
  joinedAt: Date;
  joinedBy: string;
}

// Map System Interface
export interface MapSettings {
  id: number;
  mapUrl: string;
  mapDescription?: string;
  mapType: 'world' | 'alliance'; // New field to distinguish map types
  setBy: string;
  setAt: Date;
}

// New interfaces for loans and investments
export interface Loan {
  id: number;
  lenderNation: string;
  borrowerNation: string;
  amount: number;
  interestRate: number;
  termMonths: number;
  monthlyPayment: number;
  remainingBalance: number;
  status: 'active' | 'paid_off' | 'defaulted';
  createdAt: Date;
  dueDate: Date;
  lastPayment?: Date;
}

export interface Investment {
  id: number;
  investorNation: string;
  targetNation: string;
  amount: number;
  investmentType: 'infrastructure' | 'military' | 'technology' | 'education' | 'healthcare';
  expectedReturn: number;
  duration: number; // in months
  status: 'active' | 'completed' | 'failed';
  createdAt: Date;
  maturityDate: Date;
  currentValue: number;
}

export interface NationActivity {
  nationName: string;
  totalMessages: number;
  lastActivity: Date;
  activeUsers: number;
  leader?: string;
}

export interface AuditLogEntry {
  id: number;
  adminId: string;
  adminUsername: string;
  action: string;
  details: string;
  timestamp: Date;
  nationAffected?: string;
}

export interface TagListOptions {
  itemsPerPage: number;
  page: number;
  nationFilter?: string;
}