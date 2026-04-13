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
