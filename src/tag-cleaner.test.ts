import { splitContent, cleanFrontmatter, cleanBody } from './tag-cleaner';

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

  it('handles empty frontmatter block with no body', () => {
    const { frontmatter, body } = splitContent('---\n---');
    expect(frontmatter).toBe('');
    expect(body).toBe('');
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

  it('removes a quoted trailing-slash entry (with #)', () => {
    const { result, count } = cleanFrontmatter('tags:\n  - breakfast/food\n  - "#breakfast/"');
    expect(result).toBe('tags:\n  - breakfast/food');
    expect(count).toBe(1);
  });

  it('removes a quoted trailing-slash entry (without #)', () => {
    const { result, count } = cleanFrontmatter('tags:\n  - breakfast/food\n  - "breakfast/"');
    expect(result).toBe('tags:\n  - breakfast/food');
    expect(count).toBe(1);
  });

	it('removes a quoted trailing-slash entry (without #)', () => {
		const { result, count } = cleanFrontmatter('tags:\n  - "breakfast/food"\n  - "breakfast/"');
		expect(result).toBe('tags:\n  - "breakfast/food"');
		expect(count).toBe(1);
	});
});

describe('cleanFrontmatter - non-tags keys', () => {
  it('does not modify a block list under a non-tags key', () => {
    const { result, count } = cleanFrontmatter('aliases:\n  - open/\n  - closed/test');
    expect(result).toBe('aliases:\n  - open/\n  - closed/test');
    expect(count).toBe(0);
  });

  it('does not modify an inline list under a non-tags key', () => {
    const { result, count } = cleanFrontmatter('aliases: [open/, closed/test]');
    expect(result).toBe('aliases: [open/, closed/test]');
    expect(count).toBe(0);
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

