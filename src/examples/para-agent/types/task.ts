/**
 * Task Score Calculation Types
 * Based on Amplenote-style productivity philosophy
 */

export interface TaskScoreFactors {
  // Note activity (frequently opened notes gain score daily)
  noteActivity: number; // 0-10 based on access frequency

  // Urgency/Importance (urgent: fast ramp up, important: 3x accumulation)
  urgency: number; // 0-10
  importance: number; // 0-10

  // Deadlines/Due dates (+10 points if due today or overdue)
  deadlinePressure: number; // 0, 5, or 10

  // Duration & blocking (quick wins or blockers get boost)
  duration: number; // negative for long tasks, positive for quick wins
  blocking: number; // positive if blocks other important tasks

  // Cross-area impact (building blocks for other areas)
  crossAreaImpact: number; // 0-5 based on how many areas it affects

  // Age factor (older items decay unless actively worked on)
  age: number; // negative over time unless activity increases

  // Completion momentum (recent progress boosts score)
  momentum: number; // based on recent updates/completions
}

export interface TaskScoreResult {
  totalScore: number;
  factors: TaskScoreFactors;
  colorCode: 'red' | 'gold' | 'normal'; // red: >=10, gold: >=5, normal: <5
  breakdown: {
    activity: number;
    priority: number;
    timing: number;
    impact: number;
    momentum: number;
  };
  lastCalculated: Date;
}

export interface VictoryValue {
  taskId: string;
  moodRating: number; // 1-5 scale
  duration: number; // minutes spent
  leverage: number; // how many other tasks this unblocked
  completionDate: Date;
  value: number; // calculated victory value
  notes?: string;
}

export interface GoodLifeAlgorithm {
  // Rolling average of victory values
  averageVictoryValue: number;

  // Preferred task characteristics learned from victories
  preferredUrgency: number;
  preferredDuration: number;
  preferredDomains: string[];

  // Energy patterns
  highEnergyTimes: string[];
  lowEnergyTimes: string[];

  // Updated based on completed tasks
  lastUpdated: Date;
}

export interface TaskScoreConfig {
  // Weight factors for score calculation
  weights: {
    noteActivity: number;
    urgency: number;
    importance: number;
    deadlinePressure: number;
    duration: number;
    blocking: number;
    crossAreaImpact: number;
    age: number;
    momentum: number;
  };

  // Thresholds for color coding
  thresholds: {
    red: number; // >= this score
    gold: number; // >= this score
  };

  // Decay rates
  decay: {
    agePenaltyPerDay: number;
    activityBoostDecay: number;
  };

  // Victory value calculation
  victory: {
    moodWeight: number;
    durationWeight: number;
    leverageWeight: number;
  };
}

