/**
 * PARA Method Types
 * Projects, Areas, Resources, Archives
 */

export type PARAStage = 'jots' | 'tasks' | 'projects' | 'areas' | 'resources' | 'archives';

export interface PARATask {
  id: string;
  title: string;
  description?: string;
  stage: PARAStage;
  priority?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  completedAt?: Date;
  dependencies?: string[]; // IDs of dependent tasks
  blockers?: string[]; // IDs of tasks this blocks
  crossAreaImpact?: string[]; // Areas this task impacts
  taskScore?: number;
  colorCode?: 'red' | 'gold' | 'normal'; // Based on score thresholds
  source: 'notion' | 'linear' | 'manual';
  sourceId?: string; // ID in the source system
  metadata?: Record<string, any>;
}

export interface PARAProject {
  id: string;
  title: string;
  description?: string;
  stage: PARAStage;
  tasks: string[]; // Task IDs
  areas: string[]; // Related areas
  priority?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
  completedAt?: Date;
  progress: number; // 0-100
  taskScore?: number;
  buildingBlocks?: string[]; // Projects this could serve as foundation for
  dependencies?: string[];
  source: 'notion' | 'linear' | 'manual';
  sourceId?: string;
  metadata?: Record<string, any>;
}

export interface PARAArea {
  id: string;
  title: string;
  description?: string;
  projects: string[]; // Project IDs
  resources: string[]; // Resource IDs
  priority?: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  goal?: string;
  kpis?: string[];
  source: 'notion' | 'linear' | 'manual';
  sourceId?: string;
  metadata?: Record<string, any>;
}

export interface PARAResource {
  id: string;
  title: string;
  description?: string;
  type: 'note' | 'document' | 'link' | 'file' | 'reference';
  content?: string;
  url?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  lastAccessed?: Date;
  accessCount?: number;
  relatedAreas: string[]; // Area IDs
  source: 'notion' | 'linear' | 'manual';
  sourceId?: string;
  metadata?: Record<string, any>;
}

export interface PARAArchive {
  id: string;
  title: string;
  description?: string;
  originalStage: PARAStage;
  archivedAt: Date;
  reason: 'completed' | 'obsolete' | 'deferred' | 'consolidated';
  relationships: string[]; // IDs of related archived items
  lessonsLearned?: string;
  source: 'notion' | 'linear' | 'manual';
  sourceId?: string;
  metadata?: Record<string, any>;
}

export interface PARADatabase {
  tasks: PARATask[];
  projects: PARAProject[];
  areas: PARAArea[];
  resources: PARAResource[];
  archives: PARAArchive[];
  lastSync: Date;
  coherenceIssues: CoherenceIssue[];
}

export interface CoherenceIssue {
  id: string;
  type: 'broken_link' | 'orphaned_item' | 'inconsistent_tags' | 'missing_relationship' | 'duplicate_item';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affectedItems: string[];
  suggestedFix?: string;
  detectedAt: Date;
  resolvedAt?: Date;
}

export interface StrategicOpportunity {
  id: string;
  type: 'building_block' | 'near_completion' | 'cross_area_impact' | 'high_dependency' | 'delegation_candidate';
  title: string;
  description: string;
  affectedItems: string[];
  potentialValue: number; // Estimated impact score
  urgency: 'low' | 'medium' | 'high';
  detectedAt: Date;
  actionTaken?: string;
  actionDate?: Date;
}

