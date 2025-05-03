import { globToRegex, stripPrefix } from './glob';

describe('glob utilities', () => {
  describe('stripPrefix', () => {
    it('handles trailing slashes', () => {
      expect(stripPrefix('src/', 'src/path.js')).toBe('/path.js');
      expect(stripPrefix('src/', './src/path.js')).toBe('/path.js');
      expect(stripPrefix('src/', '/src/path.js')).toBe('/path.js');
    });

    it('should remove prefix from path', () => {
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
