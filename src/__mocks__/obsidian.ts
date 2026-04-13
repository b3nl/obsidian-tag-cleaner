export class Plugin {
  addCommand(command: { id: string; name: string; editorCallback: (editor: unknown, view: unknown) => void }) {
    // captured by tests via jest.spyOn or subclass
  }
}
export class Notice {
  constructor(public message: string) {}
}
export class MarkdownView {}
