export type LightweightAnalysis = {
  summary: string;
  riskLevel: 'low' | 'medium' | 'high';
  observations: string[];
  signals: string[];
  recommendation: string;
};
