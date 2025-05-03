import { parseCursorRule, matchesGlob, matchesAnyGlob } from './cursorRules';

describe('parseCursorRule', () => {
  it('tolerates whitespace in front matter', () => {
    const ruleContent = `
    
---
description: generating mock providers for DType or IDType TypeDefinitions
globs: **/__dtype-mocks__/*.mock.ts,*Mock.ts
alwaysApply: false
---

my custom rules here`;

    const rule = parseCursorRule(ruleContent);

    expect(rule).toEqual({
      description: 'generating mock providers for DType or IDType TypeDefinitions',
      globs: ['**/__dtype-mocks__/*.mock.ts', '*Mock.ts'],
      alwaysApply: false,
      content: 'my custom rules here',
    });
  });

  it('should parse a cursor rule file correctly', () => {
    const ruleContent = `---
description: generating mock providers for DType or IDType TypeDefinitions
globs: **/__dtype-mocks__/*.mock.ts,*Mock.ts
alwaysApply: false
---

my custom rules here`;

    const rule = parseCursorRule(ruleContent);

    expect(rule).toEqual({
      description: 'generating mock providers for DType or IDType TypeDefinitions',
      globs: ['**/__dtype-mocks__/*.mock.ts', '*Mock.ts'],
      alwaysApply: false,
      content: 'my custom rules here',
    });
  });

  it('should handle missing front matter', () => {
    const ruleContent = 'my custom rules here';

    expect(() => parseCursorRule(ruleContent)).toThrow('Invalid cursor rule: missing front matter');
  });

  it('should handle empty globs', () => {
    const ruleContent = `---
description: test rule
globs: 
alwaysApply: false
---

my custom rules here`;

    const rule = parseCursorRule(ruleContent);

    expect(rule.globs).toEqual([]);
  });

  it('should handle alwaysApply as true', () => {
    const ruleContent = `---
description: test rule
globs: *.ts
alwaysApply: true
---

my custom rules here`;

    const rule = parseCursorRule(ruleContent);

    expect(rule.alwaysApply).toBe(true);
  });
});

describe('glob matching', () => {
  describe('matchesGlob', () => {
    it('should match exact file paths', () => {
      expect(matchesGlob('src/file.ts', 'src/file.ts')).toBe(true);
    });

    it('should match wildcard patterns', () => {
      expect(matchesGlob('src/file.ts', '*.ts')).toBe(true);
      expect(matchesGlob('src/file.ts', 'src/*.ts')).toBe(true);
      expect(matchesGlob('src/nested/file.ts', '**/*.ts')).toBe(true);
    });

    it('should not match non-matching patterns', () => {
      expect(matchesGlob('src/file.ts', '*.js')).toBe(false);
      expect(matchesGlob('src/file.ts', 'test/*.ts')).toBe(false);
    });
  });

  describe('matchesAnyGlob', () => {
    it('should match if any glob pattern matches', () => {
      expect(matchesAnyGlob('src/file.ts', ['*.js', '*.ts'])).toBe(true);
      expect(matchesAnyGlob('src/file.ts', ['test/*.ts', 'src/*.ts'])).toBe(true);
    });

    it('should not match if no glob patterns match', () => {
      expect(matchesAnyGlob('src/file.ts', ['*.js', '*.jsx'])).toBe(false);
      expect(matchesAnyGlob('src/file.ts', ['test/*.ts', 'lib/*.ts'])).toBe(false);
    });

    it('should handle empty glob list', () => {
      expect(matchesAnyGlob('src/file.ts', [])).toBe(false);
    });
  });
});
