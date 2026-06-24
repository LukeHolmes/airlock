import { generateLightweightAnalysis } from '../analysis/lightweightAnalysis.js';
import type { LightweightAnalysis } from '../analysis/types.js';
import { getSessionArtefacts } from './artefacts.js';

export type SessionAnalysisResult = {
  sessionId: string;
  analysis: LightweightAnalysis;
};

export async function analyzeSession(sessionId: string): Promise<SessionAnalysisResult> {
  const artefacts = getSessionArtefacts(sessionId);
  const analysis = generateLightweightAnalysis(artefacts);

  return {
    sessionId,
    analysis,
  };
}
