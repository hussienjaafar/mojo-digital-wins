// ============================================================
// Poll Data Types & Registry
// To add a new poll, create a data file and add it to `polls`.
// ============================================================

// ---------- Section Types ----------

export interface GroupedBarSection {
  type: "grouped-bar";
  title: string;
  description?: string;
  xAxisKey: string;
  series: { dataKey: string; name: string; color?: string }[];
  data: Record<string, unknown>[];
  /** Optional shift annotations, keyed by candidate name */
  shifts?: Record<string, string>;
  valueType?: "percent" | "number";
}

export interface StackedBarSection {
  type: "stacked-bar";
  title: string;
  description?: string;
  xAxisKey: string;
  series: { dataKey: string; name: string; color?: string; stack: string }[];
  data: Record<string, unknown>[];
  netLabel?: string;
  valueType?: "percent" | "number";
}

export interface DonutSection {
  type: "donut";
  title: string;
  description?: string;
  data: { name: string; value: number; color?: string }[];
}

export interface HorizontalBarSection {
  type: "horizontal-bar";
  title: string;
  description?: string;
  xAxisKey: string;
  series: { dataKey: string; name: string; color?: string }[];
  data: Record<string, unknown>[];
  netLabel?: string;
  valueType?: "percent" | "number";
}

export type PollSection =
  | GroupedBarSection
  | StackedBarSection
  | DonutSection
  | HorizontalBarSection;

// ---------- Methodology ----------

export interface DemographicRow {
  category: string;
  breakdown: { label: string; value: string }[];
}

export interface MethodologyData {
  description: string;
  demographics: DemographicRow[];
  geographicNote?: string;
}

// ---------- Poll ----------

export interface PollData {
  slug: string;
  title: string;
  subtitle: string;
  date: string;
  sponsor: string;
  sampleSize: number;
  marginOfError: number;
  population: string;
  keyFinding: string;
  sections: PollSection[];
  methodology: MethodologyData;
}

// ---------- Registry ----------

import { va6Poll } from "./va6-2026";
import { il9Poll } from "./il9-2026";

export const polls: PollData[] = [il9Poll, va6Poll];

export function getPollBySlug(slug: string): PollData | undefined {
  return polls.find((p) => p.slug === slug);
}
