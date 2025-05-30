type ChangeType = 'add' | 'remove' | 'context';
// One line of the raw diff within a chunk
interface DiffLine {
  beforeLine: number;
  afterLine: number;
  type: ChangeType;
  content: string; // the line text without diff marker
}

const diffSymbol: Record<ChangeType, string> = {
  add: '+',
  remove: '-',
  context: ' ',
};

export interface PatchChunk {
  diffLines: DiffLine[]; // preserves ordering so we can re‑insert removals accurately
}

export interface ParsedPatch {
  filename: string;
  chunks: PatchChunk[];
}

/**
 * Parses a chunk of a unified diff into a PatchChunk.
 * Keeps track of the individual diff lines so we can later
 * reconstruct exact positions for removed lines when rendering
 * a "both" view.
 */
function parseChunk(content: string, oldStartLine: number, newStartLine: number): PatchChunk {
  const raw = content.split('\n');

  let currentOldLine = oldStartLine;
  let currentNewLine = newStartLine;
  const diffLines: DiffLine[] = [];

  for (const line of raw) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      // Added line - exists in after file, inserted at current before position
      const text = line.substring(1);
      diffLines.push({
        type: 'add',
        content: text,
        beforeLine: currentOldLine, // where it was inserted relative to before file
        afterLine: currentNewLine, // actual position in after file
      });
      currentNewLine++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      // Removed line - existed in before file, would have been at current after position
      const text = line.substring(1);
      diffLines.push({
        type: 'remove',
        content: text,
        beforeLine: currentOldLine, // actual position in before file
        afterLine: currentNewLine, // where it would have been in after file
      });
      currentOldLine++;
    } else if (line.startsWith(' ') || (!line.startsWith('@@') && !line.startsWith('\\') && line.length > 0)) {
      // Context / unchanged - exists in both files
      const text = line.startsWith(' ') ? line.substring(1) : line;
      diffLines.push({
        type: 'context',
        content: text,
        beforeLine: currentOldLine,
        afterLine: currentNewLine,
      });
      currentNewLine++;
      currentOldLine++;
    }
    // ignore headers and metadata
  }

  return {
    diffLines,
  };
}

function extractFilename(lines: string[]): string {
  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      return line.substring(6);
    }
  }
  return '';
}

export function parsePatch(patch: string): ParsedPatch {
  const all = patch.split('\n');
  const filename = extractFilename(all);
  const chunks: PatchChunk[] = [];

  const headerRe = /^@@ -(\d+),\d+ \+(\d+),\d+ @@/;

  let currentBuf: string[] = [];
  let currentOldStart = 0;
  let currentNewStart = 0;

  for (const line of all) {
    const m = line.match(headerRe);
    if (m && m[1] && m[2]) {
      // flush previous
      if (currentBuf.length > 0) {
        chunks.push(parseChunk(currentBuf.join('\n'), currentOldStart, currentNewStart));
        currentBuf = [];
      }
      currentOldStart = parseInt(m[1], 10);
      currentNewStart = parseInt(m[2], 10);
      currentBuf.push(line);
    } else if (currentOldStart > 0) {
      currentBuf.push(line);
    }
  }
  if (currentBuf.length > 0) {
    chunks.push(parseChunk(currentBuf.join('\n'), currentOldStart, currentNewStart));
  }

  return { filename, chunks };
}

function getIndentLevel(line: string): number | undefined {
  if (!line.trim()) return undefined;
  const match = line.match(/^(\s*)/);
  return match && match[1] ? match[1].length : 0;
}

/**
 * Get the start and end line numbers for the after (new) file version of a chunk
 */
export function getAfterLineRange(chunk: PatchChunk): { startLine: number; endLine: number } {
  if (chunk.diffLines.length === 0) return { startLine: 0, endLine: 0 };

  const afterLines = chunk.diffLines
    .filter((line) => line.type === 'add' || line.type === 'context')
    .map((line) => line.afterLine);

  if (afterLines.length === 0) return { startLine: 0, endLine: 0 };

  return {
    startLine: Math.min(...afterLines),
    endLine: Math.max(...afterLines),
  };
}

/**
 * Get the start and end line numbers for the before (old) file version of a chunk
 */
export function getBeforeLineRange(chunk: PatchChunk): { startLine: number; endLine: number } {
  if (chunk.diffLines.length === 0) return { startLine: 0, endLine: 0 };

  const beforeLines = chunk.diffLines
    .filter((line) => line.type === 'remove' || line.type === 'context')
    .map((line) => line.beforeLine);

  if (beforeLines.length === 0) return { startLine: 0, endLine: 0 };

  return {
    startLine: Math.min(...beforeLines),
    endLine: Math.max(...beforeLines),
  };
}

/**
 * Step 1: Identify indices of interest from the diff patches (0-based)
 */
function identifyDiffLinesOfInterest(parsedPatch: ParsedPatch): Set<number> {
  const indicesOfInterest = new Set<number>();

  for (const chunk of parsedPatch.chunks) {
    for (const diffLine of chunk.diffLines) {
      indicesOfInterest.add(diffLine.afterLine - 1); // Convert to 0-based index
    }
  }

  return indicesOfInterest;
}

/**
 * Step 2: Expand indices based on beforeLines/afterLines configuration (0-based)
 */
function expandRegionsForContext(
  indicesOfInterest: Set<number>,
  beforeLines: number,
  afterLines: number,
  maxLineNumber: number,
): Set<number> {
  const expandedIndices = new Set<number>();

  for (const idx of indicesOfInterest) {
    // Add the original index and expand around it
    for (let i = idx - beforeLines; i <= idx + afterLines; i++) {
      if (i >= 0 && i < maxLineNumber) {
        // 0-based bounds checking
        expandedIndices.add(i);
      }
    }
  }

  return expandedIndices;
}

/**
 * Step 3: Expand lines of interest based on indentation rules (parent scopes)
 */
function expandRegionsForIndentation(indicesOfInterest: Set<number>, fileContentLines: string[]): Set<number> {
  const expandedIndices = new Set<number>();

  // Find contiguous regions from the indices
  const indexRegions = getContigousRanges(indicesOfInterest);

  for (const r of indexRegions) {
    let maxIndent = 0;
    // Add all indices in the region and find max indentation
    for (let i = r.start; i <= r.end; i++) {
      maxIndent = Math.max(maxIndent, getIndentLevel(fileContentLines[i]!) ?? 0);
      expandedIndices.add(i);
    }

    // Look backwards for parent scopes
    let upIndent = maxIndent;
    for (let i = r.start - 1; i >= 0 && upIndent > 0; i--) {
      const ind = getIndentLevel(fileContentLines[i]!);
      if (ind !== undefined && ind < upIndent) {
        upIndent = ind;
        expandedIndices.add(i);
      }
    }

    // Look forwards for parent scopes
    let downIndent = maxIndent;
    for (let i = r.end + 1; i < fileContentLines.length && downIndent > 0; i++) {
      const ind = getIndentLevel(fileContentLines[i]!);
      if (ind !== undefined && ind < downIndent) {
        downIndent = ind;
        expandedIndices.add(i);
      }
    }
  }

  return expandedIndices;
}

export function getContigousRanges(values: Set<number>): Array<{ start: number; end: number }> {
  if (values.size === 0) return [];

  const sortedValues = Array.from(values).sort((a, b) => a - b);

  const ranges: Array<{ start: number; end: number }> = [];
  let currentRange: { start: number; end: number } | undefined;

  for (const value of sortedValues) {
    if (currentRange === undefined || value !== currentRange.end + 1) {
      if (currentRange !== undefined) {
        ranges.push(currentRange);
      }
      currentRange = { start: value, end: value };
    } else {
      currentRange.end = value;
    }
  }

  if (currentRange !== undefined) {
    ranges.push(currentRange);
  }

  return ranges;
}

/**
 * Step 4: Render the final file with diff markers
 */
function renderFileWithDiff(
  fileContentLines: string[],
  indicesOfInterest: Set<number>,
  parsedPatch: ParsedPatch,
): string {
  const out: string[] = [];
  let last: 'print' | 'skip' = 'print';

  const diffLinesByLine: Map<number, DiffLine[]> = new Map();
  for (const chunk of parsedPatch.chunks) {
    for (const diffLine of chunk.diffLines) {
      const lines = diffLinesByLine.get(diffLine.afterLine) || [];
      lines.push(diffLine);
      diffLinesByLine.set(diffLine.afterLine, lines);
    }
  }

  const contiguousIndicesOfInterest = getContigousRanges(indicesOfInterest);
  if (contiguousIndicesOfInterest[0]?.start /* greater than 0? */) {
    out.push(' // ...');
  }

  for (const { start, end } of contiguousIndicesOfInterest) {
    for (let idx = start; idx <= end; idx++) {
      const lineNum = idx + 1; // Convert to 1-based
      const diffLines = diffLinesByLine.get(lineNum) || [];
      if (diffLines.length === 0) {
        out.push(` ${fileContentLines[idx]}`);
      } else {
        for (const diffLine of diffLines) {
          out.push(`${diffSymbol[diffLine.type]}${diffLine.content}`);
        }
      }
    }
    if (end < fileContentLines.length - 1) {
      out.push(' // ...');
    }
  }

  return out.join('\n');
}

/**
 * Makes a concise version of a file, showing both additions and removals in one unified view.
 */
export function makeConciseFile(params: {
  parsedPatch: ParsedPatch;
  fileContent: string; // Current file content (after changes)
  beforeLines?: number;
  afterLines?: number;
}): string {
  const { parsedPatch, fileContent, beforeLines = 0, afterLines = 0 } = params;
  const lines = fileContent.split('\n');

  // Step 1: Identify indices of interest from the diff
  const originalIndicesOfInterest = identifyDiffLinesOfInterest(parsedPatch);

  // Step 2: Expand indices based on before/after configuration
  const expandedBeforeAfterIndicesOfInterest = expandRegionsForContext(
    originalIndicesOfInterest,
    beforeLines,
    afterLines,
    lines.length,
  );

  // Step 3: Expand lines based on indentation rules
  const indicesOfInterest = expandRegionsForIndentation(expandedBeforeAfterIndicesOfInterest, lines);

  // Step 4: Render the final file with diff markers
  return renderFileWithDiff(lines, indicesOfInterest, parsedPatch);
}

/** Added line numbers in after‑file space */
export function getAddedLines(chunk: PatchChunk): Set<number> {
  const s = new Set<number>();
  for (const line of chunk.diffLines) {
    if (line.type === 'add') {
      s.add(line.afterLine);
    }
  }
  return s;
}

/** Removed line numbers in before‑file space */
export function getRemovedLines(chunk: PatchChunk): Set<number> {
  const s = new Set<number>();
  for (const line of chunk.diffLines) {
    if (line.type === 'remove') {
      s.add(line.beforeLine);
    }
  }
  return s;
}
