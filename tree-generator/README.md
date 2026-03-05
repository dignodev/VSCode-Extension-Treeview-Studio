# TreeView Studio 

<div align="left">

[![VS Code](https://img.shields.io/badge/VS%20Code-%235586A4?style=flat&logo=visual-studio-code)](https://code.visualstudio.com/) [![Version](https://img.shields.io/badge/Version-0.3.0-blue)](https://marketplace.visualstudio.com/) [![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
<!-- [![Installs](https://img.shields.io/visual-studio-marketplace/i/dignodev.treeview-studio)](https://marketplace.visualstudio.com/items?itemName=dignodev.treeview-studio)
[![Rating](https://img.shields.io/visual-studio-marketplace/rating/dignodev.treeview-studio)](https://marketplace.visualstudio.com/items?itemName=dignodev.treeview-studio) -->

</div>

<a href="https://www.buymeacoffee.com/dignodev" target="_blank"><img src="https://raw.githubusercontent.com/dignodev/VSCode-Extension-Tree/develop/UI/Media/Buymeacoffee-button.png" alt="Buy Me A Coffee" style="height: 48px !important;box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;-webkit-box-shadow: 0px 3px 2px 0px rgba(190, 190, 190, 0.5) !important;" ></a>


A Visual Studio Code extension that generates a beautiful directory tree visualization of your project. Perfect for documentation, sharing project structure, or understanding codebase organization.

## Screenshots

![TreeView Studio Screenshot](https://raw.githubusercontent.com/dignodev/VSCode-Extension-Tree/develop/UI/Screenshots/tree-generator-01-main.gif)

## Features

### Core Features
- **Directory Tree Generation** - Creates a visual tree structure of any folder in your project
- **Interactive WebView** - View your tree in a beautiful, interactive interface
- **Context Menu Integration** - Right-click on any folder to generate its tree
- **Configurable Depth** - Set the maximum depth for the tree visualization
- **Hidden Files Support** - Option to include hidden files (`.git`, `node_modules`, etc.)

### Version 0.3.0 Features


#### Multilingual Support
- 6 Languages: English, Spanish, French, German, Chinese, Japanese
- Auto-detects your VS Code language
- Switch languages via Command Palette

#### Enhanced UI/UX
- Real-time options panel (no regeneration needed)
- Search & filter files and folders
- Expand/Collapse all navigation
- Customizable fonts and sizes
- Collapsible entries by default

#### Export & Share
- Copy entire tree to clipboard
- Export to text file



## Usage

### Method 1: Context Menu
1. Right-click on any folder in the VS Code Explorer
2. Select **"Generate Directory Tree"**
3. Follow the prompts

### Method 2: Command Palette
1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "Generate Directory Tree"
3. Press Enter

## WebView Interface

The tree is displayed in an interactive WebView with:
- **Search Bar** - Filter files and folders in real-time
- **Options Panel** - Show/hide hidden files, adjust depth, toggle icons
- **Expand/Collapse All** - Navigate large trees easily
- **Copy & Export** - Copy to clipboard or save to file
- **Statistics** - Shows path, file count, line count, and size

## Supported File Types

The extension includes icons for 50+ file types:

| Category | Extensions |
|----------|------------|
| **Web** | `.html`, `.css`, `.scss`, `.sass`, `.less` |
| **JavaScript/TypeScript** | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` |
| **Frameworks** | React, Vue, Angular, Svelte, Next.js, Node.js |
| **Data** | `.json`, `.xml`, `.yaml`, `.yml`, `.toml`, `.ini` |
| **Documents** | `.md`, `.txt`, `.pdf` |
| **Images** | `.png`, `.jpg`, `.jpeg`, `.svg`, `.ico`, `.gif` |
| **Video/Audio** | `.mp4`, `.mp3`, `.wav`, `.ogg` |
| **Database** | `.sql`, `.db`, `.sqlite`, PostgreSQL, MongoDB |
| **DevOps** | Docker, Kubernetes, Terraform |
| **Programming** | Python, Java, C#, Ruby, Go, Rust, Swift, Kotlin, PHP |

## Configuration

Customize the extension via VS Code Settings:

```json
{
  "tree-generator.fontFamily": "Consolas, Monaco, Courier New, monospace",
  "tree-generator.fontSize": 13,
  "tree-generator.showIcons": true,
  "tree-generator.includeHidden": false,
  "tree-generator.maxDepth": 10,
  "tree-generator.collapseEntries": false
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `fontFamily` | string | Consolas, Monaco, Courier New | Font family for the tree |
| `fontSize` | number | 13 | Font size for the tree |
| `showIcons` | boolean | true | Show file type icons |
| `includeHidden` | boolean | false | Include hidden files |
| `maxDepth` | number | 10 | Maximum directory depth |
| `collapseEntries` | boolean | false | Start with folders collapsed |

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
│   └── favico.ico
├── package.json
├── tsconfig.json
└── README.md
```

## Requirements

- Visual Studio Code version 1.85.0 or higher
- Node.js 16.x or higher

## License

MIT License - see the [LICENSE](../LICENSE) file for details.

## Author

Created by **Digno Dev** with ❤️ for the VS Code community.

---

**Enjoy generating directory trees! 🌳**
