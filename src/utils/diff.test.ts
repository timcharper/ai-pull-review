import { makeConciseFile, parsePatch } from './diff';

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
@@ -54,6 +55,7 @@ describe('glob utilities', () => {
     });
 
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
      expect(diff.chunks[0].startLine).toBe(9);
      expect(diff.chunks[0].endLine).toBe(16);
      expect(diff.chunks[1].startLine).toBe(55);
      expect(diff.chunks[1].endLine).toBe(62);
    });
  });

  describe('makeConciseFile', () => {
    it('should make a concise file', () => {
      const concise = makeConciseFile({
        filename: 'src/index.test.ts',
        fileContent: sourceFile,
        regionsOfInterest: [
          {
            startLine: 9,
            endLine: 16,
          },
          {
            startLine: 55,
            endLine: 62,
          },
        ],
      });

      expect(concise).toMatchSnapshot();
    });

    it('returns the whole file if the entire file is of interest', () => {
      const concise = makeConciseFile({
        filename: 'src/index.test.ts',
        fileContent: sourceFile,
        regionsOfInterest: [{ startLine: 1, endLine: sourceFile.split('\n').length }],
      });

      expect(concise).toBe(sourceFile);
    });
  });
});
