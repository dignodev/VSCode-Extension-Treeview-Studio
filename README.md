# VSCode Tree Generator

[![VS Code](https://img.shields.io/badge/VS%20Code-%235586A4?style=flat&logo=visual-studio-code)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/Version-0.0.1-blue)](https://marketplace.visualstudio.com/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%23339933?style=flat&logo=node.js)](https://nodejs.org/)

A Visual Studio Code extension that generates a directory tree visualization of your project. Perfect for documentation, sharing project structure, or understanding codebase organization.

## Features

- **Directory Tree Generation**: Creates a visual tree structure of any folder in your project
- **Interactive Prompts**: Ask whether to include hidden files (`.git`, `node_modules`, etc.)
- **Configurable Depth**: Set the maximum depth for the tree visualization
- **Context Menu Integration**: Right-click on any folder in the Explorer to generate its tree
- **Workspace Support**: Works with the entire workspace if no folder is selected
- **Visual Tree Format**: Uses standard tree notation (`├──`, `└──`, `│`) for clear visualization

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/VSCode-Tree-Github.git
   cd VSCode-Tree-Github/tree-generator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Compile TypeScript:
   ```bash
   npm run compile
   ```

### Package and Install (.vsix)

To create and install the extension package:

1. Install the VS Code packaging tool (if not already installed):
   ```bash
   npm install -g vsce
   ```

2. Package the extension:
   ```bash
   cd tree-generator
   vsce package
   ```

3. Install the generated `.vsix` file:
   - Open VS Code
   - Go to Extensions (`Ctrl+Shift+X` or `Cmd+Shift+X` on Mac)
   - Click the `...` menu in the top right
   - Select "Install from VSIX..."
   - Navigate to `tree-generator/tree-generator-0.0.1.vsix`

### Alternative Installation

You can also install directly from the command line:
```bash
code --install-extension tree-generator/tree-generator-0.0.1.vsx
```

## Usage

### Method 1: Context Menu

1. Right-click on any folder in the VS Code Explorer
2. Select **"Generar Árbol de Directorios"** from the context menu
3. Follow the prompts:
   - Choose whether to include hidden files (Sí/No)
   - Enter the maximum depth (leave empty for unlimited)

### Method 2: Command Palette

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Generar Árbol de Directorios"
3. Press Enter
4. Follow the same prompts as above

### Method 3: Workspace Root

If no folder is selected, the extension will generate a tree of the entire workspace.

## Example Output

```
mi-proyecto/
├── src/
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── Sidebar/
│   │       ├── Menu.tsx
│   │       └── Navbar.tsx
│   ├── styles/
│   │   ├── main.css
│   │   └── variables.css
│   └── index.ts
├── public/
│   ├── index.html
│   └── favicon.ico
├── package.json
├── tsconfig.json
└── README.md
```

## Requirements

- Visual Studio Code version 1.85.0 or higher
- Node.js 16.x or higher

## Development

### Setup Development Environment

```bash
cd tree-generator
npm install
```

### Run in Development Mode

1. Press `F5` in VS Code
2. A new VS Code window will open with the extension loaded
3. Test the extension by right-clicking on a folder

### Build for Production

```bash
npm run vscode:prepublish
```

## Project Structure

```
VSCode-Tree-Github/
├── tree-generator/
│   ├── src/
│   │   └── extension.ts      # Main extension source code
│   ├── out/                  # Compiled JavaScript
│   ├── package.json          # Extension manifest
│   └── tsconfig.json         # TypeScript configuration
├── LICENSE                   # MIT License
└── README.md                # This file
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Created with ❤️ for the VS Code community.

---

**Enjoy generating directory trees! 🌳**
