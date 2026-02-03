// Color utilities for heatmap and score visualization

export const COLORS = {
  bgPrimary: '#0F1117',
  bgSecondary: '#1A1D27',
  bgTertiary: '#22252F',
  borderPrimary: '#2A2D37',
  borderSecondary: '#363944',
  accentPrimary: '#00D4AA',
  accentSecondary: '#F59E0B',
  negative: '#EF4444',
  positive: '#10B981',
  textPrimary: '#E5E7EB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
};

export const COMPETITOR_COLORS: Record<string, string> = {
  'TechFlow': '#00D4AA',
  'Asana': '#F06A6A',
  'Monday.com': '#0073EA',
  'ClickUp': '#7B68EE',
  'Notion': '#FFFFFF',
  'Other': '#6B7280',
};

export const CHART_COLORS = [
  '#00D4AA', // Primary accent
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#14B8A6', // Teal
];

// Heatmap color based on consistency score
export function getHeatmapColor(consistency: number): string {
  if (consistency === 0) return '#EF4444'; // Red - never cited
  if (consistency < 0.33) return '#F59E0B'; // Amber - cited weakly
  if (consistency < 0.67) return '#84CC16'; // Light green - sometimes cited
  return '#10B981'; // Dark green - consistently cited
}

export function getHeatmapBgClass(consistency: number): string {
  if (consistency === 0) return 'bg-red-500/20 border-red-500/40';
  if (consistency < 0.33) return 'bg-amber-500/20 border-amber-500/40';
  if (consistency < 0.67) return 'bg-lime-500/20 border-lime-500/40';
  return 'bg-emerald-500/20 border-emerald-500/40';
}

export function getHeatmapTextClass(consistency: number): string {
  if (consistency === 0) return 'text-red-400';
  if (consistency < 0.33) return 'text-amber-400';
  if (consistency < 0.67) return 'text-lime-400';
  return 'text-emerald-400';
}

// Score color based on value (0-100)
export function getScoreColor(score: number): string {
  if (score < 25) return '#EF4444';
  if (score < 50) return '#F59E0B';
  if (score < 75) return '#84CC16';
  return '#10B981';
}

export function getScoreTextClass(score: number): string {
  if (score < 25) return 'text-red-400';
  if (score < 50) return 'text-amber-400';
  if (score < 75) return 'text-lime-400';
  return 'text-emerald-400';
}

// Position color (lower is better)
export function getPositionColor(position: number | null): string {
  if (position === null) return '#6B7280';
  if (position <= 2) return '#10B981';
  if (position <= 4) return '#84CC16';
  if (position <= 6) return '#F59E0B';
  return '#EF4444';
}

// Citation share color
export function getCitationShareColor(share: number): string {
  if (share < 0.1) return '#EF4444';
  if (share < 0.2) return '#F59E0B';
  if (share < 0.3) return '#84CC16';
  return '#10B981';
}
