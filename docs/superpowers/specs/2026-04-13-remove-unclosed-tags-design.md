# Design: Remove Unclosed Hashtags Command

**Date:** 2026-04-13

## Overview

Add a command to the obsidian-tag-cleaner plugin that removes unclosed (trailing-slash) hashtags from the active file. An unclosed hashtag is any tag whose path ends with a `/`, e.g. `#open/` or `#category/sub/`. Fully-formed tags like `#closed/test`, `#closed`, or `#movies/james_bond/watched` are left untouched.

The command operates on the entire file, handling two distinct zones separately:
- **YAML frontmatter** (between `---` delimiters at the top of the file)
- **Body content** (everything after the frontmatter)

## Command

- **ID:** `remove-unclosed-tags`
- **Name:** `Remove unclosed tags`
- **Type:** `editorCallback` — only active when a markdown file is open
- **Scope:** Always operates on the entire file content

## Architecture

### File Structure

- `src/main.ts` — Plugin class. Registers the command, splits content into frontmatter/body, calls the appropriate cleaner functions, reassembles, writes back, shows Notice.
- `src/tag-cleaner.ts` — Exports pure functions for cleaning body content and frontmatter.
- `src/tag-cleaner.test.ts` — Jest unit tests.

### Exported Functions

```ts
// Remove trailing-slash hashtags from file body content
export function cleanBody(content: string): { result: string; count: number }

// Remove trailing-slash tag entries from YAML frontmatter string
export function cleanFrontmatter(frontmatter: string): { result: string; count: number }

// Split raw file content into frontmatter and body parts
export function splitContent(raw: string): { frontmatter: string | null; body: string }
```

### Core Logic

#### Body cleaning (`cleanBody`)

Regex: `/#[\w/-]+\/ */g`

- Matches `#open/`, `#category/sub/`, `#a/b/c/` (with optional trailing spaces)
- Does not match `#closed/test`, `#movies/james_bond/watched`, `#tag`
- After removal, normalize double spaces and trim trailing whitespace per line
- Returns cleaned string and count of removed tags

#### Frontmatter cleaning (`cleanFrontmatter`)

Frontmatter tags can appear with or without a `#` prefix and in two formats:

**Block list:**
```yaml
tags:
  - open/        ← remove (trailing slash, no #)
  - #open/       ← remove (trailing slash, with #)
  - closed/test  ← keep
  - #closed/test  ← keep
```
Remove the entire `- value` line if the value (with or without leading `#`) ends with `/`.
If all entries are removed, remove the entire `tags:` key (including the `tags:` line itself).

**Inline list:**
```yaml
tags: [open/, #open/, closed/test]
```
Remove entries whose value (with or without leading `#`) ends with `/`.
If all entries are removed, remove the entire `tags:` line.

#### Content splitting (`splitContent`)

Frontmatter is valid **only** if the file begins with `---` on line 1, column 1 (i.e. the very first characters of the file are `---\n`). A `---` appearing anywhere else is a horizontal rule in the body and must not be treated as a frontmatter delimiter.

If the file starts with `---\n` and a closing `---` line is found, everything between the two delimiters is the frontmatter. Everything after the closing `---\n` is the body.

If no valid frontmatter block is found, `frontmatter` is `null` and `body` is the full content.

## Data Flow

```
User triggers command
  → editor.getValue() → raw file content (string)
  → splitContent(raw) → { frontmatter, body }
  → cleanFrontmatter(frontmatter) → { result, count: fmCount }  (skipped if null)
  → cleanBody(body) → { result, count: bodyCount }
  → reassemble: frontmatter_result + body_result
  → editor.setValue(cleaned)
  → totalCount = fmCount + bodyCount
  → if totalCount === 0: Notice("No unclosed tags found")
  → else: Notice("Removed N unclosed tag(s)")
```

## Error Handling

- If no unclosed tags are found anywhere, show a Notice: `"No unclosed tags found"`.
- No file I/O errors expected; we use the editor API directly.

## Testing

Framework: **Jest** with `ts-jest`.

### Test Cases for `cleanBody`

| Input | Expected output |
|---|---|
| `"status: #open/ review"` | `"status: review"` (count: 1) |
| `"#category/sub/ done"` | `"done"` (count: 1) |
| `"#closed/test is fine"` | `"#closed/test is fine"` (count: 0) |
| `"#closed #movies/james_bond/watched"` | `"#closed #movies/james_bond/watched"` (count: 0) |
| `"#a/ #b/ text"` | `"text"` (count: 2) |
| `""` | `""` (count: 0) |
| `"no tags here"` | `"no tags here"` (count: 0) |
| `"#open/ #closed/test side"` | `"#closed/test side"` (count: 1) |
| `"text #open/"` | `"text"` (count: 1) |
| `"line1\n#open/\nline3"` | `"line1\n\nline3"` (count: 1) |
| `"#closed #open/ #movies/james_bond"` | `"#closed #movies/james_bond"` (count: 1) |

### Test Cases for `cleanFrontmatter`

**Block list:**

| Input | Expected output | Count |
|---|---|---|
| `"tags:\n  - open/\n  - closed/test"` | `"tags:\n  - closed/test"` | 1 |
| `"tags:\n  - #open/\n  - closed/test"` | `"tags:\n  - closed/test"` | 1 |
| `"tags:\n  - open/"` | `""` (entire tags key removed) | 1 |
| `"tags:\n  - closed/test"` | `"tags:\n  - closed/test"` | 0 |
| `"tags:\n  - open/\n  - #other/"` | `""` (entire tags key removed) | 2 |

**Inline list:**

| Input | Expected output | Count |
|---|---|---|
| `"tags: [open/, closed/test]"` | `"tags: [closed/test]"` | 1 |
| `"tags: [#open/, closed/test]"` | `"tags: [closed/test]"` | 1 |
| `"tags: [open/]"` | `""` (entire line removed) | 1 |
| `"tags: [closed/test]"` | `"tags: [closed/test]"` | 0 |
| `"tags: [open/, #other/, closed/test]"` | `"tags: [closed/test]"` | 2 |

### Test Cases for `splitContent`

| Input | frontmatter | body |
|---|---|---|
| `"---\ntags:\n  - foo\n---\nbody"` | `"tags:\n  - foo"` | `"body"` |
| `"no frontmatter"` | `null` | `"no frontmatter"` |
| `"---\n---\nbody"` | `""` | `"body"` |
| `"---\ntags: [foo]\n---"` | `"tags: [foo]"` | `""` |
| `"body\n---\nnot frontmatter\n---"` | `null` | `"body\n---\nnot frontmatter\n---"` |
| `" ---\ntags: [foo]\n---\nbody"` | `null` | `" ---\ntags: [foo]\n---\nbody"` (leading space = not frontmatter) |

### Integration Test: Full Page

A single test that exercises all cases together on one realistic file:

**Input:**
```
---
tags:
  - open/
  - #project/
  - closed/test
  - #movies/james_bond/watched
tags2: [open/, #inbox/, closed/test]
---

# My Note

Some text with #open/ and #closed/test tags.

Another line with #a/ #b/ and #movies/james_bond/watched.

---

A horizontal rule above is part of the body.

#category/sub/ at start of line.
```

**Expected output:**
```
---
tags:
  - closed/test
  - #movies/james_bond/watched
tags2: [closed/test]
---

# My Note

Some text with and #closed/test tags.

Another line with and #movies/james_bond/watched.

---

A horizontal rule above is part of the body.

at start of line.
```

**Expected count:** 8 — frontmatter: `open/`, `#project/`, `open/`, `#inbox/` (4); body: `#open/`, `#a/`, `#b/`, `#category/sub/` (4)
