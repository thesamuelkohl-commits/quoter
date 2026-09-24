import type { ComplexityLevel, Department } from "./types";

/**
 * The AI interpretation layer's whole job is turning fuzzy human input into
 * structured hints and readable prose — it never produces a price or a
 * staffing number itself ("AI interprets. RULES calculate. DATA
 * validates."). This interface is implemented by a deterministic heuristic
 * stub for V1; swapping in a real Claude call later means writing a new
 * class that implements `AiInterpreter` and changing one line in
 * `getAiInterpreter()` below — nothing else in the engine layer changes.
 */
export interface DepartmentHint {
  department: Department;
  suggestedComplexity: ComplexityLevel;
  reason: string;
}

export interface InterpretedRequirements {
  departmentHints: DepartmentHint[];
  flags: string[]; // e.g. "Mentions union labor", "Mentions rigging points"
}

export interface AiInterpreter {
  /** Scans a salesperson's free-text notes for department/complexity signals. Never authoritative — always shown as a suggestion the salesperson can accept or ignore. */
  interpretFreeText(text: string): Promise<InterpretedRequirements>;
  /** Turns an already-computed explanation object into a short, readable paragraph. */
  narrate(explanation: { headline: string; bullets: string[] }): Promise<string>;
}

const KEYWORD_RULES: { pattern: RegExp; department: Department; complexity: ComplexityLevel; reason: string }[] = [
  { pattern: /\bled wall\b|\bled screen\b/i, department: "LED", complexity: "MEDIUM", reason: 'Mentions "LED wall/screen"' },
  { pattern: /\bimag\b|\bmulti-?camera\b/i, department: "VIDEO", complexity: "MEDIUM", reason: "Mentions IMAG / multi-camera" },
  { pattern: /\brigging\b|\bfly\b|\bhang\b/i, department: "RIGGING", complexity: "SMALL", reason: 'Mentions rigging/flying elements' },
  { pattern: /\bscenic\b|\bstage set\b|\bbackdrop\b/i, department: "SCENIC", complexity: "SMALL", reason: "Mentions scenic/stage set elements" },
  { pattern: /\bwireless mic|\blavalier|\bhandheld mic/i, department: "AUDIO", complexity: "MEDIUM", reason: "Mentions wireless microphones" },
  { pattern: /\bcomms?\b|\bintercom\b|\bIFB\b/i, department: "COMMUNICATIONS", complexity: "SMALL", reason: "Mentions comms/intercom" },
];

const FLAG_RULES: { pattern: RegExp; flag: string }[] = [
  { pattern: /\bunion\b/i, flag: "Mentions union labor" },
  { pattern: /\bin-?house\b/i, flag: "Mentions in-house / venue restrictions" },
  { pattern: /\bsame[- ]day\b|\bquick[- ]turn/i, flag: "Mentions a same-day or quick-turn schedule" },
];

class HeuristicAiInterpreter implements AiInterpreter {
  async interpretFreeText(text: string): Promise<InterpretedRequirements> {
    if (!text || !text.trim()) return { departmentHints: [], flags: [] };

    const departmentHints: DepartmentHint[] = [];
    for (const rule of KEYWORD_RULES) {
      if (rule.pattern.test(text)) {
        departmentHints.push({ department: rule.department, suggestedComplexity: rule.complexity, reason: rule.reason });
      }
    }

    const flags: string[] = [];
    for (const rule of FLAG_RULES) {
      if (rule.pattern.test(text)) flags.push(rule.flag);
    }

    return { departmentHints, flags };
  }

  async narrate(explanation: { headline: string; bullets: string[] }): Promise<string> {
    if (explanation.bullets.length === 0) return explanation.headline;
    return `${explanation.headline} ${explanation.bullets.join(" ")}`;
  }
}

let cachedInterpreter: AiInterpreter | null = null;

/**
 * Single seam for swapping the stub for a real Claude-backed implementation
 * later (e.g. reading ANTHROPIC_API_KEY and returning a class that calls the
 * Messages API instead). Everything upstream depends only on the
 * `AiInterpreter` interface.
 */
export function getAiInterpreter(): AiInterpreter {
  if (!cachedInterpreter) cachedInterpreter = new HeuristicAiInterpreter();
  return cachedInterpreter;
}
