import { AgentTask, IAgent } from './agent-types.js';

/**
 * ExpertiseMatcher
 *
 * A full, production-ready fallback matcher that:
 * - Normalizes domains (synonyms, punctuation, casing)
 * - Computes a multi-factor score (domain match, proficiency, recency, availability, load, performance)
 * - Performs fuzzy/partial matching when exact matches are missing
 * - Returns a ranked list filtered by a configurable threshold and max results
 *
 * Intended to be used as a fallback matcher when primary/legacy matching fails.
 */
export class ExpertiseMatcher {
  // Mark this implementation as intended for fallback usage
  public static readonly isFallback = true;

  private readonly synonyms: Record<string, string[]> = {
    // common synonyms / abbreviations -> canonical
    nlp: ['natural language processing', 'nlp'],
    'natural language processing': ['natural language processing', 'nlp'],
    ml: ['machine learning', 'ml'],
    'machine learning': ['machine learning', 'ml'],
    ai: ['artificial intelligence', 'ai'],
    'artificial intelligence': ['artificial intelligence', 'ai'],
    frontend: ['frontend', 'ui', 'ux'],
    backend: ['backend', 'server', 'api'],
    devops: ['devops', 'sre', 'site reliability'],
    // extend as needed
  };

  private readonly defaultWeights = {
    domain: 0.55,
    proficiency: 0.18,
    recency: 0.1,
    availability: 0.08,
    load: 0.05,
    performance: 0.04,
  };

  private readonly weights: typeof this.defaultWeights;

  public constructor(
    weights?: Readonly<Partial<typeof ExpertiseMatcher.prototype.defaultWeights>>
  ) {
    // Allow override of weights, but keep defaults if keys missing
    this.weights = { ...this.defaultWeights, ...(weights ?? {}) };
  }

  /**
   * Primary public matcher. This implementation is written to serve as a robust fallback:
   * - Validates input
   * - Produces ranked agents with scores
   * - Returns topN agents above threshold
   *
   * Options:
   * - threshold: minimum score (0..1) to include
   */
  public matchAgents(
    task: Readonly<AgentTask>,
    agents: ReadonlyArray<Readonly<IAgent>>,
    options?: Readonly<{ threshold?: number; maxResults?: number }>
  ): IAgent[] {
    if (!task || !Array.isArray(task.expertiseDomains) || task.expertiseDomains.length === 0) {
      throw new Error(
        'Task must specify expertiseDomains (non-empty array). Fallback expertise matching cannot be performed otherwise.'
      );
    }
    const threshold: number = typeof options?.threshold === 'number' ? options.threshold : 0.35; // relaxed threshold for fallback
    const maxResults: number = typeof options?.maxResults === 'number' ? options.maxResults : 10;

    const required: string[] = task.expertiseDomains.map((d: string) =>
      this.normalizeDomain(String(d))
    );

    const scored = agents
      .map((agent: Readonly<IAgent>) => ({ agent, score: this.calculateScore(agent, required) }))
      .filter(
        (item: { agent: Readonly<IAgent>; score: number }) =>
          Number.isFinite(item.score) && item.score > 0
      ) // drop NaN or zero scorers early
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    return scored
      .filter((s: { score: number }) => s.score >= threshold)
      .slice(0, maxResults)
      .map((s: { agent: Readonly<IAgent> }) => s.agent);
  }

  // -------------------------
  // Internal scoring functions
  // -------------------------

  private calculateScore(agent: IAgent, requiredDomains: string[]): number {
    const agentDomainsRaw = Array.isArray(agent.expertiseDomains)
      ? agent.expertiseDomains.map(d => String(d))
      : [];
    if (agentDomainsRaw.length === 0) {
      // still compute some score using availability/performance if available,
      // but domain score will be zero and likely below threshold.
    }

    const agentDomains = agentDomainsRaw.map(d => this.normalizeDomain(d));
    const domainScore = this.domainMatchScore(agentDomains, requiredDomains);
    if (domainScore === 0) {
      // If domain score is zero, it's still possible to surface an agent if they have high availability/performance in fallback,
      // but typically that will be filtered by threshold in matchAgents().
    }

    const proficiencyScore = this.proficiencyScore(agent, requiredDomains, agentDomains);
    const recencyScore = this.recencyScore(agent);
    const availabilityScore = this.availabilityScore(agent);
    const loadScore = this.loadScore(agent);
    const performanceScore = this.performanceScore(agent);

    // Weighted sum
    const w: typeof this.defaultWeights = this.weights;
    const total = clamp01(
      w.domain * domainScore +
        w.proficiency * proficiencyScore +
        w.recency * recencyScore +
        w.availability * availabilityScore +
        w.load * loadScore +
        w.performance * performanceScore
    );

    return total;
  }

  private domainMatchScore(agentDomains: string[], requiredDomains: string[]): number {
    if (!requiredDomains || requiredDomains.length === 0) return 0;
    const perReqScores: number[] = requiredDomains.map(req => {
      // exact match
      if (agentDomains.includes(req)) return 1.0;

      // synonym match (agent domain is in synonym group of req)
      for (const [_canon, aliases] of Object.entries(this.synonyms)) {
        const normalizedAliases = aliases.map(a => this.normalizeDomain(a));
        if (
          normalizedAliases.includes(req) &&
          agentDomains.some(d => normalizedAliases.includes(d))
        ) {
          return 0.85;
        }
      }

      // token overlap heuristic (e.g., "machine learning" vs "learning models")
      const reqTokens = tokenize(req);
      let bestOverlap = 0;
      for (const ad of agentDomains) {
        const adTokens = tokenize(ad);
        const overlap = tokenOverlapScore(reqTokens, adTokens);
        if (overlap > bestOverlap) bestOverlap = overlap;
      }
      if (bestOverlap >= 0.65) return 0.6;
      if (bestOverlap >= 0.35) return 0.35;

      // no match
      return 0;
    });

    // Average across required domains so agents matching more requirements score higher
    const avg = perReqScores.reduce((s, v) => s + v, 0) / requiredDomains.length;
    return clamp01(avg);
  }

  private proficiencyScore(
    agent: Readonly<IAgent>,
    requiredDomains: ReadonlyArray<string>,
    agentDomains: ReadonlyArray<string>
  ): number {
    // agent.proficiencies expected shape: Record<domain, number|string>
    const profs = (agent as { proficiencies?: Record<string, number | string> }).proficiencies;
    if (typeof profs !== 'object' || profs === null) return 0;

    const mappedScores: number[] = [];

    for (const req of requiredDomains) {
      // find best matching agent domain for this required domain
      let bestDomainMatch: string | null = null;
      let bestMatchScore = 0;
      for (const ad of agentDomains) {
        const score = tokenOverlapScore(tokenize(req), tokenize(ad));
        if (score > bestMatchScore) {
          bestMatchScore = score;
          bestDomainMatch = ad;
        }
      }
      if (!bestDomainMatch) continue;

      let raw: unknown = undefined;
      if (Object.prototype.hasOwnProperty.call(profs, bestDomainMatch)) {
        raw = profs[bestDomainMatch];
      } else if (Object.prototype.hasOwnProperty.call(profs, req)) {
        raw = profs[req];
      }

      if (raw === undefined || raw === null) {
        // fallback: some agents might store a global proficiency
        let global: unknown = undefined;
        if (Object.prototype.hasOwnProperty.call(profs, '*')) {
          ({ ['*']: global } = profs);
        } else if (Object.prototype.hasOwnProperty.call(profs, 'global')) {
          ({ global } = profs);
        }
        if (global !== undefined && global !== null) {
          mappedScores.push(normalizeProficiency(global));
        }
        continue;
      }
      mappedScores.push(normalizeProficiency(raw));
    }

    if (mappedScores.length === 0) return 0;
    return clamp01(mappedScores.reduce((s, v) => s + v, 0) / mappedScores.length);
  }

  private recencyScore(agent: Readonly<IAgent>): number {
    // prefer agents active recently
    const { lastActive } = agent as { lastActive?: string | number };
    if (!lastActive) return 0.4; // unknown -> neutral
    const ts =
      typeof lastActive === 'string' || typeof lastActive === 'number'
        ? Date.parse(String(lastActive)) || Number(lastActive)
        : undefined;
    if (!ts || Number.isNaN(ts)) return 0.4;
    const days = (Date.now() - ts) / (1000 * 60 * 60 * 24);
    // linear decay over a year, clamp
    const score = clamp01(1 - days / 365);
    return score;
  }

  private availabilityScore(agent: Readonly<IAgent>): number {
    // availability may be boolean, string, or days-until-free number
    const { availability: a } = agent as { availability?: boolean | string | number };
    if (typeof a === 'boolean') return a ? 1 : 0;
    if (typeof a === 'string') {
      const low = a.toLowerCase();
      if (low.includes('avail')) return 1;
      if (low.includes('unavail') || low.includes('busy')) return 0;
    }
    if (typeof a === 'number') {
      // days until free: sooner is better
      return clamp01(1 - a / 30);
    }
    // fallback to explicit flag or undefined
    return 0.5;
  }

  private loadScore(agent: Readonly<IAgent>): number {
    // currentLoad may be 0..1 fraction or integer count
    const load: number | undefined = (agent as { currentLoad?: number })?.currentLoad;
    if (load === null || load === undefined) return 0.6;
    if (typeof load === 'number') {
      if (load >= 0 && load <= 1) return clamp01(1 - load); // fraction busy
      // otherwise treat as count: more tasks -> lower score; use heuristic 1/(1+count)
      return clamp01(1 / (1 + load));
    }
    return 0.6;
  }

  /**
   * Computes a normalized performance score for the agent based on past performance rating.
   * @param agent - The agent whose performance is being evaluated.
   * @returns A score between 0 and 1.
   */
  private performanceScore(agent: Readonly<IAgent>): number {
    // pastPerformanceRating: prefer scale 0..5 or 0..100
    const r: unknown = (agent as { pastPerformanceRating?: unknown }).pastPerformanceRating;
    if (r === null || r === undefined) return 0.5;
    if (typeof r === 'number') {
      if (r <= 5) return clamp01(r / 5);
      if (r <= 100) return clamp01(r / 100);
    }
    return 0.5;
  }

  // -------------------------
  // Helpers
  // -------------------------

  private normalizeDomain(d: string): string {
    let s = String(d).toLowerCase().trim();
    s = s.replace(/[^\w\s-]/g, ''); // strip punctuation except hyphen/underscore
    s = s.replace(/\s+/g, ' ').trim();
    // map known aliases to canonical name if found
    for (const [canon, aliases] of Object.entries(this.synonyms)) {
      for (const alias of aliases) {
        if (s === alias) return this.normalizeDomain(canon);
      }
    }
    return s;
  }

  public async initialize(): Promise<void> {
    // Initialize expertise matcher
    // Future: Load expertise mappings and configurations
  }

  public async shutdown(): Promise<void> {
    // Cleanup expertise matcher
  }
}

// -------------------------
// Small utility functions
// -------------------------

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .split(/[\s\-_/]+/)
    .filter(Boolean);
}

function tokenOverlapScore(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const tok of setA) if (setB.has(tok)) intersection++;
  // use Jaccard-like measure weighted toward smaller sets
  const union = new Set([...setA, ...setB]).size || 1;
  return intersection / union;
}

function normalizeProficiency(raw: unknown): number {
  if (raw === null) return 0;
  if (typeof raw === 'number') {
    // assume 0..10 or 0..100 or 0..1; normalize heuristically
    if (raw <= 1) return clamp01(raw); // already 0..1
    if (raw <= 10) return clamp01(raw / 10);
    if (raw <= 100) return clamp01(raw / 100);
    return 0.5;
  }
  if (typeof raw === 'string') {
    const s = raw.toLowerCase().trim();
    if (['junior', 'jr', 'j'].includes(s)) return 0.3;
    if (['mid', 'intermediate', 'm'].includes(s)) return 0.6;
    if (['senior', 'sr', 's'].includes(s)) return 0.9;
    const parsed = Number(s);
    if (!Number.isNaN(parsed)) return normalizeProficiency(parsed);
  }
  return 0;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}
