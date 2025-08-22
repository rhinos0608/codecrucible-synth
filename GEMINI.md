# GEMINI.md - CodeCrucible Synth

## Project Overview

This project, **CodeCrucible Synth**, is a sophisticated, local-first AI coding assistant built with Node.js and TypeScript. It operates as a command-line interface (CLI) tool, accessible via the commands `crucible`, `cc`, or `codecrucible`.

The core of CodeCrucible Synth is its unique **multi-voice AI synthesis system**. This system utilizes multiple AI "personalities," each with a specific area of expertise (e.g., security, architecture, design), to collaborate on code generation, analysis, and refactoring tasks. This approach aims to provide more comprehensive and well-rounded results than a single AI model.

The application is designed to be **local-first**, meaning that all AI processing happens on the user's machine, ensuring code privacy. It achieves this by integrating with local AI model providers like **Ollama** and **LM Studio**.

CodeCrucible Synth offers several interfaces:

*   **Enhanced CLI:** A rich terminal interface for direct interaction.
*   **Server Mode:** A REST API and WebSocket server for integration with IDEs and other tools.
*   **Desktop App:** An experimental Electron-based GUI.

The project is well-structured, with a clear separation of concerns. It uses modern TypeScript features, has a comprehensive set of dependencies managed by npm, and includes a suite of tests for quality assurance.

## Building and Running

The project's `package.json` file contains a rich set of scripts for managing the development lifecycle.

### Prerequisites

*   **Node.js:** Version 18.0.0 or higher.
*   **Local AI Models (Recommended):**
    *   **Ollama:** For high-quality reasoning and analysis.
    *   **LM Studio:** For fast response times.

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

### Running the CLI

```bash
# Run the CLI directly from the source
npm run dev

# Run the compiled CLI
npm start
```

### Running Tests

```bash
# Run all tests
npm test

# Run smoke tests
npm test:smoke
```

### Building for Production

```bash
# Create standalone binaries for Windows, macOS, and Linux
npm run package:all
```

## Development Conventions

The project follows standard TypeScript and Node.js development conventions.

*   **Linting:** ESLint is used with the recommended TypeScript configuration to enforce code quality and consistency. The configuration can be found in `.eslintrc.cjs`.
*   **Type Safety:** TypeScript is used throughout the project to ensure type safety. The TypeScript configuration is in `tsconfig.json`.
*   **Modularity:** The code is organized into modules with clear responsibilities, as seen in the `src` directory structure.
*   **Testing:** The project has a `tests` directory with unit and integration tests. Jest is the testing framework.
*   **Contributing:** A `CONTRIBUTING.md` file is mentioned in the `README.md`, which likely contains guidelines for contributing to the project.
