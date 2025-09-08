// src/utils/domCompare.ts

// Public API kept stable for CodeRunner integration
// - structuralEqual(expected, actual) -> { equal, diffs }
// - visualSimilarity(expected, actual) -> number in [0,1]
// - calculateAssessmentScore(structuralResult, visualSimilarity) -> 0..100

type DiffSeverity = 'low' | 'medium' | 'high';

interface DiffEntry {
  type: string;
  severity: DiffSeverity;
  expected?: any;
  actual?: any;
  attribute?: string;
  index?: number;
  childDiffs?: DiffEntry[];
  similarity?: number;
}

interface StructuralResult {
  equal: boolean;
  diffs: DiffEntry[];
}

// ------------ Tunable Weights ------------
const STRUCTURE_WEIGHT = 70;   // percent
const VISUAL_WEIGHT = 30;      // percent
const STRUCTURE_TOLERANCE_CHILD_DIFF = 1; // allow +/-1 child
const TEXT_SIM_THRESHOLD_STRICT = 0.8; // < 0.8 counts as diff
const TEXT_SIM_THRESHOLD_LENIENT = 0.5; // decide severity
// ----------------------------------------

export function structuralEqual(expected: Element, actual: Element): StructuralResult {
  const diffs: DiffEntry[] = [];

  // Guard: if nodes are not Element (e.g., Text), return lenient result
  if (!isElementNode(expected) || !isElementNode(actual)) {
    return { equal: true, diffs: [] };
  }

  // Quick path: native compare
  try {
    if ((expected as any).isEqualNode && (expected as any).isEqualNode(actual)) {
      return { equal: true, diffs: [] };
    }
  } catch (err) {
    // ignore and continue
  }

  // Compare tag names
  const expectedTag = (expected.tagName || '').toLowerCase();
  const actualTag = (actual.tagName || '').toLowerCase();
  if (expectedTag !== actualTag) {
    diffs.push({
      type: 'tagName',
      expected: expectedTag,
      actual: actualTag,
      severity: 'high'
    });
  }

  // Compare text content (normalized and trimmed)
  const expectedText = normalizeText(expected.textContent || '');
  const actualText = normalizeText(actual.textContent || '');

  if (expectedText && actualText && expectedText !== actualText) {
    const textSimilarity = calculateTextSimilarity(expectedText, actualText);
    if (textSimilarity < TEXT_SIM_THRESHOLD_STRICT) {
      diffs.push({
        type: 'textContent',
        expected: expectedText,
        actual: actualText,
        similarity: textSimilarity,
        severity: textSimilarity < TEXT_SIM_THRESHOLD_LENIENT ? 'high' : 'low'
      });
    }
  }

  // Compare a set of key attributes
  const importantAttrs = ['id', 'class', 'type', 'href', 'src', 'role', 'aria-label'];
  importantAttrs.forEach(attr => {
    const expectedVal = expected.getAttribute(attr);
    const actualVal = actual.getAttribute(attr);
    if (expectedVal !== actualVal && (expectedVal || actualVal)) {
      diffs.push({
        type: 'attribute',
        attribute: attr,
        expected: expectedVal,
        actual: actualVal,
        severity: attr === 'id' ? 'high' : 'medium'
      });
    }
  });

  // Compare children count with tolerance
  const expectedChildren = getElementChildren(expected);
  const actualChildren = getElementChildren(actual);

  if (Math.abs(expectedChildren.length - actualChildren.length) > STRUCTURE_TOLERANCE_CHILD_DIFF) {
    diffs.push({
      type: 'childrenCount',
      expected: expectedChildren.length,
      actual: actualChildren.length,
      severity: 'medium'
    });
  }

  // Recursively compare child pairs up to min length
  const minChildren = Math.min(expectedChildren.length, actualChildren.length);
  for (let i = 0; i < minChildren; i++) {
    const childRes = structuralEqual(expectedChildren[i], actualChildren[i]);
    if (!childRes.equal) {
      diffs.push({
        type: 'childStructure',
        index: i,
        childDiffs: childRes.diffs,
        severity: 'medium'
      });
    }
  }

  // Decide equality: no high severity diffs and small number of total diffs
  const highSeverityDiffs = diffs.filter(d => d.severity === 'high');
  const isEqual = highSeverityDiffs.length === 0 && diffs.length <= 2;

  return { equal: isEqual, diffs };
}

export function visualSimilarity(expected: HTMLElement, actual: HTMLElement): number {
  // Guard if input is not HTMLElement (e.g., SVGElement still ok as it extends Element, but we use getComputedStyle)
  if (!isElementNode(expected) || !isElementNode(actual)) return 1;

  let score = 0;
  let totalChecks = 0;

  try {
    const expectedStyle = window.getComputedStyle(expected);
    const actualStyle = window.getComputedStyle(actual);

    // Layout properties (double weight)
    const layoutProps = ['display', 'position', 'width', 'height', 'margin', 'padding'];
    layoutProps.forEach(prop => {
      totalChecks += 2;
      const eVal = expectedStyle.getPropertyValue(prop);
      const aVal = actualStyle.getPropertyValue(prop);
      if (isStyleValueEqual(eVal, aVal, prop)) {
        score += 2;
      } else if (isStyleValueSimilar(eVal, aVal, prop)) {
        score += 1;
      }
    });

    // Visual properties (normal weight)
    const visualProps = ['color', 'backgroundColor', 'fontSize', 'fontWeight', 'textAlign', 'borderRadius'];
    visualProps.forEach(prop => {
      totalChecks++;
      const eVal = expectedStyle.getPropertyValue(prop);
      const aVal = actualStyle.getPropertyValue(prop);
      if (isStyleValueEqual(eVal, aVal, prop)) {
        score += 1;
      } else if (isStyleValueSimilar(eVal, aVal, prop)) {
        score += 0.5;
      }
    });

    // Text content similarity
    totalChecks++;
    const expectedText = normalizeText(expected.textContent || '');
    const actualText = normalizeText(actual.textContent || '');
    if (expectedText === actualText) {
      score += 1;
    } else {
      const textSim = calculateTextSimilarity(expectedText, actualText); // 0..1
      score += clamp01(textSim);
    }

    // Tag/hierarchy simple check
    totalChecks++;
    if ((expected.tagName || '') === (actual.tagName || '')) {
      score += 1;
    }

    // Children count tolerance
    totalChecks++;
    const eChildren = expected.children.length;
    const aChildren = actual.children.length;
    if (eChildren === aChildren) {
      score += 1;
    } else if (Math.abs(eChildren - aChildren) <= STRUCTURE_TOLERANCE_CHILD_DIFF) {
      score += 0.7;
    }

    // Interactive elements presence/text
    const expectedInteractive = expected.querySelectorAll('button, input, a');
    const actualInteractive = actual.querySelectorAll('button, input, a');
    if (expectedInteractive.length > 0 || actualInteractive.length > 0) {
      totalChecks++;
      if (expectedInteractive.length === actualInteractive.length) {
        score += 1;

        const len = Math.min(expectedInteractive.length, actualInteractive.length);
        for (let i = 0; i < len; i++) {
          totalChecks++;
          const eBtnText = normalizeText(expectedInteractive[i].textContent || '');
          const aBtnText = normalizeText(actualInteractive[i].textContent || '');
          if (eBtnText === aBtnText) {
            score += 1;
          } else if (calculateTextSimilarity(eBtnText, aBtnText) > 0.7) {
            score += 0.8;
          }
        }
      }
    }
  } catch (error) {
    // If computed style fails (e.g., not in document), give a neutral-high score so structure drives grading
    return 0.8;
  }

  return totalChecks > 0 ? clamp01(score / totalChecks) : 0;
}

export function calculateAssessmentScore(
  structuralResult: StructuralResult,
  visualSim: number
): number {
  // structure 70%, visual 30%, plus small bonus for near-perfect
  let score = 0;

  if (structuralResult.equal) {
    score += STRUCTURE_WEIGHT;
  } else {
    // Severity-based penalty model
    const high = structuralResult.diffs.filter(d => d.severity === 'high').length;
    const med = structuralResult.diffs.filter(d => d.severity === 'medium').length;
    const low = structuralResult.diffs.filter(d => d.severity === 'low').length;

    // Max structure points minus penalties
    const penalties = (high * 20) + (med * 10) + (low * 5);
    score += Math.max(0, STRUCTURE_WEIGHT - penalties);
  }

  // Visual similarity
  score += clamp01(visualSim) * VISUAL_WEIGHT;

  // Small bonus for perfect or near-perfect
  if (structuralResult.equal && visualSim > 0.9) {
    score = Math.min(100, score + 5);
  }

  return Math.round(clamp(score, 0, 100));
}

// -------------------- Helpers --------------------

function isElementNode(node: any): node is HTMLElement {
  return node && typeof node === 'object' && node.nodeType === 1;
}

function normalizeText(text: string): string {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function calculateTextSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  // Handle numeric patterns (e.g., counters)
  const numsA = extractNumbers(a);
  const numsB = extractNumbers(b);
  if (numsA.length > 0 && numsB.length > 0) {
    const structA = a.replace(/\d+/g, 'NUM');
    const structB = b.replace(/\d+/g, 'NUM');
    if (structA === structB) return 0.9;
  }

  // Levenshtein-based similarity
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;

  const dist = levenshteinDistance(longer, shorter);
  return clamp01((longer.length - dist) / longer.length);
}

function extractNumbers(text: string): number[] {
  const matches = text.match(/\d+/g);
  return matches ? matches.map(Number) : [];
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));

  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (str2.charCodeAt(i - 1) === str1.charCodeAt(j - 1)) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1, // replace
          dp[i][j - 1] + 1,     // insert
          dp[i - 1][j] + 1      // delete
        );
      }
    }
  }
  return dp[n][m];
}

function getElementChildren(el: Element): Element[] {
  // Filter only Element nodes to ignore text nodes/whitespace
  const out: Element[] = [];
  el.childNodes.forEach(n => {
    if (n.nodeType === 1) out.push(n as Element);
  });
  return out;
}

function isStyleValueEqual(v1: string, v2: string, prop: string): boolean {
  if (v1 === v2) return true;

  if (prop.toLowerCase().includes('color')) {
    return normalizeColor(v1) === normalizeColor(v2);
  }

  if (['width', 'height', 'fontsize', 'margin', 'padding'].includes(prop.toLowerCase())) {
    return normalizeSizeValue(v1) === normalizeSizeValue(v2);
  }

  return false;
}

function isStyleValueSimilar(v1: string, v2: string, prop: string): boolean {
  if (prop.toLowerCase().includes('color')) {
    return isColorSimilar(v1, v2);
  }

  const p = prop.toLowerCase();
  if (p === 'fontsize' || p === 'width' || p === 'height') {
    return isSizeSimilar(v1, v2);
  }

  return false;
}

function normalizeColor(color: string): string {
  const c = (color || '').toLowerCase().trim();
  if (c.startsWith('rgb')) {
    const m = c.match(/\d+(\.\d+)?/g);
    if (m && m.length >= 3) {
      const r = toHex(parseFloat(m[0]));
      const g = toHex(parseFloat(m[1]));
      const b = toHex(parseFloat(m[2]));
      return `#${r}${g}${b}`;
    }
  }
  return c;
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

function normalizeSizeValue(value: string): string {
  const v = (value || '').trim().toLowerCase();
  if (!v) return v;
  if (v.endsWith('em') || v.endsWith('rem')) {
    const num = parseFloat(v);
    return `${num * 16}px`; // approximate conversion
  }
  return v;
}

function isColorSimilar(c1: string, c2: string): boolean {
  const n1 = normalizeColor(c1);
  const n2 = normalizeColor(c2);
  if (!n1 || !n2) return false;

  // Treat transparent equivalently if both transparent-ish
  if ((n1.includes('transparent') || n1.includes('rgba(0, 0, 0, 0)')) &&
      (n2.includes('transparent') || n2.includes('rgba(0, 0, 0, 0)'))) {
    return true;
  }
  return n1 === n2;
}

function isSizeSimilar(s1: string, s2: string): boolean {
  const v1 = parseFloat(s1);
  const v2 = parseFloat(s2);
  if (isNaN(v1) || isNaN(v2)) return false;

  // within 20% tolerance
  const diff = Math.abs(v1 - v2);
  const avg = (v1 + v2) / 2 || 1;
  return diff / avg < 0.2;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function clamp(x: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, x));
}
