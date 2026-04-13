function isUnclosedTagEntry(value: string): boolean {
  const stripped = value.trim().replace(/^["']|["']$/g, '').replace(/^#/, '');
  return stripped.endsWith('/');
}

export function cleanFrontmatter(frontmatter: string): { result: string; count: number } {
  let count = 0;
  const lines = frontmatter.split('\n');
  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';

    // Block list: a tags key with no inline value followed by "  - value" lines.
    // Only keys named "tags" (case-insensitive) are processed — other keys are left untouched.
    const blockKeyMatch = line.match(/^(\s*[\w-]+):\s*$/);
    if (blockKeyMatch && blockKeyMatch[1]?.trim().toLowerCase() === 'tags') {
      const keyLine = line;
      let entryCount = 0;
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
        entryCount++;
        j++;
      }
      if (entryCount > 0) {
        if (kept.length > 0) {
          output.push(keyLine);
          output.push(...kept);
        }
        // else: all entries removed, skip the key entirely
        i = j;
        continue;
      }
      // No list items followed this key — fall through to inline check
    }

    // Inline list: "tags: [entry, entry]". Only the "tags" key is processed.
    const inlineMatch = line.match(/^(\s*[\w-]+):\s*\[(.+)\]\s*$/);
    if (inlineMatch && inlineMatch[1]?.trim().toLowerCase() === 'tags') {
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

export function cleanBody(content: string): { result: string; count: number } {
  const pattern = /#(?:[\w-]+\/)+(?![\w-]) */g;
  const matches = content.match(pattern);
  const count = matches ? matches.length : 0;
  const cleaned = content.replace(pattern, '');
  const result = cleaned
    .split('\n')
    .map(line => line.replace(/ {2,}/g, ' ').trimEnd())
    .join('\n');
  return { result, count };
}

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

export function splitContent(raw: string): { frontmatter: string | null; body: string } {
  if (!raw.startsWith('---\n')) {
    return { frontmatter: null, body: raw };
  }
  const rest = raw.slice(4); // skip opening '---\n'

  // Handle empty frontmatter: closing --- is immediately after opening ---\n
  if (rest.startsWith('---\n')) {
    return { frontmatter: '', body: rest.slice(4) };
  }
  if (rest === '---') {
    return { frontmatter: '', body: '' };
  }

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
