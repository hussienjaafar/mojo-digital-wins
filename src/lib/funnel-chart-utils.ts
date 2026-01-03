/**
 * Funnel Chart Data Preprocessing Utilities
 * Provides sequential validation, conversion calculations, and drop-off analysis
 */

export interface FunnelStage {
  name: string;
  value: number;
  color?: string;
  order?: number;
}

export interface ProcessedFunnelStage extends FunnelStage {
  /** Conversion rate from previous stage (0-100) */
  stepConversionRate: number | null;
  /** Cumulative conversion from first stage (0-100) */
  cumulativeConversionRate: number;
  /** Drop-off count from previous stage */
  dropOffCount: number;
  /** Drop-off percentage from previous stage */
  dropOffPercent: number;
  /** Stage index (0-based) */
  stageIndex: number;
  /** Is this stage valid in sequence (value <= previous) */
  isValidSequence: boolean;
}

export interface FunnelAnalysis {
  /** Processed stages with metrics */
  stages: ProcessedFunnelStage[];
  /** Is the funnel strictly sequential (each stage <= previous) */
  isSequential: boolean;
  /** Total count at funnel entry */
  entryCount: number;
  /** Total count at funnel exit */
  exitCount: number;
  /** Overall conversion rate (exit/entry) */
  overallConversionRate: number;
  /** Total drop-off count */
  totalDropOff: number;
  /** Index of biggest drop-off stage */
  biggestDropOffIndex: number | null;
  /** The biggest drop-off stage details */
  biggestDropOffStage: ProcessedFunnelStage | null;
  /** Stages that violate sequential order */
  invalidStages: number[];
}

/**
 * Validate if funnel data is truly sequential
 * A sequential funnel has each stage value <= the previous stage
 */
export function isSequentialFunnel(stages: FunnelStage[]): boolean {
  if (stages.length < 2) return true;
  
  for (let i = 1; i < stages.length; i++) {
    if (stages[i].value > stages[i - 1].value) {
      return false;
    }
  }
  return true;
}

/**
 * Find stages that violate sequential order
 */
export function findInvalidStages(stages: FunnelStage[]): number[] {
  const invalid: number[] = [];
  
  for (let i = 1; i < stages.length; i++) {
    if (stages[i].value > stages[i - 1].value) {
      invalid.push(i);
    }
  }
  
  return invalid;
}

/**
 * Process funnel data with full analysis
 */
export function analyzeFunnel(stages: FunnelStage[]): FunnelAnalysis {
  if (stages.length === 0) {
    return {
      stages: [],
      isSequential: true,
      entryCount: 0,
      exitCount: 0,
      overallConversionRate: 0,
      totalDropOff: 0,
      biggestDropOffIndex: null,
      biggestDropOffStage: null,
      invalidStages: [],
    };
  }

  const entryCount = stages[0].value;
  const exitCount = stages[stages.length - 1].value;
  const isSequential = isSequentialFunnel(stages);
  const invalidStages = findInvalidStages(stages);

  // Process each stage
  const processedStages: ProcessedFunnelStage[] = stages.map((stage, index) => {
    const prevValue = index > 0 ? stages[index - 1].value : stage.value;
    const isFirst = index === 0;
    
    // Step conversion: current / previous (null for first stage)
    const stepConversionRate = isFirst 
      ? null 
      : (prevValue > 0 ? (stage.value / prevValue) * 100 : 0);
    
    // Cumulative conversion: current / first
    const cumulativeConversionRate = entryCount > 0 
      ? (stage.value / entryCount) * 100 
      : 0;
    
    // Drop-off from previous stage
    const dropOffCount = isFirst ? 0 : Math.max(0, prevValue - stage.value);
    const dropOffPercent = isFirst || prevValue === 0 
      ? 0 
      : (dropOffCount / prevValue) * 100;
    
    // Check if this stage violates sequence
    const isValidSequence = isFirst || stage.value <= prevValue;

    return {
      ...stage,
      stepConversionRate,
      cumulativeConversionRate,
      dropOffCount,
      dropOffPercent,
      stageIndex: index,
      isValidSequence,
    };
  });

  // Find biggest drop-off
  let biggestDropOffIndex: number | null = null;
  let maxDropOff = 0;
  
  for (let i = 1; i < processedStages.length; i++) {
    if (processedStages[i].dropOffCount > maxDropOff) {
      maxDropOff = processedStages[i].dropOffCount;
      biggestDropOffIndex = i;
    }
  }

  const biggestDropOffStage = biggestDropOffIndex !== null 
    ? processedStages[biggestDropOffIndex] 
    : null;

  return {
    stages: processedStages,
    isSequential,
    entryCount,
    exitCount,
    overallConversionRate: entryCount > 0 ? (exitCount / entryCount) * 100 : 0,
    totalDropOff: entryCount - exitCount,
    biggestDropOffIndex,
    biggestDropOffStage,
    invalidStages,
  };
}

/**
 * Transform funnel data to ranked bar format (for non-sequential data)
 */
export function funnelToRankedBars(stages: FunnelStage[]): FunnelStage[] {
  return [...stages].sort((a, b) => b.value - a.value);
}

/**
 * Get stage name pair for drop-off display
 */
export function getDropOffLabel(fromStage: string, toStage: string): string {
  return `${fromStage} → ${toStage}`;
}

/**
 * Format conversion rate for display
 */
export function formatConversionRate(rate: number | null, decimals: number = 1): string {
  if (rate === null) return '—';
  return `${rate.toFixed(decimals)}%`;
}

/**
 * Get severity level for drop-off percentage
 */
export function getDropOffSeverity(dropOffPercent: number): 'low' | 'medium' | 'high' | 'critical' {
  if (dropOffPercent < 20) return 'low';
  if (dropOffPercent < 40) return 'medium';
  if (dropOffPercent < 60) return 'high';
  return 'critical';
}

/**
 * Get color for severity level
 */
export function getSeverityColor(severity: 'low' | 'medium' | 'high' | 'critical'): string {
  switch (severity) {
    case 'low': return 'hsl(var(--portal-success))';
    case 'medium': return 'hsl(var(--portal-warning))';
    case 'high': return 'hsl(var(--portal-error) / 0.7)';
    case 'critical': return 'hsl(var(--portal-error))';
  }
}
