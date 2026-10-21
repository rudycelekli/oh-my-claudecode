import { resolveContextPercent, resolveTranscriptContextPercent } from './context-usage.mjs';

const AGENT_HEAVY_TOOLS = new Set(['Task', 'Agent', 'TaskCreate', 'TaskUpdate']);
const DEFAULT_PREFLIGHT_CONTEXT_THRESHOLD = 72;

export function getPreflightContextThreshold(env = process.env) {
  const value = env.OMC_AGENT_PREFLIGHT_CONTEXT_THRESHOLD;
  if (!value) return DEFAULT_PREFLIGHT_CONTEXT_THRESHOLD;

  const normalized = String(value).trim();
  if (!/^\d+$/.test(normalized)) return DEFAULT_PREFLIGHT_CONTEXT_THRESHOLD;

  const parsed = Number.parseInt(normalized, 10);
  if (parsed < 1 || parsed > 100) return DEFAULT_PREFLIGHT_CONTEXT_THRESHOLD;

  return parsed;
}

// Preserve the synchronous transcript-only helper for existing callers.
export function estimateContextPercent(transcriptPath) {
  return resolveTranscriptContextPercent(transcriptPath) ?? 0;
}

export function buildPreflightRecoveryAdvice(contextPercent, threshold = DEFAULT_PREFLIGHT_CONTEXT_THRESHOLD) {
  return `[OMC] Preflight context guard: ${contextPercent}% used ` +
    `(threshold: ${threshold}%). Avoid spawning additional agent-heavy tasks ` +
    `until context is reduced. Safe recovery: (1) pause new Task fan-out, (2) run /compact now, ` +
    `(3) if compact fails, open a fresh session and continue from .omc/state + .omc/notepad.md.`;
}

export async function evaluateAgentHeavyPreflight({ toolName, transcriptPath, data = {}, directory, env = process.env }) {
  if (!AGENT_HEAVY_TOOLS.has(toolName)) return null;

  const threshold = getPreflightContextThreshold(env);
  const contextPercent = await resolveContextPercent(data, transcriptPath, directory);
  if (contextPercent === null || contextPercent < threshold) return null;

  return {
    decision: 'block',
    reason: buildPreflightRecoveryAdvice(contextPercent, threshold),
  };
}
