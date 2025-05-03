export interface PatchChunk {
  startLine: number;
  endLine: number;
  content: string;
}

export interface ParsedPatch {
  filename: string;
  chunks: PatchChunk[];
}

export interface RegionOfInterest {
  startLine: number;
  endLine: number;
}

export interface ConciseFileParams {
  filename: string;
  regionsOfInterest: RegionOfInterest[];
  fileContent: string; // Optional file content to use instead of reading from disk
}

/**
 * Parses a chunk of a diff into a DiffChunk object
 */
function parseChunk(content: string, startLine: number): PatchChunk {
  const lines = content.split('\n');
  let lineCount = 0;

  for (const line of lines) {
    // Only count lines that will be in the final file (added lines or context lines)
    if (line.startsWith('+') || (line.startsWith(' ') && !line.startsWith('+++'))) {
      lineCount++;
    }
  }

  return {
    startLine,
    endLine: startLine + lineCount,
    content,
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

  const chunkHeaderRegex = /^@@ -\d+,\d+ \+(\d+),\d+ @@/;

  let currentChunk: PatchChunk | null = null;
  let currentContent: string[] = [];

  for (const line of lines) {
    const match = line.match(chunkHeaderRegex);

    if (match && match[1]) {
      // If we've already been building a chunk, save it
      if (currentChunk) {
        const chunkContent = currentContent.join('\n');
        chunks.push(parseChunk(chunkContent, currentChunk.startLine));
        currentContent = [];
      }

      // The line number comes from the new file (+) part of the diff
      const lineNumber = parseInt(match[1], 10);
      currentChunk = {
        startLine: lineNumber,
        endLine: 0,
        content: '',
      };
      currentContent.push(line);
    } else if (currentChunk) {
      currentContent.push(line);
    }
  }

  // Add the last chunk if there is one
  if (currentChunk) {
    const chunkContent = currentContent.join('\n');
    chunks.push(parseChunk(chunkContent, currentChunk.startLine));
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
 * Makes a concise version of a file, showing only specified regions of interest
 * and maintaining indentation structure
 */
export function makeConciseFile(params: ConciseFileParams): string {
  const { filename, regionsOfInterest, fileContent } = params;

  // Implementation for real usage
  const lines = fileContent.split('\n');

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
      output.push(line);
    } else {
      if (lastAction === 'skip') continue;
      lastAction = 'skip';
      output.push('// ...');
    }
  }

  return output.join('\n');
}
