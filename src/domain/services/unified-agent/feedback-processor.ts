import { AgentFeedback, IAgent } from './agent-types.js';

/**
 * Handles agent feedback and learning updates.
 *
 * This implementation:
 * - Validates and normalizes incoming feedback.
 * - Deduplicates identical feedback recently seen for the same agent.
 * - Serializes processing per-agent to avoid concurrent learn() calls for the same agent.
 * - Retries agent.learn with exponential backoff on transient failures.
 * - Enforces a timeout for the learn call.
 * - Emits concise console logs for observability.
 */
export class FeedbackProcessor {
  // Per-agent processing queue to serialize learn calls for an agent
  private static readonly agentQueues: Map<string, Promise<void>> = new Map();

  // Per-agent recent feedback hashes for simple deduplication with TTL
  private static readonly recentFeedback: Map<string, Map<string, number>> = new Map();

  // Configuration
  private static readonly DEDUPE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly MAX_RETRY = 3;
  private static readonly BASE_RETRY_DELAY_MS = 200;
  private static readonly LEARN_TIMEOUT_MS = 10_000; // 10 seconds
  private static readonly CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  // Schedule periodic cleanup of old dedupe entries using a static initializer
  static {
    setInterval(() => {
      const now = Date.now();
      for (const [, feedMap] of FeedbackProcessor.recentFeedback.entries()) {
        for (const [hash, ts] of feedMap.entries()) {
          if (now - ts > FeedbackProcessor.DEDUPE_TTL_MS) {
            feedMap.delete(hash);
          }
        }
      }
    }, FeedbackProcessor.CLEANUP_INTERVAL_MS);
  }

  public async process(agent: Readonly<IAgent>, feedback: Readonly<AgentFeedback>): Promise<void> {
    const agentId = (() => {
      const a = agent as unknown as { id?: string; name?: string };
      if (typeof a.id === 'string' && a.id.trim().length > 0) return a.id;
      if (typeof a.name === 'string' && a.name.trim().length > 0) return a.name;
      return 'unknown-agent';
    })();

    // Validate
    if (!FeedbackProcessor.isValidFeedback(feedback)) {
      console.warn(`[FeedbackProcessor:${agentId}] Invalid feedback object; ignoring.`);
      return;
    }

    // Normalize & enrich
    const normalized = FeedbackProcessor.normalizeFeedback(feedback);

    // Deduplicate
    const hash = FeedbackProcessor.hashString(JSON.stringify(normalized));
    if (FeedbackProcessor.isDuplicate(agentId, hash)) {
      console.info(`[FeedbackProcessor:${agentId}] Duplicate feedback ignored.`);
      return;
    }
    // Record feedback hash for deduplication
    FeedbackProcessor.recordFeedbackHash(agentId, hash);

    // Create the task that will call agent.learn with retries and timeout
    const task = async () => {
      const maybeLearn = (agent as unknown as { learn?: (f: AgentFeedback) => Promise<unknown> }).learn;
      if (typeof maybeLearn !== 'function') {
        throw new Error('agent.learn is not a function');
      }
      for (let attempt = 1; attempt <= FeedbackProcessor.MAX_RETRY; attempt++) {
        try {
          await FeedbackProcessor.withTimeout(
            maybeLearn.call(agent, normalized),
            FeedbackProcessor.LEARN_TIMEOUT_MS
          );
          console.info(`[FeedbackProcessor:${agentId}] Feedback processed (attempt ${attempt}).`);
          return;
        } catch (err) {
          const isLast = attempt === FeedbackProcessor.MAX_RETRY;
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn(
            `[FeedbackProcessor:${agentId}] learn() failed on attempt ${attempt}: ${errMsg}`
          );
          if (isLast) {
            console.error(
              `[FeedbackProcessor:${agentId}] learn() failed after ${FeedbackProcessor.MAX_RETRY} attempts.`
            );
            // Surface the error to caller
            throw err;
          }
          const delay = FeedbackProcessor.BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
          await FeedbackProcessor.sleep(delay);
        }
      }
    };

    // Enqueue the task for this agent to serialize calls
    await this.enqueue(agentId, task);
  }
  // --- Helpers ---

  private static isValidFeedback(feedback: Readonly<AgentFeedback>): boolean {
    // feedback is always defined and an object due to typing, so no need for the first check
    // Check for common feedback shapes
    if (
      typeof feedback === 'object' &&
      feedback !== null &&
      'content' in feedback &&
      typeof (feedback as { content: unknown }).content === 'string' &&
      (feedback as { content: string }).content.trim().length > 0
    ) {
      return true;
    }
    if (
      typeof feedback === 'object' &&
      feedback !== null &&
      'message' in feedback &&
      typeof (feedback as { message: unknown }).message === 'string' &&
      (feedback as { message: string }).message.trim().length > 0
    ) {
      return true;
    }
    if (typeof (feedback as { rating?: unknown }).rating === 'number') {
      return true;
    }
    // Accept non-empty objects as a last resort
    return Object.keys(feedback as object).length > 0;
  }

  private static normalizeFeedback(feedback: Readonly<AgentFeedback>): AgentFeedback {
    // Create a shallow copy to avoid mutating the original
    const normalized: Record<string, unknown> = { ...feedback };

    // Normalize common text fields
    const normalizeText = (t: unknown): unknown =>
      typeof t === 'string' ? t.replace(/\s+/g, ' ').trim() : t;

    if (
      'content' in normalized &&
      typeof normalized.content === 'string'
    ) {
      normalized.content = normalizeText(normalized.content);
    }
    if (
      'message' in normalized &&
      typeof normalized.message === 'string'
    ) {
      normalized.message = normalizeText(normalized.message);
    }
    if (
      'source' in normalized &&
      typeof normalized.source === 'string'
    ) {
      normalized.source = normalized.source.trim();
    }

    // Enrich with processing metadata (non-destructive)
    normalized._processedAt = new Date().toISOString();
    normalized._processorVersion = 'feedback-processor-v1';

    return normalized as unknown as AgentFeedback;
  }

  private static isDuplicate(agentId: string, hash: string): boolean {
    const feedMap = FeedbackProcessor.recentFeedback.get(agentId);
    if (!feedMap) return false;
    // Remove expired entries proactively
    const ts = feedMap.get(hash);
    if (!ts) return false;
    if (Date.now() - ts > FeedbackProcessor.DEDUPE_TTL_MS) {
      feedMap.delete(hash);
      return false;
    }
    return true;
  }

  private static recordFeedbackHash(agentId: string, hash: string): void {
    let feedMap = FeedbackProcessor.recentFeedback.get(agentId);
    if (!feedMap) {
      feedMap = new Map<string, number>();
      FeedbackProcessor.recentFeedback.set(agentId, feedMap);
    }
    feedMap.set(hash, Date.now());
  }

  private async enqueue(agentId: string, taskFn: () => Promise<void>): Promise<void> {
    const prev = FeedbackProcessor.agentQueues.get(agentId) ?? Promise.resolve();
    const next = prev
      .catch(() => {
        // swallow errors from previous task so queue continues
      })
      .then(async () => { await taskFn(); });
    FeedbackProcessor.agentQueues.set(agentId, next);
    return next;
  }

  private static async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private static hashString(input: string): string {
    // djb2 string hash -> hex
    let h = 5381;
    for (let i = 0; i < input.length; i++) {
      h = (h * 33) ^ input.charCodeAt(i);
    }
    // Convert to unsigned 32-bit hex
    return (h >>> 0).toString(16);
  }

  private static async withTimeout<T>(p: Readonly<Promise<T>>, ms: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => { reject(new Error('operation timed out')); }, ms);
    });
    return Promise.race([p, timeout]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    }) as Promise<T>;
  }

  public async initialize(): Promise<void> {
    // Initialize feedback processor
  }

  public async shutdown(): Promise<void> {
    // Cleanup feedback processor
  }
}
