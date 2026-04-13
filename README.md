# Obsidian Tag Cleaner

An [Obsidian](https://obsidian.md) plugin that removes unclosed (trailing-slash) hashtags from your notes.

## What it does

Obsidian supports nested tags like `#movies/james_bond/watched`. An unclosed tag is one whose path ends with a `/`, e.g. `#open/` or `#category/sub/` — likely the result of an incomplete entry. This plugin finds and removes them.

**Removes:**
- `#open/`
- `#category/sub/`
- `open/` and `#open/` in YAML frontmatter tag lists

**Keeps:**
- `#closed/test`
- `#movies/james_bond/watched`
- `#tag`

## Usage

Open the Command Palette (`Cmd/Ctrl + P`) and run **"Remove unclosed tags"**. The command operates on the active file and reports how many tags were removed.

## Installation

### Manual

1. Install and Enable the plugin in **Settings → Community Plugins**.

## Development

```bash
npm install
npm run dev      # watch mode
npm run build    # production build
npm test         # run tests
npm run lint     # lint
```

## License

[0-BSD](LICENSE)
