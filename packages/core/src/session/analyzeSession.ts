import { getSessionArtefacts } from './artefacts.js';

export type SessionAnalysisResult = {
  status: 'not_implemented';
  message: string;
  artefactsSummary: {
    input: {
      type: 'file' | 'url';
      value: string;
    };
    eventCount: number;
  };
};

export async function analyzeSession(sessionId: string): Promise<SessionAnalysisResult> {
  const artefacts = getSessionArtefacts(sessionId);

  return {
    status: 'not_implemented',
    message: 'Analysis engine will be available in v0.3',
    artefactsSummary: {
      input: artefacts.input,
      eventCount: artefacts.logs.length,
    },
  };
}
