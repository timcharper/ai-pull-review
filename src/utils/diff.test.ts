import {
  makeConciseFile,
  parsePatch,
  getAddedLines,
  getRemovedLines,
  getAfterLineRange,
  getBeforeLineRange,
  getContigousRanges,
} from './diff';

const exampleDiff = `
diff --git a/src/index.test.ts b/src/index.test.ts
index c4acf56..cf4ddbf 100644
--- a/src/index.test.ts
+++ b/src/index.test.ts
@@ -9,6 +9,7 @@ describe('glob utilities', () => {
     });
 
     it('should remove prefix from path', () => {
+      expect(true).toBe(false);
       expect(stripPrefix('src', 'src/path.js')).toBe('/path.js');
       expect(stripPrefix('src', './src/path.js')).toBe('/path.js');
       expect(stripPrefix('src', '/path.js')).toBe(undefined);
@@ -52,8 +53,9 @@ describe('glob utilities', () => {
       expect('/test.js').not.toMatch(re);
       expect('/test.jsx').not.toMatch(re);
     });
-    // TODO: add more test cases
 
     it('should handle directory patterns', () => {
+      expect(true).toBe(false);
       const re = globToRegex('src/*.js');
       expect('/src/test.js').toMatch(re);
       expect('/test.js').not.toMatch(re);
`;

const sourceFile = `
import { globToRegex, stripPrefix } from './glob';

describe('glob utilities', () => {
  describe('stripPrefix', () => {
    it('handles trailing slashes', () => {
      expect(stripPrefix('src/', 'src/path.js')).toBe('/path.js');
      expect(stripPrefix('src/', './src/path.js')).toBe('/path.js');
      expect(stripPrefix('src/', '/src/path.js')).toBe('/path.js');
    });

    it('should remove prefix from path', () => {
      expect(true).toBe(false);
      expect(stripPrefix('src', 'src/path.js')).toBe('/path.js');
      expect(stripPrefix('src', './src/path.js')).toBe('/path.js');
      expect(stripPrefix('src', '/path.js')).toBe(undefined);
    });

    it('should handle empty prefix', () => {
      expect(stripPrefix('', 'src/path.js')).toBe('/src/path.js');
      expect(stripPrefix('', './src/path.js')).toBe('/src/path.js');
      expect(stripPrefix('', '/src/path.js')).toBe('/src/path.js');
    });

    it('should handle exact matches', () => {
      expect(stripPrefix('src', 'src')).toBe('/');
      expect(stripPrefix('src', './src')).toBe('/');
      expect(stripPrefix('src', '/src')).toBe('/');
    });

    it("returns undefined if the path doesn't begin with the prefix specified", () => {
      expect(stripPrefix('src', 'other/path.js')).toBe(undefined);
    });
  });

  describe('globToRegex', () => {
    it('should convert glob patterns to regex', () => {
      expect(globToRegex('*.js').test('/test.js')).toBe(true);
      expect(globToRegex('*.js').test('/test.txt')).toBe(false);
      expect(globToRegex('**/*.js').test('/src/test.js')).toBe(true);
      expect(globToRegex('**/src/*.js').test('/src/test.js')).toBe(true);
      expect(globToRegex('**/*.js').test('/test.js')).toBe(true);
      expect(globToRegex('**/*.js').test('/src/subdir/test.js')).toBe(true);
    });

    it('matches everything on empty path', () => {
      expect(globToRegex('').test('/src/subdir/test.js')).toBe(true);
      expect(globToRegex('**').test('/src/subdir/test.js')).toBe(true);
    });

    it('should convert simple glob patterns', () => {
      const re = globToRegex('*.js');
      expect('/test.js').toMatch(re);
      expect('/test.ts').not.toMatch(re);
      expect('/test.jsx').not.toMatch(re);
    });

    it('should handle directory patterns', () => {
      expect(true).toBe(false);
      const re = globToRegex('src/*.js');
      expect('/src/test.js').toMatch(re);
      expect('/test.js').not.toMatch(re);
      expect('/src/subdir/test.js').not.toMatch(re);
    });

    it('should handle double star patterns', () => {
      const re = globToRegex('src/**/*.js');
      expect('/src/test.js').toMatch(re);
      expect('/src/subdir/test.js').toMatch(re);
      expect('/test.js').not.toMatch(re);
    });

    it('should handle dot files', () => {
      const re = globToRegex('.env*');
      expect('/.env').toMatch(re);
      expect('/.env.local').toMatch(re);
      expect('/env').not.toMatch(re);
    });

    it('should handle multiple extensions', () => {
      const re = globToRegex('*.{js,ts}');
      expect('/test.js').toMatch(re);
      expect('/test.ts').toMatch(re);
      expect('/test.jsx').not.toMatch(re);
    });

    it('matches only root paths when specified', () => {
      const re = globToRegex('/path/to/*.js');
      expect('/path/to/test.js').toMatch(re);
      expect('/other/path/to/test.js').not.toMatch(re);
      expect('/path/to/subdir/test.js').not.toMatch(re);
    });
  });
});
`;

const sourceFileLines = sourceFile.split('\n');

const exampleDiffAdded = `
diff --git a/.cursor/rules/enrichment-service-api.mdc b/.cursor/rules/enrichment-service-api.mdc
new file mode 100644
index 00000000000..69fc215ab9f
--- /dev/null
+++ b/src/index.test.ts
@@ -0,0 +1,${sourceFileLines.length} @@
${sourceFileLines.map((line) => `+${line}`).join('\n')}
`;

describe('diff', () => {
  describe('getContigousRanges', () => {
    it('should return empty array for empty input', () => {
      expect(getContigousRanges(new Set([]))).toEqual([]);
    });

    it('should return single range for single value', () => {
      expect(getContigousRanges(new Set([5]))).toEqual([{ start: 5, end: 5 }]);
    });

    it('should return single range for contiguous values', () => {
      expect(getContigousRanges(new Set([1, 2, 3, 4, 5]))).toEqual([{ start: 1, end: 5 }]);
    });

    it('should return multiple ranges for non-contiguous values', () => {
      expect(getContigousRanges(new Set([1, 3, 5, 7]))).toEqual([
        { start: 1, end: 1 },
        { start: 3, end: 3 },
        { start: 5, end: 5 },
        { start: 7, end: 7 },
      ]);
    });

    it('should handle mixed contiguous and non-contiguous values', () => {
      expect(getContigousRanges(new Set([1, 2, 3, 5, 6, 8, 10, 11, 12]))).toEqual([
        { start: 1, end: 3 },
        { start: 5, end: 6 },
        { start: 8, end: 8 },
        { start: 10, end: 12 },
      ]);
    });

    it('should handle ranges with gaps of 1', () => {
      expect(getContigousRanges(new Set([1, 3, 4, 6, 7, 8, 10]))).toEqual([
        { start: 1, end: 1 },
        { start: 3, end: 4 },
        { start: 6, end: 8 },
        { start: 10, end: 10 },
      ]);
    });

    it('should handle large numbers', () => {
      expect(getContigousRanges(new Set([100, 101, 102, 200, 201]))).toEqual([
        { start: 100, end: 102 },
        { start: 200, end: 201 },
      ]);
    });

    it('should handle starting with large numbers', () => {
      expect(getContigousRanges(new Set([50, 51, 52]))).toEqual([{ start: 50, end: 52 }]);
    });
  });

  describe('parseDiff', () => {
    it('should parse the diff', () => {
      const diff = parsePatch(exampleDiff);
      expect(diff.chunks.length).toBe(2);

      // First chunk
      const firstChunkAfterRange = getAfterLineRange(diff.chunks[0]);
      const firstChunkBeforeRange = getBeforeLineRange(diff.chunks[0]);
      expect(firstChunkBeforeRange.startLine).toBe(9);
      expect(firstChunkAfterRange.startLine).toBe(9);
      expect(getAddedLines(diff.chunks[0])).toContain(12); // Added line: expect(true).toBe(false);

      // Second chunk
      const secondChunkAfterRange = getAfterLineRange(diff.chunks[1]);
      const secondChunkBeforeRange = getBeforeLineRange(diff.chunks[1]);
      expect(secondChunkBeforeRange.startLine).toBe(52);
      expect(secondChunkAfterRange.startLine).toBe(53);
      expect(getAddedLines(diff.chunks[1])).toContain(58); // Added line: expect(true).toBe(false);

      expect(diff).toMatchSnapshot();
    });

    it('should correctly track added and removed lines', () => {
      const diff = parsePatch(exampleDiff);

      // First chunk should have one addition at line 12
      expect(getAddedLines(diff.chunks[0]).size).toBe(1);
      expect(getAddedLines(diff.chunks[0]).has(12)).toBe(true);
      expect(getRemovedLines(diff.chunks[0]).size).toBe(0);

      // Second chunk should have one addition at line 58 and one removal at line 55
      expect(getAddedLines(diff.chunks[1]).size).toBe(1);
      expect(getAddedLines(diff.chunks[1]).has(58)).toBe(true);
      expect(getRemovedLines(diff.chunks[1]).size).toBe(1);
      expect(getRemovedLines(diff.chunks[1]).has(55)).toBe(true);

      // Verify filename is parsed correctly (without b/ prefix)
      expect(diff.filename).toBe('src/index.test.ts');
    });

    it('should correctly map line numbers for all diff line types', () => {
      const diff = parsePatch(exampleDiff);

      // Check the first chunk - should have context lines and one addition
      const firstChunk = diff.chunks[0];

      // Find the added line
      const addedLine = firstChunk.diffLines.find((line) => line.type === 'add');
      expect(addedLine).toBeDefined();
      expect(addedLine!.content.trim()).toBe('expect(true).toBe(false);');

      // The addition is inserted at line 12 in both before and after context
      expect(addedLine!.beforeLine).toBe(12); // where it was inserted in before file context
      expect(addedLine!.afterLine).toBe(12); // actual position in after file

      // Check that context lines after the addition show the line number shift
      const contextAfterAddition = firstChunk.diffLines.find(
        (line, index) => line.type === 'context' && firstChunk.diffLines[index - 1]?.type === 'add',
      );
      expect(contextAfterAddition).toBeDefined();
      expect(contextAfterAddition!.beforeLine).toBe(12); // still at 12 in before file
      expect(contextAfterAddition!.afterLine).toBe(13); // advanced to 13 in after file due to addition

      // Check the second chunk - has both addition and removal
      const secondChunk = diff.chunks[1];

      const removedLine = secondChunk.diffLines.find((line) => line.type === 'remove');
      const addedLineInSecond = secondChunk.diffLines.find((line) => line.type === 'add');

      expect(removedLine).toBeDefined();
      expect(addedLineInSecond).toBeDefined();

      // For the removal: line was at 55 in before file, would have been at 56 in after file
      expect(removedLine!.content.trim()).toBe('// TODO: add more test cases');
      expect(removedLine!.beforeLine).toBe(55); // actual position in before file
      expect(removedLine!.afterLine).toBe(56); // where it would have been in after file

      // For the addition: inserted at line 58 in both contexts
      expect(addedLineInSecond!.content.trim()).toBe('expect(true).toBe(false);');
      expect(addedLineInSecond!.beforeLine).toBe(58); // where it was inserted in before file context
      expect(addedLineInSecond!.afterLine).toBe(58); // actual position in after file

      // Check that context line after addition shows the shift
      const contextAfterSecondAddition = secondChunk.diffLines.find(
        (line, index) => line.type === 'context' && secondChunk.diffLines[index - 1]?.type === 'add',
      );
      expect(contextAfterSecondAddition).toBeDefined();
      expect(contextAfterSecondAddition!.beforeLine).toBe(58); // still at 58 in before file
      expect(contextAfterSecondAddition!.afterLine).toBe(59); // advanced to 59 in after file
    });
  });

  describe('makeConciseFile', () => {
    it('should make a concise file for an added file', () => {
      const parsedPatch = parsePatch(exampleDiffAdded);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
      });
      expect(concise).toMatchSnapshot();
    });

    it('should make a concise file', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
      });

      expect(concise).toMatchSnapshot();
    });

    it('returns the whole file with space prefixes when the entire file is of interest', () => {
      // Create a simple patch that covers the whole file as context
      const lines = sourceFile.split('\n');
      const wholePatch = {
        filename: 'src/index.test.ts',
        chunks: [
          {
            diffLines: lines.map((line, index) => ({
              type: 'context' as const,
              content: line,
              beforeLine: index + 1,
              afterLine: index + 1,
            })),
          },
        ],
      };

      const concise = makeConciseFile({
        parsedPatch: wholePatch,
        fileContent: sourceFile,
      });

      // Should have space prefix for all lines since no addedLines specified
      const expectedResult = sourceFile
        .split('\n')
        .map((line) => ` ${line}`)
        .join('\n');
      expect(concise).toBe(expectedResult);
    });

    it('should mark addition lines with + prefix and removal lines with - prefix', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
      });
      expect(concise).toMatchSnapshot();
    });

    it('should show both additions and removals in different regions', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
      });

      expect(concise).toMatchSnapshot();
    });

    it('should expand context with beforeLines and afterLines', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
        beforeLines: 3,
        afterLines: 2,
      });

      expect(concise).toMatchSnapshot();
    });

    it('should handle beforeLines and afterLines at file boundaries', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
        beforeLines: 100, // Should clamp to start of file
        afterLines: 100, // Should clamp to end of file
      });

      expect(concise).toMatchSnapshot();
    });
  });
});
