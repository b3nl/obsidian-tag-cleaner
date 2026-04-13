# Remove Unclosed Hashtags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Obsidian command that removes trailing-slash hashtags from both the YAML frontmatter and body of the active file, normalizes whitespace, and reports how many tags were removed.

**Architecture:** All logic lives in `src/tag-cleaner.ts` as pure functions. `splitContent` separates frontmatter from body. `cleanFrontmatter` and `cleanBody` handle their respective zones. `processFile` orchestrates these into a single entry point tested independently. `src/main.ts` registers the command with a thin callback that calls `processFile` and shows a Notice — no logic in the callback itself.

**Tech Stack:** TypeScript, Obsidian Plugin API, Jest + ts-jest, esbuild

---

### Task 1: Set up Jest

**Files:**
- Modify: `package.json`
- Create: `jest.config.js`
- Create: `tsconfig.test.json`
- Create: `src/__mocks__/obsidian.ts`

- [ ] **Step 1: Install Jest and ts-jest**

```bash
npm install --save-dev jest ts-jest @types/jest
```

- [ ] **Step 2: Create `jest.config.js`**

```js
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/src/__mocks__/obsidian.ts',
  },
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.test.json', useESM: true }],
  },
  testMatch: ['**/src/**/*.test.ts'],
};
```

- [ ] **Step 3: Create `tsconfig.test.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 4: Add test script to `package.json`**

Add `"test": "node --experimental-vm-modules node_modules/.bin/jest"` to the `"scripts"` section. The full scripts block should be:

```json
"scripts": {
  "dev": "node esbuild.config.mjs",
  "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
  "version": "node version-bump.mjs && git add manifest.json versions.json",
  "lint": "eslint .",
  "test": "node --experimental-vm-modules node_modules/.bin/jest"
}
```

- [ ] **Step 5: Create Obsidian mock so tests don't import the real Obsidian package**

Create `src/__mocks__/obsidian.ts`:

```ts
export class Plugin {}
export class Notice {}
export class MarkdownView {}
```

- [ ] **Step 6: Verify Jest is wired up**

```bash
npm test -- --passWithNoTests
```

Expected: Jest runs with 0 test suites, exits 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json jest.config.js tsconfig.test.json src/__mocks__/obsidian.ts
git commit -m "chore: set up Jest with ts-jest"
```

---

### Task 2: Implement `splitContent` with TDD

**Files:**
- Create: `src/tag-cleaner.ts`
- Create: `src/tag-cleaner.test.ts`

- [ ] **Step 1: Create the test file with `splitContent` cases**

Create `src/tag-cleaner.test.ts`:

```ts
import { splitContent } from './tag-cleaner';

describe('splitContent', () => {
  it('splits a file with frontmatter and body', () => {
    const { frontmatter, body } = splitContent('---\ntags:\n  - foo\n---\nbody');
    expect(frontmatter).toBe('tags:\n  - foo');
    expect(body).toBe('body');
  });

  it('returns null frontmatter when no --- at start', () => {
    const { frontmatter, body } = splitContent('no frontmatter');
    expect(frontmatter).toBeNull();
    expect(body).toBe('no frontmatter');
  });

  it('handles empty frontmatter block', () => {
    const { frontmatter, body } = splitContent('---\n---\nbody');
    expect(frontmatter).toBe('');
    expect(body).toBe('body');
  });

  it('handles file with frontmatter and no body', () => {
    const { frontmatter, body } = splitContent('---\ntags: [foo]\n---');
    expect(frontmatter).toBe('tags: [foo]');
    expect(body).toBe('');
  });

  it('does not treat a mid-body --- as frontmatter', () => {
    const raw = 'body\n---\nnot frontmatter\n---';
    const { frontmatter, body } = splitContent(raw);
    expect(frontmatter).toBeNull();
    expect(body).toBe(raw);
  });

  it('does not treat --- with leading space as frontmatter', () => {
    const raw = ' ---\ntags: [foo]\n---\nbody';
    const { frontmatter, body } = splitContent(raw);
    expect(frontmatter).toBeNull();
    expect(body).toBe(raw);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './tag-cleaner'`

- [ ] **Step 3: Create `src/tag-cleaner.ts` with `splitContent`**

```ts
export function splitContent(raw: string): { frontmatter: string | null; body: string } {
  if (!raw.startsWith('---\n')) {
    return { frontmatter: null, body: raw };
  }
  const rest = raw.slice(4); // skip opening '---\n'
  const closingIndex = rest.indexOf('\n---\n');
  if (closingIndex === -1) {
    // check for closing --- at end of file (no trailing newline)
    if (rest.endsWith('\n---')) {
      const frontmatter = rest.slice(0, rest.length - 4);
      return { frontmatter, body: '' };
    }
    return { frontmatter: null, body: raw };
  }
  const frontmatter = rest.slice(0, closingIndex);
  const body = rest.slice(closingIndex + 5); // skip '\n---\n'
  return { frontmatter, body };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/tag-cleaner.ts src/tag-cleaner.test.ts
git commit -m "feat: implement splitContent with unit tests"
```

---

### Task 3: Implement `cleanFrontmatter` with TDD

**Files:**
- Modify: `src/tag-cleaner.ts`
- Modify: `src/tag-cleaner.test.ts`

- [ ] **Step 1: Add `cleanFrontmatter` tests to `src/tag-cleaner.test.ts`**

Update the import line at the top to:

```ts
import { splitContent, cleanFrontmatter } from './tag-cleaner';
```

Then append these test suites:

```ts
describe('cleanFrontmatter - block list', () => {
  it('removes a trailing-slash entry (no #)', () => {
    const { result, count } = cleanFrontmatter('tags:\n  - open/\n  - closed/test');
    expect(result).toBe('tags:\n  - closed/test');
    expect(count).toBe(1);
  });

  it('removes a trailing-slash entry (with #)', () => {
    const { result, count } = cleanFrontmatter('tags:\n  - #open/\n  - closed/test');
    expect(result).toBe('tags:\n  - closed/test');
    expect(count).toBe(1);
  });

  it('removes the entire tags key when all entries are unclosed', () => {
    const { result, count } = cleanFrontmatter('tags:\n  - open/');
    expect(result).toBe('');
    expect(count).toBe(1);
  });

  it('leaves a fully-formed block list untouched', () => {
    const { result, count } = cleanFrontmatter('tags:\n  - closed/test');
    expect(result).toBe('tags:\n  - closed/test');
    expect(count).toBe(0);
  });

  it('removes multiple unclosed entries and the tags key', () => {
    const { result, count } = cleanFrontmatter('tags:\n  - open/\n  - #other/');
    expect(result).toBe('');
    expect(count).toBe(2);
  });
});

describe('cleanFrontmatter - inline list', () => {
  it('removes a trailing-slash entry (no #)', () => {
    const { result, count } = cleanFrontmatter('tags: [open/, closed/test]');
    expect(result).toBe('tags: [closed/test]');
    expect(count).toBe(1);
  });

  it('removes a trailing-slash entry (with #)', () => {
    const { result, count } = cleanFrontmatter('tags: [#open/, closed/test]');
    expect(result).toBe('tags: [closed/test]');
    expect(count).toBe(1);
  });

  it('removes the entire tags line when all entries are unclosed', () => {
    const { result, count } = cleanFrontmatter('tags: [open/]');
    expect(result).toBe('');
    expect(count).toBe(1);
  });

  it('leaves a fully-formed inline list untouched', () => {
    const { result, count } = cleanFrontmatter('tags: [closed/test]');
    expect(result).toBe('tags: [closed/test]');
    expect(count).toBe(0);
  });

  it('removes multiple unclosed entries from inline list', () => {
    const { result, count } = cleanFrontmatter('tags: [open/, #other/, closed/test]');
    expect(result).toBe('tags: [closed/test]');
    expect(count).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
npm test
```

Expected: FAIL — `cleanFrontmatter is not a function`

- [ ] **Step 3: Add `cleanFrontmatter` to `src/tag-cleaner.ts`**

```ts
function isUnclosedTagEntry(value: string): boolean {
  const stripped = value.trim().replace(/^#/, '');
  return stripped.endsWith('/');
}

export function cleanFrontmatter(frontmatter: string): { result: string; count: number } {
  let count = 0;
  const lines = frontmatter.split('\n');
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Block list: a key with no value followed by "  - value" lines
    const blockKeyMatch = line.match(/^(\s*[\w-]+):\s*$/);
    if (blockKeyMatch) {
      const keyLine = line;
      const entries: string[] = [];
      const kept: string[] = [];
      let j = i + 1;
      while (j < lines.length && (lines[j] ?? '').match(/^\s+-\s+/)) {
        const entryLine = lines[j] ?? '';
        const value = entryLine.replace(/^\s+-\s+/, '');
        if (isUnclosedTagEntry(value)) {
          count++;
        } else {
          kept.push(entryLine);
        }
        entries.push(entryLine);
        j++;
      }
      if (entries.length > 0) {
        if (kept.length > 0) {
          output.push(keyLine);
          output.push(...kept);
        }
        // else: all entries removed, skip the key entirely
        i = j;
        continue;
      }
    }

    // Inline list: "key: [entry, entry]"
    const inlineMatch = line.match(/^(\s*[\w-]+):\s*\[(.+)\]\s*$/);
    if (inlineMatch) {
      const key = inlineMatch[1];
      const rawEntries = (inlineMatch[2] ?? '').split(',').map(e => e.trim());
      const kept = rawEntries.filter(e => !isUnclosedTagEntry(e));
      count += rawEntries.length - kept.length;
      if (kept.length > 0) {
        output.push(`${key}: [${kept.join(', ')}]`);
      }
      // else: all removed, skip the line
      i++;
      continue;
    }

    output.push(line);
    i++;
  }

  return { result: output.join('\n'), count };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all previous + 10 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/tag-cleaner.ts src/tag-cleaner.test.ts
git commit -m "feat: implement cleanFrontmatter with unit tests"
```

---

### Task 4: Implement `cleanBody` with TDD

**Files:**
- Modify: `src/tag-cleaner.ts`
- Modify: `src/tag-cleaner.test.ts`

- [ ] **Step 1: Add `cleanBody` tests to `src/tag-cleaner.test.ts`**

Update the import line at the top to:

```ts
import { splitContent, cleanFrontmatter, cleanBody } from './tag-cleaner';
```

Then append:

```ts
describe('cleanBody', () => {
  it('removes a trailing-slash tag and following space', () => {
    const { result, count } = cleanBody('status: #open/ review');
    expect(result).toBe('status: review');
    expect(count).toBe(1);
  });

  it('removes a nested trailing-slash tag', () => {
    const { result, count } = cleanBody('#category/sub/ done');
    expect(result).toBe('done');
    expect(count).toBe(1);
  });

  it('leaves a fully-formed nested tag untouched', () => {
    const { result, count } = cleanBody('#closed/test is fine');
    expect(result).toBe('#closed/test is fine');
    expect(count).toBe(0);
  });

  it('leaves multiple fully-formed tags untouched', () => {
    const { result, count } = cleanBody('#closed #movies/james_bond/watched');
    expect(result).toBe('#closed #movies/james_bond/watched');
    expect(count).toBe(0);
  });

  it('removes multiple unclosed tags on one line', () => {
    const { result, count } = cleanBody('#a/ #b/ text');
    expect(result).toBe('text');
    expect(count).toBe(2);
  });

  it('returns empty string unchanged', () => {
    const { result, count } = cleanBody('');
    expect(result).toBe('');
    expect(count).toBe(0);
  });

  it('returns content with no tags unchanged', () => {
    const { result, count } = cleanBody('no tags here');
    expect(result).toBe('no tags here');
    expect(count).toBe(0);
  });

  it('removes unclosed tag but keeps closed tag on same line', () => {
    const { result, count } = cleanBody('#open/ #closed/test side');
    expect(result).toBe('#closed/test side');
    expect(count).toBe(1);
  });

  it('removes unclosed tag at end of line', () => {
    const { result, count } = cleanBody('text #open/');
    expect(result).toBe('text');
    expect(count).toBe(1);
  });

  it('removes unclosed tag on its own line, preserving surrounding lines', () => {
    const { result, count } = cleanBody('line1\n#open/\nline3');
    expect(result).toBe('line1\n\nline3');
    expect(count).toBe(1);
  });

  it('removes unclosed tag between two valid tags', () => {
    const { result, count } = cleanBody('#closed #open/ #movies/james_bond');
    expect(result).toBe('#closed #movies/james_bond');
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
npm test
```

Expected: FAIL — `cleanBody is not a function`

- [ ] **Step 3: Add `cleanBody` to `src/tag-cleaner.ts`**

```ts
export function cleanBody(content: string): { result: string; count: number } {
  const matches = content.match(/#[\w/-]+\/ */g);
  const count = matches ? matches.length : 0;
  const cleaned = content.replace(/#[\w/-]+\/ */g, '');
  const result = cleaned
    .split('\n')
    .map(line => line.replace(/ {2,}/g, ' ').trimEnd())
    .join('\n');
  return { result, count };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all previous + 11 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/tag-cleaner.ts src/tag-cleaner.test.ts
git commit -m "feat: implement cleanBody with unit tests"
```

---

### Task 5: Implement `processFile` with TDD

**Files:**
- Modify: `src/tag-cleaner.ts`
- Modify: `src/tag-cleaner.test.ts`

- [ ] **Step 1: Add `processFile` tests to `src/tag-cleaner.test.ts`**

Update the import line at the top to:

```ts
import { splitContent, cleanFrontmatter, cleanBody, processFile } from './tag-cleaner';
```

Then append:

```ts
describe('processFile', () => {
  it('returns count 0 and unchanged content when no unclosed tags', () => {
    const input = '---\ntags:\n  - closed/test\n---\nsome body #closed/test';
    const { cleaned, count } = processFile(input);
    expect(count).toBe(0);
    expect(cleaned).toBe(input);
  });

  it('cleans body-only file (no frontmatter)', () => {
    const { cleaned, count } = processFile('text #open/ end');
    expect(cleaned).toBe('text end');
    expect(count).toBe(1);
  });

  it('cleans frontmatter and body together - full page', () => {
    const input = [
      '---',
      'tags:',
      '  - open/',
      '  - #project/',
      '  - closed/test',
      '  - #movies/james_bond/watched',
      'tags2: [open/, #inbox/, closed/test]',
      '---',
      '',
      '# My Note',
      '',
      'Some text with #open/ and #closed/test tags.',
      '',
      'Another line with #a/ #b/ and #movies/james_bond/watched.',
      '',
      '---',
      '',
      'A horizontal rule above is part of the body.',
      '',
      '#category/sub/ at start of line.',
    ].join('\n');

    const expected = [
      '---',
      'tags:',
      '  - closed/test',
      '  - #movies/james_bond/watched',
      'tags2: [closed/test]',
      '---',
      '',
      '# My Note',
      '',
      'Some text with and #closed/test tags.',
      '',
      'Another line with and #movies/james_bond/watched.',
      '',
      '---',
      '',
      'A horizontal rule above is part of the body.',
      '',
      'at start of line.',
    ].join('\n');

    const { cleaned, count } = processFile(input);
    expect(cleaned).toBe(expected);
    expect(count).toBe(8);
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
npm test
```

Expected: FAIL — `processFile is not a function`

- [ ] **Step 3: Add `processFile` to `src/tag-cleaner.ts`**

```ts
export function processFile(raw: string): { cleaned: string; count: number } {
  const { frontmatter, body } = splitContent(raw);

  if (frontmatter === null) {
    const { result, count } = cleanBody(body);
    return { cleaned: result, count };
  }

  const fm = cleanFrontmatter(frontmatter);
  const bd = cleanBody(body);
  const cleaned = `---\n${fm.result}\n---\n${bd.result}`;
  return { cleaned, count: fm.count + bd.count };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — all previous + 3 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/tag-cleaner.ts src/tag-cleaner.test.ts
git commit -m "feat: implement processFile with unit tests"
```

---

### Task 6: Wire up the Obsidian command in `main.ts`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace `src/main.ts` with the real plugin**

```ts
import { Editor, MarkdownView, Notice, Plugin } from 'obsidian';
import { processFile } from './tag-cleaner';

export default class TagCleanerPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: 'remove-unclosed-tags',
      name: 'Remove unclosed tags',
      editorCallback: (editor: Editor, _view: MarkdownView) => {
        const { cleaned, count } = processFile(editor.getValue());
        if (count === 0) {
          new Notice('No unclosed tags found');
          return;
        }
        editor.setValue(cleaned);
        new Notice(`Removed ${count} unclosed tag(s)`);
      },
    });
  }

  onunload() {}
}
```

- [ ] **Step 2: Run tests to confirm nothing broke**

```bash
npm test
```

Expected: PASS — all tests pass.

- [ ] **Step 3: Build the plugin to confirm TypeScript compiles**

```bash
npm run build
```

Expected: exits 0, `main.js` produced in project root.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: register remove-unclosed-tags command in plugin"
```

---

### Task 7: Remove unused boilerplate

**Files:**
- Delete: `src/settings.ts`

- [ ] **Step 1: Confirm `src/main.ts` does not import from `./settings`**

Read `src/main.ts` and verify there is no `import ... from './settings'` line. If there is none, proceed.

- [ ] **Step 2: Delete `src/settings.ts`**

```bash
rm src/settings.ts
```

- [ ] **Step 3: Run lint, build, and tests**

```bash
npm run lint && npm run build && npm test
```

Expected: all exit 0, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused settings boilerplate"
```
