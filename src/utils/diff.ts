interface ChunkVersion {
  startLine: number;
  endLine: number;
  lines: Array<[boolean, string]>; // [modified, line]
}
export interface PatchChunk {
  before: ChunkVersion;
  after: ChunkVersion;
}

export interface ParsedPatch {
  filename: string;
  chunks: PatchChunk[];
}

export interface RegionOfInterest {
  startLine: number;
  endLine: number;
  addedLines?: Set<number>; // Line numbers that are additions
  removedLines?: Set<number>; // Line numbers that are removals
}

/**
 * Parses a chunk of a diff into a PatchChunk object
 */
function parseChunk(content: string, oldStartLine: number, newStartLine: number): PatchChunk {
  const lines = content.split('\n');

  let currentNewLine = newStartLine;
  let currentOldLine = oldStartLine;
  let newLineCount = 0;
  let oldLineCount = 0;

  const beforeLines: Array<[boolean, string]> = [];
  const afterLines: Array<[boolean, string]> = [];

  for (const line of lines) {
    if (line.startsWith('+') && !line.startsWith('+++')) {
      // This is an added line - only exists in after
      afterLines.push([true, line.substring(1)]);
      currentNewLine++;
      newLineCount++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      // This is a removed line - only exists in before
      beforeLines.push([true, line.substring(1)]);
      currentOldLine++;
      oldLineCount++;
    } else if (line.startsWith(' ') || (!line.startsWith('@') && !line.startsWith('\\') && line.length > 0)) {
      // This is a context line (unchanged) - exists in both
      const lineContent = line.startsWith(' ') ? line.substring(1) : line;
      beforeLines.push([false, lineContent]);
      afterLines.push([false, lineContent]);
      currentNewLine++;
      currentOldLine++;
      newLineCount++;
      oldLineCount++;
    }
    // Skip chunk headers (@@) and other metadata lines
  }

  return {
    before: {
      startLine: oldStartLine,
      endLine: oldStartLine + oldLineCount - 1,
      lines: beforeLines,
    },
    after: {
      startLine: newStartLine,
      endLine: newStartLine + newLineCount - 1,
      lines: afterLines,
    },
  };
}

function extractFilename(lines: string[]): string {
  for (const line of lines) {
    if (line.startsWith('+++ ')) {
      // Extract the filename from a line like "+++ b/src/index.test.ts"
      return line.substring(6);
    }
  }
  return '';
}

export function parsePatch(patch: string): ParsedPatch {
  const lines = patch.split('\n');
  const filename = extractFilename(lines);
  const chunks: PatchChunk[] = [];

  const chunkHeaderRegex = /^@@ -(\d+),\d+ \+(\d+),\d+ @@/;

  let currentChunk: PatchChunk | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(chunkHeaderRegex);

    if (match && match[1] && match[2]) {
      // If we've already been building a chunk, save it
      if (currentChunk) {
        const chunkContent = currentContent.join('\n');
        chunks.push(parseChunk(chunkContent, currentChunk.before.startLine, currentChunk.after.startLine));
        currentContent = [];
      }

      // Extract both old and new line numbers from the chunk header
      const oldLineNumber = parseInt(match[1], 10);
      const newLineNumber = parseInt(match[2], 10);
      currentChunk = {
        before: {
          startLine: oldLineNumber,
          endLine: 0,
          lines: [],
        },
        after: {
          startLine: newLineNumber,
          endLine: 0,
          lines: [],
        },
      };
      currentContent.push(line);
    } else if (currentChunk) {
      currentContent.push(line);
    }
  }

  // Add the last chunk if there is one
  if (currentChunk) {
    const chunkContent = currentContent.join('\n');
    chunks.push(parseChunk(chunkContent, currentChunk.before.startLine, currentChunk.after.startLine));
  }

  return {
    filename,
    chunks,
  };
}

function getIndentLevel(line: string): number | undefined {
  if (!line.trim()) return undefined;
  const match = line.match(/^(\s*)/);
  return match && match[1] ? match[1].length : 0;
}

/**
 * Makes a concise version of a file, showing only specified regions from a parsed patch
 * and maintaining indentation structure
 */
export function makeConciseFile(params: {
  parsedPatch: ParsedPatch;
  fileContent: string; // Current file content (after changes)
  show: 'additions' | 'removals'; // Whether to show addition or removal lines with +/- prefix
  beforeLines?: number; // Number of lines to show before each region (default: 0)
  afterLines?: number; // Number of lines to show after each region (default: 0)
}): string {
  const { parsedPatch, fileContent, show, beforeLines = 0, afterLines = 0 } = params;

  let targetFileContent: string;
  let regionsOfInterest: RegionOfInterest[] = [];
  let allMarkedLines = new Set<number>();

  if (show === 'additions') {
    // For additions, use the current file content and after state
    targetFileContent = fileContent;
    for (const chunk of parsedPatch.chunks) {
      regionsOfInterest.push({
        startLine: Math.max(1, chunk.after.startLine - beforeLines),
        endLine: chunk.after.endLine + afterLines,
        addedLines: getAddedLines(chunk),
        removedLines: getRemovedLines(chunk),
      });
      getAddedLines(chunk).forEach((lineNum) => allMarkedLines.add(lineNum));
    }
  } else {
    // For removals, reconstruct the original file content and use before state
    targetFileContent = reconstructOriginalFile(fileContent, parsedPatch);
    for (const chunk of parsedPatch.chunks) {
      regionsOfInterest.push({
        startLine: Math.max(1, chunk.before.startLine - beforeLines),
        endLine: chunk.before.endLine + afterLines,
        addedLines: getAddedLines(chunk),
        removedLines: getRemovedLines(chunk),
      });
      getRemovedLines(chunk).forEach((lineNum) => allMarkedLines.add(lineNum));
    }
  }

  // Implementation for real usage
  const lines = targetFileContent.split('\n');

  // Clamp end lines to file length
  regionsOfInterest = regionsOfInterest.map((region) => ({
    ...region,
    endLine: Math.min(region.endLine, lines.length),
  }));

  // Sort regions by start line
  const sortedRegions = [...regionsOfInterest].sort((a, b) => a.startLine - b.startLine);
  const regionWithLineIndices = sortedRegions.map((r) => ({
    startLineIndex: r.startLine - 1,
    endLineIndex: r.endLine - 1,
  }));

  const lineIndicesOfInterest = new Set<number>();

  for (const region of regionWithLineIndices) {
    let maxIndent = 0;
    for (let lineNumber = region.startLineIndex; lineNumber <= region.endLineIndex; lineNumber++) {
      const line = lines[lineNumber];
      if (line === undefined) continue;
      maxIndent = Math.max(maxIndent, getIndentLevel(line) ?? 0);
      lineIndicesOfInterest.add(lineNumber);
    }

    let scanUpwardIndent = maxIndent;
    let scanDownwardIndent = maxIndent;

    for (let line = region.startLineIndex - 1; line >= 0; line--) {
      const lineContent = lines[line];
      if (lineContent === undefined) continue;
      const thisIndent = getIndentLevel(lineContent);
      if (thisIndent && thisIndent < scanUpwardIndent) {
        scanUpwardIndent = thisIndent;
        lineIndicesOfInterest.add(line);
      }
    }

    for (let line = region.endLineIndex + 1; line < lines.length; line++) {
      const lineContent = lines[line];
      if (lineContent === undefined) continue;
      const thisIndent = getIndentLevel(lineContent);
      if (thisIndent && thisIndent < scanDownwardIndent) {
        scanDownwardIndent = thisIndent;
        lineIndicesOfInterest.add(line);
      }
    }
  }

  let lastAction: 'skip' | 'print' = 'print';
  const output: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lineIndicesOfInterest.has(i)) {
      const line = lines[i];
      if (line === undefined) continue;
      lastAction = 'print';

      // Check if this line should be marked with prefix
      const isMarkedLine = allMarkedLines.has(i + 1); // Convert to 1-based line number
      if (isMarkedLine) {
        const prefix = show === 'additions' ? '+' : '-';
        output.push(`${prefix}${line}`);
      } else {
        output.push(` ${line}`); // Add space prefix for unchanged lines
      }
    } else {
      if (lastAction === 'skip') continue;
      lastAction = 'skip';
      output.push(' // ...'); // Add space prefix for skip lines too
    }
  }

  return output.join('\n');
}

/**
 * Reconstructs the original file content before changes were applied
 */
function reconstructOriginalFile(currentContent: string, parsedPatch: ParsedPatch): string {
  const currentLines = currentContent.split('\n');
  let resultLines = [...currentLines];

  // Process chunks in reverse order (from end to beginning) to maintain line numbers
  const sortedChunks = [...parsedPatch.chunks].sort((a, b) => b.after.startLine - a.after.startLine);

  for (const chunk of sortedChunks) {
    // Extract the before and after content
    const beforeContent = chunk.before.lines.map(([_, content]) => content);
    const afterContent = chunk.after.lines.map(([_, content]) => content);

    // Find where the after content starts in the current file
    const afterStart = chunk.after.startLine - 1; // Convert to 0-based

    // Replace the after content with the before content
    resultLines.splice(afterStart, afterContent.length, ...beforeContent);
  }

  return resultLines.join('\n');
}

/**
 * Helper function to extract added line numbers from a PatchChunk
 */
export function getAddedLines(chunk: PatchChunk): Set<number> {
  const addedLines = new Set<number>();
  let currentLine = chunk.after.startLine;

  for (const [isModified, line] of chunk.after.lines) {
    if (isModified) {
      addedLines.add(currentLine);
    }
    currentLine++;
  }

  return addedLines;
}

/**
 * Helper function to extract removed line numbers from a PatchChunk
 */
export function getRemovedLines(chunk: PatchChunk): Set<number> {
  const removedLines = new Set<number>();
  let currentLine = chunk.before.startLine;

  for (const [isModified, line] of chunk.before.lines) {
    if (isModified) {
      removedLines.add(currentLine);
    }
    currentLine++;
  }

  return removedLines;
}
