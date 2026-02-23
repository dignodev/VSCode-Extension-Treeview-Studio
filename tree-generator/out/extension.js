"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Función para obtener la configuración de fuente
function getFontConfig() {
    const config = vscode.workspace.getConfiguration('tree-generator');
    const fontFamily = config.get('fontFamily', 'Consolas, Monaco, Courier New, monospace');
    const fontSize = config.get('fontSize', 13);
    return { fontFamily, fontSize };
}
let donationShown = false;
function activate(context) {
    console.log('Tree Generator extension activada');
    // Registrar comando para donación
    context.subscriptions.push(vscode.commands.registerCommand('tree-generator.donate', () => {
        vscode.env.openExternal(vscode.Uri.parse('https://www.buymeacoffee.com/dignodev'));
    }));
    // Registrar comando principal
    let disposable = vscode.commands.registerCommand('tree-generator.generateTree', async (uri) => {
        try {
            // Obtener la ruta del directorio seleccionado
            let rootPath;
            if (uri && uri.fsPath) {
                const stat = fs.statSync(uri.fsPath);
                if (stat.isDirectory()) {
                    rootPath = uri.fsPath;
                }
                else {
                    rootPath = path.dirname(uri.fsPath);
                }
            }
            else {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    vscode.window.showErrorMessage('No hay ningún proyecto abierto');
                    return;
                }
                rootPath = workspaceFolders[0].uri.fsPath;
            }
            // Limpiar la ruta de posibles caracteres especiales
            rootPath = rootPath.replace(/\t/g, '').trim();
            // Preguntar al usuario si quiere incluir archivos ocultos
            const includeHidden = await vscode.window.showQuickPick(['Sí', 'No'], {
                placeHolder: '¿Incluir archivos ocultos (como .git, node_modules)?'
            });
            if (includeHidden === undefined)
                return;
            // Obtener profundidad máxima
            const maxDepth = await getMaxDepth();
            // Generar el árbol (por defecto con iconos)
            const treeData = await generateDirectoryTree(rootPath, {
                includeHidden: includeHidden === 'Sí',
                maxDepth: maxDepth,
                showIcons: true // Por defecto mostrar iconos
            });
            // Crear y mostrar el panel WebView
            const panel = vscode.window.createWebviewPanel('treeGenerator', `Árbol: ${path.basename(rootPath)}`, vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'resources', 'fonts')
                ]
            });
            // Obtener las URIs de las fuentes para el webview
            const fontUris = {
                robotoBold: panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources', 'fonts', 'Roboto-Bold.ttf')),
                robotoRegular: panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources', 'fonts', 'Roboto-Regular.ttf')),
                ubuntuMono: panel.webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'resources', 'fonts', 'UbuntuMono-Regular.ttf'))
            };
            // Enviar los datos al WebView
            panel.webview.html = getWebviewContent(rootPath, treeData, includeHidden === 'Sí', true, panel, context, fontUris);
            // Manejar mensajes del WebView
            panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'refresh':
                        // Asegurarnos de que los valores booleanos se manejen correctamente
                        const newIncludeHidden = message.includeHidden === true || message.includeHidden === 'true';
                        const newMaxDepth = message.maxDepth ? parseInt(message.maxDepth) : undefined;
                        const newShowIcons = message.showIcons === true || message.showIcons === 'true';
                        // Limpiar la ruta
                        const cleanRootPath = message.rootPath.replace(/\t/g, '').trim();
                        vscode.window.showInformationMessage(`Regenerando árbol...`);
                        const newTreeData = await generateDirectoryTree(cleanRootPath, {
                            includeHidden: newIncludeHidden,
                            maxDepth: newMaxDepth,
                            showIcons: newShowIcons
                        });
                        panel.webview.postMessage({
                            command: 'updateTree',
                            treeData: newTreeData,
                            includeHidden: newIncludeHidden,
                            showIcons: newShowIcons
                        });
                        break;
                    case 'copy':
                        await vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Árbol copiado al portapapeles');
                        break;
                    case 'export':
                        const uri = await vscode.window.showSaveDialog({
                            filters: { 'Text files': ['txt'] },
                            defaultUri: vscode.Uri.file(path.join(rootPath, 'arbol.txt'))
                        });
                        if (uri) {
                            fs.writeFileSync(uri.fsPath, message.text);
                            vscode.window.showInformationMessage(`Árbol guardado en ${uri.fsPath}`);
                        }
                        break;
                    case 'copySelection':
                        await vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Selección copiada al portapapeles');
                        break;
                    case 'donate':
                        vscode.commands.executeCommand('tree-generator.donate');
                        break;
                }
            }, undefined, context.subscriptions);
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error al generar el árbol: ${error}`);
        }
    });
    context.subscriptions.push(disposable);
    // Mostrar mensaje de donación
    setTimeout(() => {
        if (!context.globalState.get('donationShown') && !donationShown) {
            vscode.window.showInformationMessage('¿Disfrutando Tree Generator? Si quieres apoyar el desarrollo, considera invitarme a un café ☕', 'Apoyar ahora', 'Más tarde').then(selection => {
                if (selection === 'Apoyar ahora') {
                    vscode.commands.executeCommand('tree-generator.donate');
                }
                context.globalState.update('donationShown', true);
                donationShown = true;
            });
        }
    }, 60000);
}
function deactivate() { }
async function getMaxDepth() {
    const input = await vscode.window.showInputBox({
        prompt: 'Profundidad máxima (dejar vacío para sin límite)',
        placeHolder: 'Ejemplo: 3',
        validateInput: (value) => {
            if (value && isNaN(parseInt(value))) {
                return 'Por favor, ingresa un número válido';
            }
            return null;
        }
    });
    return input ? parseInt(input) : undefined;
}
// Función para generar el árbol visual con formato adecuado
function generateVisualTree(rootPath, options) {
    const rootName = path.basename(rootPath);
    const rootIcon = options.showIcons ? '📁 ' : '';
    let treeOutput = `${rootIcon}${rootName}/\n`;
    function processDirectory(dirPath, prefix = '', depth = 0) {
        if (options.maxDepth && depth >= options.maxDepth) {
            return '';
        }
        let dirOutput = '';
        try {
            const items = fs.readdirSync(dirPath);
            // Filtrar items
            let filteredItems = items.filter(item => {
                if (!options.includeHidden) {
                    if (item.startsWith('.') || item === 'node_modules' || item === '.git') {
                        return false;
                    }
                }
                return true;
            });
            // Obtener estadísticas para ordenar
            const itemsWithStats = filteredItems.map(item => {
                const itemPath = path.join(dirPath, item);
                try {
                    const stat = fs.statSync(itemPath);
                    return {
                        name: item,
                        path: itemPath,
                        isDirectory: stat.isDirectory()
                    };
                }
                catch {
                    return {
                        name: item,
                        path: itemPath,
                        isDirectory: false
                    };
                }
            });
            // Ordenar: directorios primero
            itemsWithStats.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory)
                    return -1;
                if (!a.isDirectory && b.isDirectory)
                    return 1;
                return a.name.localeCompare(b.name);
            });
            for (let i = 0; i < itemsWithStats.length; i++) {
                const item = itemsWithStats[i];
                const isLast = i === itemsWithStats.length - 1;
                const connector = isLast ? '└── ' : '├── ';
                if (item.isDirectory) {
                    const dirIcon = options.showIcons ? '📁 ' : '';
                    dirOutput += `${prefix}${connector}${dirIcon}${item.name}/\n`;
                    const newPrefix = prefix + (isLast ? '    ' : '│   ');
                    dirOutput += processDirectory(item.path, newPrefix, depth + 1);
                }
                else {
                    const icon = options.showIcons ? getFileIcon(item.name) + ' ' : '';
                    dirOutput += `${prefix}${connector}${icon}${item.name}\n`;
                }
            }
        }
        catch (error) {
            dirOutput += `${prefix}Error: ${error}\n`;
        }
        return dirOutput;
    }
    treeOutput += processDirectory(rootPath, '', 1);
    return treeOutput;
}
// Función para generar el árbol HTML con estructura colapsable
function generateCollapsibleHTML(rootPath, options, fontConfig) {
    const rootName = path.basename(rootPath);
    const rootIcon = options.showIcons ? '📁 ' : '';
    function processDirectory(dirPath, depth = 0, prefix = '', isLast = true) {
        if (options.maxDepth && depth >= options.maxDepth) {
            return '';
        }
        let html = '';
        try {
            const items = fs.readdirSync(dirPath);
            // Filtrar items
            let filteredItems = items.filter(item => {
                if (!options.includeHidden) {
                    if (item.startsWith('.') || item === 'node_modules' || item === '.git') {
                        return false;
                    }
                }
                return true;
            });
            // Obtener estadísticas para ordenar
            const itemsWithStats = filteredItems.map(item => {
                const itemPath = path.join(dirPath, item);
                try {
                    const stat = fs.statSync(itemPath);
                    return {
                        name: item,
                        path: itemPath,
                        isDirectory: stat.isDirectory()
                    };
                }
                catch {
                    return {
                        name: item,
                        path: itemPath,
                        isDirectory: false
                    };
                }
            });
            // Ordenar: directorios primero
            itemsWithStats.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory)
                    return -1;
                if (!a.isDirectory && b.isDirectory)
                    return 1;
                return a.name.localeCompare(b.name);
            });
            for (let i = 0; i < itemsWithStats.length; i++) {
                const item = itemsWithStats[i];
                const isLastItem = i === itemsWithStats.length - 1;
                const connector = isLastItem ? '└── ' : '├── ';
                const itemId = `item-${depth}-${i}`;
                // Crear el prefijo visual para mantener la estructura del árbol
                let visualPrefix = prefix;
                if (item.isDirectory) {
                    const dirIcon = options.showIcons ? '📁 ' : '';
                    const folderId = `folder-${itemId}`;
                    const contentId = `content-${itemId}`;
                    // Determinar el prefijo para el contenido de la carpeta
                    const contentPrefix = prefix + (isLastItem ? '    ' : '│   ');
                    html += `
                        <div class="tree-item folder" data-depth="${depth}" data-path="${item.path}">
                            <div class="tree-line folder-header" onclick="toggleFolder('${contentId}', this)" data-fullpath="${item.path}">
                                <span class="prefix">${visualPrefix}</span>
                                <span class="connector">${connector}</span>
                                <span class="folder-icon ${options.showIcons ? 'visible' : 'hidden'}">${dirIcon}</span>
                                <span class="folder-name">${item.name}/</span>
                                <span class="toggle-icon">▼</span>
                            </div>
                            <div class="folder-content" id="${contentId}">
                                ${processDirectory(item.path, depth + 1, contentPrefix, isLastItem)}
                            </div>
                        </div>
                    `;
                }
                else {
                    const icon = options.showIcons ? getFileIcon(item.name) + ' ' : '';
                    html += `
                        <div class="tree-item file" data-depth="${depth}" data-path="${item.path}">
                            <div class="tree-line" data-fullpath="${item.path}">
                                <span class="prefix">${visualPrefix}</span>
                                <span class="connector">${connector}</span>
                                <span class="file-icon ${options.showIcons ? 'visible' : 'hidden'}">${icon}</span>
                                <span class="file-name">${item.name}</span>
                            </div>
                        </div>
                    `;
                }
            }
        }
        catch (error) {
            html += `<div class="tree-item error">Error: ${error}</div>`;
        }
        return html;
    }
    return `
        <div class="collapsible-tree" style="font-family: 'UbuntuMono', 'RobotoRegular', '${fontConfig.fontFamily}', monospace; font-size: ${fontConfig.fontSize}px;">
            <div class="tree-item root folder">
                <div class="tree-line folder-header" onclick="toggleFolder('root-content', this)">
                    <span class="root-icon ${options.showIcons ? 'visible' : 'hidden'}">${rootIcon}</span>
                    <span class="root-name">${rootName}/</span>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="folder-content" id="root-content">
                    ${processDirectory(rootPath, 1, '', true)}
                </div>
            </div>
        </div>
    `;
}
// Función para calcular el tamaño total del directorio
function calculateDirectorySize(rootPath, includeHidden) {
    let totalSize = 0;
    function processDirectory(dirPath, depth = 0) {
        if (depth > 20)
            return; // Evitar recursion excesiva
        try {
            const items = fs.readdirSync(dirPath);
            for (const item of items) {
                if (!includeHidden && (item.startsWith('.') || item === 'node_modules' || item === '.git')) {
                    continue;
                }
                const itemPath = path.join(dirPath, item);
                try {
                    const stat = fs.statSync(itemPath);
                    if (stat.isDirectory()) {
                        processDirectory(itemPath, depth + 1);
                    }
                    else {
                        totalSize += stat.size;
                    }
                }
                catch {
                    // Ignorar errores de acceso
                }
            }
        }
        catch {
            // Ignorar errores de lectura
        }
    }
    processDirectory(rootPath, 0);
    return totalSize;
}
// Función para formatear tamaño en bytes
function formatSize(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
async function generateDirectoryTree(rootPath, options) {
    // Obtener configuración de fuente
    const fontConfig = getFontConfig();
    // Generar el árbol visual con formato
    const visualTree = generateVisualTree(rootPath, options);
    // Generar árbol HTML colapsable
    const collapsibleHtml = generateCollapsibleHTML(rootPath, options, fontConfig);
    // Calcular el tamaño del directorio
    const directorySize = calculateDirectorySize(rootPath, options.includeHidden);
    const formattedSize = formatSize(directorySize);
    return {
        text: visualTree,
        html: collapsibleHtml,
        size: formattedSize
    };
}
function getFileIcon(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName).toLowerCase();
    const iconMap = {
        '.ts': '🔷',
        '.tsx': '⚛️',
        '.js': '🟨',
        '.jsx': '⚛️',
        '.mjs': '🟨',
        '.cjs': '🟨',
        '.html': '🌐',
        '.htm': '🌐',
        '.css': '🎨',
        '.scss': '🎨',
        '.sass': '🎨',
        '.less': '🎨',
        '.json': '📋',
        '.xml': '📰',
        '.yaml': '📐',
        '.yml': '📐',
        '.md': '📝',
        '.txt': '📄',
        '.pdf': '📕',
        '.png': '🖼️',
        '.jpg': '🖼️',
        '.jpeg': '🖼️',
        '.gif': '🖼️',
        '.svg': '🖼️',
        '.ico': '🖼️',
        '.webp': '🖼️',
        '.py': '🐍',
        '.java': '☕',
        '.c': '📘',
        '.cpp': '📗',
        '.h': '📑',
        '.hpp': '📑',
        '.cs': '🎯',
        '.go': '🐹',
        '.rs': '🦀',
        '.rb': '💎',
        '.php': '🐘',
        '.swift': '🐦',
        '.kt': '🟣',
        '.scala': '🔴',
        '.lock': '🔒',
        '.vsix': '📦',
        '.env': '⚙️',
        '.gitignore': '🔀',
        '.sql': '🗄️',
        '.db': '🗄️',
        '.sqlite': '🗄️',
        '.zip': '🗜️',
        '.tar': '🗜️',
        '.gz': '🗜️',
        '.log': '📋',
        '.sh': '💻',
        '.bat': '💻',
        '.ps1': '💻',
        '.map': '🗺️'
    };
    if (baseName === 'dockerfile')
        return '🐳';
    if (baseName === 'makefile')
        return '⚙️';
    if (baseName === '.gitignore')
        return '🔀';
    if (baseName === '.env')
        return '⚙️';
    if (baseName === 'package.json')
        return '📦';
    if (baseName === 'package-lock.json')
        return '🔒';
    if (baseName === 'tsconfig.json')
        return '⚙️';
    return iconMap[ext] || '📄';
}
function getWebviewContent(rootPath, treeData, includeHidden, showIcons, panel, context, fontUris) {
    const escapedRootPath = rootPath.replace(/\\/g, '\\\\');
    const fontConfig = getFontConfig();
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tree Generator</title>
    <style>
        @font-face {
            font-family: 'RobotoBold';
            src: url('${fontUris.robotoBold}') format('truetype');
            font-weight: bold;
            font-style: normal;
            font-display: swap;
        }
        
        @font-face {
            font-family: 'RobotoRegular';
            src: url('${fontUris.robotoRegular}') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }
        
        @font-face {
            font-family: 'UbuntuMono';
            src: url('${fontUris.ubuntuMono}') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }
        
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            margin: 0;
        }
        
        .container {
            max-width: 100%;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .title {
            font-size: 1.2em;
            font-weight: bold;
            font-family: 'RobotoBold', var(--vscode-font-family);
        }
        
        .controls {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        
        .controls button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            transition: all 0.2s ease;
            font-family: 'RobotoRegular', var(--vscode-font-family);
        }
        
        .controls button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .controls button.active {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            outline: 2px solid var(--vscode-focusBorder);
        }
        
        .options-panel {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            margin-bottom: 20px;
            border-radius: 4px;
            display: none;
        }
        
        .options-panel.visible {
            display: block;
        }
        
        .option-group {
            display: flex;
            align-items: center;
            gap: 15px;
            flex-wrap: wrap;
        }
        
        .option-group label {
            display: flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
        }
        
        .option-group input[type="checkbox"] {
            margin: 0;
            width: 16px;
            height: 16px;
            cursor: pointer;
        }
        
        .option-group input[type="number"] {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 4px 8px;
            border-radius: 2px;
            width: 100px;
        }
        
        .option-group button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 4px;
        }
        
        .tree-container {
            background-color: var(--vscode-editor-background);
            padding: 15px;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
            overflow-x: auto;
            font-family: 'UbuntuMono', 'RobotoRegular', '${fontConfig.fontFamily}', monospace;
            font-size: ${fontConfig.fontSize}px;
            line-height: 1.5;
            user-select: text;
            -webkit-user-select: text;
            cursor: text;
        }
        
        /* Estilos para el árbol colapsable */
        .collapsible-tree {
            user-select: text;
            -webkit-user-select: text;
        }
        
        .tree-item {
            margin: 0;
            padding: 0;
        }
        
        .tree-line {
            display: flex;
            align-items: center;
            padding: 2px 4px;
            border-radius: 3px;
            white-space: nowrap;
            line-height: 1.5;
            user-select: text;
            -webkit-user-select: text;
        }
        
        .folder > .tree-line {
            cursor: pointer;
        }
        
        .folder > .tree-line:hover {
            background-color: var(--vscode-list-hoverBackground);
        }
        
        /* Permitir selección de texto */
        .tree-line span {
            user-select: text;
            -webkit-user-select: text;
        }
        
        .prefix {
            display: inline-block;
            white-space: pre;
            font-family: inherit;
            color: var(--vscode-descriptionForeground);
            opacity: 0.5;
            user-select: text;
            -webkit-user-select: text;
        }
        
        .connector {
            display: inline-block;
            width: 20px;
            color: var(--vscode-descriptionForeground);
            opacity: 0.7;
            user-select: text;
            -webkit-user-select: text;
        }
        
        .folder-icon, .file-icon, .root-icon {
            display: inline-block;
            width: 20px;
            text-align: center;
            margin-right: 4px;
            user-select: text;
            -webkit-user-select: text;
        }
        
        .folder-icon.visible, .file-icon.visible, .root-icon.visible {
            opacity: 1;
        }
        
        .folder-icon.hidden, .file-icon.hidden, .root-icon.hidden {
            display: none;
        }
        
        .folder-name, .file-name, .root-name {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            user-select: text;
            -webkit-user-select: text;
        }
        
        .toggle-icon {
            display: inline-block;
            width: 16px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 10px;
            transition: transform 0.2s ease;
            pointer-events: none;
        }
        
        .folder-content {
            margin-left: 0;
            padding-left: 0;
            display: block;
        }
        
        .folder-content.collapsed {
            display: none;
        }
        
        .folder-header .toggle-icon {
            transform: rotate(0deg);
        }
        
        .folder-header.collapsed .toggle-icon {
            transform: rotate(-90deg);
        }
        
        .stats {
            margin-top: 15px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            word-break: break-all;
            font-family: 'RobotoRegular', var(--vscode-font-family);
        }
        
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 8px;
        }
        
        .stat-item {
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        .stat-label {
            font-weight: bold;
            color: var(--vscode-descriptionForeground);
        }
        
        .footer {
            margin-top: 20px;
            padding-top: 10px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            text-align: center;
            font-family: 'RobotoRegular', var(--vscode-font-family);
        }
        
        .footer a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
        
        .loading {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid var(--vscode-button-background);
            border-radius: 50%;
            border-top-color: transparent;
            animation: spin 1s linear infinite;
            margin-right: 8px;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .status-message {
            display: flex;
            align-items: center;
            margin: 10px 0;
            padding: 10px;
            background-color: var(--vscode-infoBackground);
            color: var(--vscode-infoForeground);
            border-radius: 4px;
            font-family: 'RobotoRegular', var(--vscode-font-family);
        }
        
        pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
        
        /* Estilo para la selección */
        ::selection {
            background-color: var(--vscode-editor-selectionBackground);
            color: var(--vscode-editor-selectionForeground);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">Árbol de Directorios: ${path.basename(rootPath)}</div>
            <div class="controls">
                <button onclick="toggleOptions()" title="Mostrar/ocultar opciones">Opciones</button>
                <button onclick="toggleIcons()" id="toggleIconsBtn" class="${showIcons ? 'active' : ''}" title="${showIcons ? 'Ocultar iconos' : 'Mostrar iconos'}">
                    ${showIcons ? 'Ocultar iconos' : 'Mostrar iconos'}
                </button>
                <button onclick="expandAll()" title="Expandir todas las carpetas">Expandir todo</button>
                <button onclick="collapseAll()" title="Colapsar todas las carpetas">Colapsar todo</button>
                <button onclick="copyVisibleTree()" title="Copiar el árbol visible (con estado actual)">Copiar árbol visible</button>
                <button onclick="copySelection()" title="Copiar la selección actual">Copiar selección</button>
                <button onclick="exportToFile()" title="Exportar a archivo">Exportar</button>
            </div>
        </div>
        
        <div class="options-panel" id="optionsPanel">
            <div class="option-group">
                <label>
                    <input type="checkbox" id="includeHidden" ${includeHidden ? 'checked' : ''}> 
                    Incluir archivos ocultos
                </label>
                
                <label>
                    Profundidad máxima:
                    <input type="number" id="maxDepth" min="1" placeholder="Sin límite" value="">
                </label>
                
                <button onclick="applyOptions()">Aplicar cambios</button>
                <button onclick="resetOptions()">Restablecer</button>
            </div>
        </div>
        
        <div class="status-message" id="statusMessage" style="display: none;">
            <span class="loading"></span>
            <span id="statusText">Regenerando árbol...</span>
        </div>
        
        <div class="tree-container" id="treeContainer">
            ${treeData.html}
        </div>
        
        <div class="stats">
            <div class="stats-grid">
                <div class="stat-item">
                    <span class="stat-label">Ruta:</span>
                    <span title="${rootPath}">${rootPath.length > 50 ? rootPath.substring(0, 47) + '...' : rootPath}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Archivos ocultos:</span>
                    <span id="hiddenStatus">${includeHidden ? 'Incluidos' : 'Excluidos'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Iconos:</span>
                    <span id="iconsStatus">${showIcons ? 'Mostrando' : 'Ocultos'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Líneas:</span>
                    <span>${(treeData.text.match(/\n/g) || []).length}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Tamaño:</span>
                    <span>${treeData.size}</span>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <span>¿Te gusta esta extensión? </span>
            <a href="#" onclick="donate()">☕ Invítame un café</a>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        let currentTreeData = ${JSON.stringify(treeData)};
        let currentRootPath = "${escapedRootPath}";
        let currentIncludeHidden = ${includeHidden};
        let currentShowIcons = ${showIcons};
        
        function toggleOptions() {
            document.getElementById('optionsPanel').classList.toggle('visible');
        }
        
        function toggleIcons() {
            // Cambiar el estado local
            currentShowIcons = !currentShowIcons;
            
            // Actualizar el botón inmediatamente para feedback visual
            updateIconsButton();
            
            // Aplicar el cambio
            applyOptions();
        }
        
        function updateIconsButton() {
            const btn = document.getElementById('toggleIconsBtn');
            btn.className = currentShowIcons ? 'active' : '';
            btn.title = currentShowIcons ? 'Ocultar iconos' : 'Mostrar iconos';
            btn.innerHTML = currentShowIcons ? 'Ocultar iconos' : 'Mostrar iconos';
        }
        
        function updateHiddenCheckbox() {
            document.getElementById('includeHidden').checked = currentIncludeHidden;
        }
        
        // Función para generar texto del árbol basado en el estado actual del DOM
        function generateTreeTextFromDOM() {
            const rootElement = document.querySelector('.collapsible-tree');
            if (!rootElement) return '';
            
            let result = '';
            
            function processElement(element, prefix = '', isLast = true) {
                // Obtener el tipo de elemento
                const isFolder = element.classList.contains('folder');
                const isFile = element.classList.contains('file');
                const isRoot = element.classList.contains('root');
                
                if (isRoot) {
                    const rootName = element.querySelector('.root-name')?.textContent || '';
                    const rootIcon = currentShowIcons ? '📁 ' : '';
                    result += rootIcon + rootName + '\\n';
                    
                    // Procesar contenido de la raíz
                    const rootContent = element.querySelector('.folder-content');
                    if (rootContent) {
                        const children = Array.from(rootContent.children);
                        children.forEach((child, index) => {
                            const isLastChild = index === children.length - 1;
                            processElement(child, '', isLastChild);
                        });
                    }
                } else if (isFolder) {
                    // Verificar si la carpeta está colapsada
                    const folderContent = element.querySelector('.folder-content');
                    const isCollapsed = folderContent?.classList.contains('collapsed');
                    
                    // Obtener el texto de la línea
                    const treeLine = element.querySelector('.tree-line');
                    if (treeLine) {
                        const prefixSpan = treeLine.querySelector('.prefix')?.textContent || '';
                        const connector = treeLine.querySelector('.connector')?.textContent || '';
                        const icon = treeLine.querySelector('.folder-icon')?.textContent || '';
                        const name = treeLine.querySelector('.folder-name')?.textContent || '';
                        
                        result += prefixSpan + connector + icon + name + '\\n';
                    }
                    
                    // Si no está colapsada, procesar el contenido
                    if (!isCollapsed && folderContent) {
                        const children = Array.from(folderContent.children);
                        children.forEach((child, index) => {
                            const isLastChild = index === children.length - 1;
                            processElement(child, '', isLastChild);
                        });
                    }
                } else if (isFile) {
                    const treeLine = element.querySelector('.tree-line');
                    if (treeLine) {
                        const prefixSpan = treeLine.querySelector('.prefix')?.textContent || '';
                        const connector = treeLine.querySelector('.connector')?.textContent || '';
                        const icon = treeLine.querySelector('.file-icon')?.textContent || '';
                        const name = treeLine.querySelector('.file-name')?.textContent || '';
                        
                        result += prefixSpan + connector + icon + name + '\\n';
                    }
                }
            }
            
            processElement(rootElement);
            return result;
        }
        
        // Función para copiar el árbol visible (con estado actual)
        function copyVisibleTree() {
            const treeText = generateTreeTextFromDOM();
            vscode.postMessage({
                command: 'copy',
                text: treeText
            });
        }
        
        // Función para copiar la selección actual
        function copySelection() {
            const selection = window.getSelection().toString();
            if (selection) {
                vscode.postMessage({
                    command: 'copySelection',
                    text: selection
                });
            } else {
                vscode.window.showInformationMessage('No hay texto seleccionado');
            }
        }
        
        function copyToClipboard() {
            copyVisibleTree();
        }
        
        function exportToFile() {
            const treeText = generateTreeTextFromDOM();
            vscode.postMessage({
                command: 'export',
                text: treeText
            });
        }
        
        function donate() {
            vscode.postMessage({ command: 'donate' });
        }
        
        function showLoading(show) {
            const statusMsg = document.getElementById('statusMessage');
            statusMsg.style.display = show ? 'flex' : 'none';
        }
        
        function resetOptions() {
            // Restablecer a valores por defecto
            currentIncludeHidden = false;
            currentShowIcons = true;
            
            // Actualizar UI
            updateIconsButton();
            updateHiddenCheckbox();
            document.getElementById('maxDepth').value = '';
            
            // Aplicar cambios
            applyOptions();
        }
        
        function applyOptions() {
            // Obtener valores actuales del DOM
            const includeHidden = document.getElementById('includeHidden').checked;
            const maxDepth = document.getElementById('maxDepth').value;
            
            // Actualizar variables locales
            currentIncludeHidden = includeHidden;
            
            // Mostrar indicador de carga
            showLoading(true);
            
            // Enviar mensaje a la extensión
            vscode.postMessage({
                command: 'refresh',
                rootPath: currentRootPath,
                includeHidden: includeHidden,
                maxDepth: maxDepth || undefined,
                showIcons: currentShowIcons
            });
        }
        
        // Función para colapsar/expandir carpetas
        function toggleFolder(contentId, element) {
            const content = document.getElementById(contentId);
            if (content) {
                content.classList.toggle('collapsed');
                element.classList.toggle('collapsed');
            }
        }
        
        // Función para expandir todas las carpetas
        function expandAll() {
            const contents = document.querySelectorAll('.folder-content');
            const headers = document.querySelectorAll('.folder-header');
            
            contents.forEach(content => {
                content.classList.remove('collapsed');
            });
            
            headers.forEach(header => {
                header.classList.remove('collapsed');
            });
        }
        
        // Función para colapsar todas las carpetas
        function collapseAll() {
            const contents = document.querySelectorAll('.folder-content');
            const headers = document.querySelectorAll('.folder-header');
            
            contents.forEach(content => {
                content.classList.add('collapsed');
            });
            
            headers.forEach(header => {
                header.classList.add('collapsed');
            });
        }
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateTree') {
                // Actualizar datos locales
                currentTreeData = message.treeData;
                currentIncludeHidden = message.includeHidden;
                currentShowIcons = message.showIcons;
                
                // Actualizar el contenido del árbol
                document.getElementById('treeContainer').innerHTML = message.treeData.html;
                
                // Actualizar checkbox y botón de iconos
                document.getElementById('includeHidden').checked = currentIncludeHidden;
                updateIconsButton();
                
                // Actualizar estadísticas
                document.getElementById('hiddenStatus').textContent = currentIncludeHidden ? 'Incluidos' : 'Excluidos';
                document.getElementById('iconsStatus').textContent = currentShowIcons ? 'Mostrando' : 'Ocultos';
                
                // Ocultar indicador de carga
                showLoading(false);
            }
        });
        
        // Permitir copiar con Ctrl+C
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'c') {
                const selection = window.getSelection().toString();
                if (selection) {
                    // Si hay selección, copiar la selección
                    e.preventDefault();
                    copySelection();
                }
            }
        });
        
        // Inicializar valores
        document.addEventListener('DOMContentLoaded', function() {
            updateIconsButton();
        });
    </script>
</body>
</html>`;
}
//# sourceMappingURL=extension.js.map