/**
 * ResearchPage — Phase 2 nav redesign
 * Screening hub: IV crush candidates, pre-trade gates, click-through to Analyse.
 * Wraps CandidatesPage with a Research-focused header.
 */
import CandidatesPage from './CandidatesPage';

export default function ResearchPage({ embedded = false }: { embedded?: boolean } = {}) {
  return <CandidatesPage embedded={embedded} />;
}
