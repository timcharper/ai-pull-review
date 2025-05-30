import { makeConciseFile, parsePatch, getAddedLines, getRemovedLines } from './diff';

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

describe('diff', () => {
  describe('parseDiff', () => {
    it('should parse the diff', () => {
      const diff = parsePatch(exampleDiff);
      expect(diff.chunks.length).toBe(2);

      // First chunk
      expect(diff.chunks[0].before.startLine).toBe(9);
      expect(diff.chunks[0].after.startLine).toBe(9);
      expect(getAddedLines(diff.chunks[0])).toContain(12); // Added line: expect(true).toBe(false);

      // Second chunk
      expect(diff.chunks[1].before.startLine).toBe(52);
      expect(diff.chunks[1].after.startLine).toBe(53);
      expect(getAddedLines(diff.chunks[1])).toContain(58); // Added line: expect(true).toBe(false);
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
  });

  describe('makeConciseFile', () => {
    it('should make a concise file', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
        show: 'additions',
      });

      expect(concise).toMatchSnapshot();
    });

    it('returns the whole file with space prefixes when the entire file is of interest', () => {
      // Create a simple patch that covers the whole file
      const wholePatch = {
        filename: 'src/index.test.ts',
        chunks: [
          {
            before: { startLine: 1, endLine: sourceFile.split('\n').length, lines: [] as Array<[boolean, string]> },
            after: { startLine: 1, endLine: sourceFile.split('\n').length, lines: [] as Array<[boolean, string]> },
          },
        ],
      };

      const concise = makeConciseFile({
        parsedPatch: wholePatch,
        fileContent: sourceFile,
        show: 'additions',
      });

      // Should have space prefix for all lines since no addedLines specified
      const expectedResult = sourceFile
        .split('\n')
        .map((line) => ` ${line}`)
        .join('\n');
      expect(concise).toBe(expectedResult);
    });

    it('should mark addition lines with + prefix when show is "additions"', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
        show: 'additions',
      });
      expect(concise).toMatchSnapshot();
    });

    it('should mark removal lines with - prefix when show is "removals"', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
        show: 'removals',
      });

      expect(concise).toMatchSnapshot();
    });

    it('should not mark lines when they are not in the specified change set', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
        show: 'removals', // But we're showing removals, so additions won't have prefix
      });

      expect(concise).toMatchSnapshot();
    });

    it('should handle both additions and removals in different regions', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
        show: 'additions',
      });

      expect(concise).toMatchSnapshot();
    });

    it('should expand context with beforeLines and afterLines', () => {
      const parsedPatch = parsePatch(exampleDiff);
      const concise = makeConciseFile({
        parsedPatch,
        fileContent: sourceFile,
        show: 'additions',
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
        show: 'additions',
        beforeLines: 100, // Should clamp to start of file
        afterLines: 100, // Should clamp to end of file
      });

      expect(concise).toMatchSnapshot();
    });
  });
});
