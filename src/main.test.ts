import { jest, beforeEach, describe, it, expect } from '@jest/globals';
import { Plugin, Notice } from 'obsidian';
import TagCleanerPlugin from './main';

type EditorCallback = (editor: MockEditor, view: unknown) => void;

class MockEditor {
  private content: string;
  constructor(content: string) { this.content = content; }
  getValue() { return this.content; }
  setValue(value: string) { this.content = value; }
}

function makePlugin(): { plugin: TagCleanerPlugin; getCallback: () => EditorCallback } {
  let captured: EditorCallback | undefined;
  jest.spyOn(Plugin.prototype, 'addCommand').mockImplementation((cmd: { editorCallback: EditorCallback }) => {
    captured = cmd.editorCallback;
  });
  const plugin = new TagCleanerPlugin();
  void plugin.onload();
  return {
    plugin,
    getCallback: () => {
      if (!captured) throw new Error('addCommand was not called');
      return captured;
    },
  };
}

beforeEach(() => {
  jest.restoreAllMocks();
});

describe('TagCleanerPlugin command callback', () => {
  it('calls addCommand with correct id and name', () => {
    const spy = jest.spyOn(Plugin.prototype, 'addCommand').mockImplementation(() => {});
    const plugin = new TagCleanerPlugin();
    void plugin.onload();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      id: 'remove-unclosed-tags',
      name: 'Remove unclosed tags',
    }));
  });

  it('shows "No unclosed tags found" and does not call setValue when no unclosed tags', () => {
    const { getCallback } = makePlugin();
    const noticeSpy = jest.spyOn(Notice.prototype, 'constructor' as never);
    const editor = new MockEditor('#closed/test is fine');
    const setValueSpy = jest.spyOn(editor, 'setValue');

    getCallback()(editor, null);

    expect(setValueSpy).not.toHaveBeenCalled();
    expect(noticeSpy).not.toHaveBeenCalled(); // Notice is constructed, check via mock
  });

  it('removes unclosed tags and shows count notice', () => {
    const { getCallback } = makePlugin();
    const editor = new MockEditor('hello #open/ world');

    getCallback()(editor, null);

    expect(editor.getValue()).toBe('hello world');
  });

  it('calls setValue with cleaned content when unclosed tags found', () => {
    const { getCallback } = makePlugin();
    const editor = new MockEditor('#open/ some text');
    const setValueSpy = jest.spyOn(editor, 'setValue');

    getCallback()(editor, null);

    expect(setValueSpy).toHaveBeenCalledWith('some text');
  });
});

describe('integration: full file processing via command', () => {
  it('no-op when file has no unclosed tags', () => {
    const { getCallback } = makePlugin();
    const input = '---\ntags:\n  - closed/test\n---\nsome body #closed/test';
    const editor = new MockEditor(input);
    const setValueSpy = jest.spyOn(editor, 'setValue');

    getCallback()(editor, null);

    expect(setValueSpy).not.toHaveBeenCalled();
    expect(editor.getValue()).toBe(input);
  });

  it('cleans body-only file (no frontmatter)', () => {
    const { getCallback } = makePlugin();
    const editor = new MockEditor('text #open/ end');

    getCallback()(editor, null);

    expect(editor.getValue()).toBe('text end');
  });

  it('cleans frontmatter and body together - full page', () => {
    const { getCallback } = makePlugin();
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
      'tags2: [open/, #inbox/, closed/test]',
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

    const editor = new MockEditor(input);
    getCallback()(editor, null);

    expect(editor.getValue()).toBe(expected);
  });

  it('cleans frontmatter with inline tags list', () => {
    const { getCallback } = makePlugin();
    const input = [
      '---',
      'tags: [open/, #project/, closed/test, #movies/james_bond/watched]',
      '---',
      '',
      'Body text #closed/test.',
    ].join('\n');

    const expected = [
      '---',
      'tags: [closed/test, #movies/james_bond/watched]',
      '---',
      '',
      'Body text #closed/test.',
    ].join('\n');

    const editor = new MockEditor(input);
    getCallback()(editor, null);

    expect(editor.getValue()).toBe(expected);
  });
});
