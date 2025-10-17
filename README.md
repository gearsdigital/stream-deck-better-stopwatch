# Better Stopwatch

A Stream Deck plugin that provides an enhanced stopwatch with start/stop and reset functionality. Each key runs independently, allowing you to track multiple timers simultaneously.

## Features

- **Independent Timers**: Each Stream Deck key runs its own stopwatch independently
- **Simple Controls**:
  - Short press to start/stop the timer
  - Long press to reset to initial state
- **Visual Display**: Shows elapsed time directly on your Stream Deck key

## Requirements

- Stream Deck Software version 6.5 or higher
- macOS 12 or higher / Windows 10 or higher

## Installation

### From Release

1. Download the latest `.streamDeckPlugin` file from the releases page
2. Double-click the file to install it in Stream Deck

### Manual Installation

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run build` to build the plugin
4. The plugin will be built to `com.gearsdigital.betterstopwatch.sdPlugin/`
5. Double-click the `.streamDeckPlugin` file or manually copy the folder to your Stream Deck plugins directory

## Development

### Prerequisites

- Node.js 20 or higher
- npm
- Stream Deck software

### Setup

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Build and watch for changes (auto-restart Stream Deck on changes)
npm run watch
```

### Project Structure

```
better-stop-watch/
├── src/
│   ├── actions/
│   │   └── stopwatch.ts      # Stopwatch action implementation
│   └── plugin.ts              # Main plugin entry point
├── com.gearsdigital.betterstopwatch.sdPlugin/
│   ├── imgs/                  # Plugin icons and images
│   ├── ui/                    # Property Inspector UI
│   └── manifest.json          # Plugin manifest
├── rollup.config.mjs          # Rollup build configuration
└── package.json
```

## Usage

1. Open Stream Deck software
2. Find "Better Stopwatch" in the actions list
3. Drag the action onto a key
4. **Short press** the key to start/stop the timer
5. **Long press** the key to reset the timer

## Building

The plugin uses Rollup for bundling. The build process compiles TypeScript to JavaScript and bundles all dependencies.

```bash
npm run build
```

The compiled plugin will be output to `com.gearsdigital.betterstopwatch.sdPlugin/bin/`.

## Release Process

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated versioning and releases.

### Automated Releases

Releases are automatically created when you push to the `main` branch using [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - Creates a minor version bump (0.x.0)
- `fix:` - Creates a patch version bump (0.0.x)
- `feat!:` or `fix!:` or `BREAKING CHANGE:` - Creates a major version bump (x.0.0)

### Commit Message Format

Use conventional commit messages for automatic versioning:

```bash
# Features (minor version bump)
git commit -m "feat: add pause functionality to stopwatch"

# Bug fixes (patch version bump)
git commit -m "fix: correct timer display formatting"

# Breaking changes (major version bump)
git commit -m "feat!: redesign stopwatch API"

# Other types (no version bump)
git commit -m "docs: update README"
git commit -m "chore: update dependencies"
git commit -m "style: format code"
git commit -m "refactor: restructure timer logic"
```

### Manual Release

You can also create a manual release by pushing a tag:

```bash
git tag v1.0.0
git push origin v1.0.0
```

This will trigger the release workflow and create a GitHub release with the built `.streamDeckPlugin` file.

## Author

Steffen Giers

## License

MIT
