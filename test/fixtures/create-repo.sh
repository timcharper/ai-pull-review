#!/bin/sh

rm -rf test-git-repo

git init test-git-repo
cd test-git-repo
mkdir -p src .cursor/rules

echo "Hello, world!" > README.md

cat <<-EOF > src/index.test.ts
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
EOF

git add README.md src
git commit -m "Initial commit"

# feature branch

git checkout -b feature-branch
echo "Feature branch" > feature.txt
git add feature.txt
git commit -m "Feature branch"

cat <<-EOF > .cursor/rules/text-files.mdc

---
description: Rules for UI / React / Typescript development
globs: **/*.txt,**/*.md
alwaysApply: false
---

Much text. Very spell. Wow.

EOF

cat <<-EOF > .cursor/rules/codes-files.mdc

---
description: Rules for UI / React / Typescript development
globs: **/*.ts,**/*.tsx
alwaysApply: false
---

very professional code. wow.

EOF

cat <<-EOF >> README.md

lots of editss here ok.
EOF

sed -i "/should remove prefix from path/a \ \ \ \ \ \ expect(true).toBe(false);" src/index.test.ts
sed -i "/should handle directory patterns/a \ \ \ \ \ \ expect(true).toBe(false);" src/index.test.ts

git add .cursor/rules
git add README.md
git commit -m "Add cursor rules"



