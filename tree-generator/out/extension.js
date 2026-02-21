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
            // Preguntar al usuario si quiere incluir archivos ocultos
            const includeHidden = await vscode.window.showQuickPick(['Sí', 'No'], {
                placeHolder: '¿Incluir archivos ocultos (como .git, node_modules)?'
            });
            // Obtener profundidad máxima
            const maxDepth = await getMaxDepth();
            // Generar el árbol
            const treeData = await generateDirectoryTree(rootPath, {
                includeHidden: includeHidden === 'Sí',
                maxDepth: maxDepth
            });
            // Crear y mostrar el panel WebView
            const panel = vscode.window.createWebviewPanel('treeGenerator', `Árbol: ${path.basename(rootPath)}`, vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
            });
            // Enviar los datos al WebView
            panel.webview.html = getWebviewContent(panel.webview, context.extensionPath, rootPath, treeData);
            // Manejar mensajes del WebView
            panel.webview.onDidReceiveMessage(async (message) => {
                switch (message.command) {
                    case 'refresh':
                        // Regenerar el árbol con nuevas opciones
                        const newIncludeHidden = message.includeHidden === 'true';
                        const newTreeData = await generateDirectoryTree(message.rootPath, {
                            includeHidden: newIncludeHidden,
                            maxDepth: message.maxDepth ? parseInt(message.maxDepth) : undefined
                        });
                        panel.webview.postMessage({
                            command: 'updateTree',
                            treeData: newTreeData
                        });
                        break;
                    case 'copy':
                        // Copiar al portapapeles
                        await vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Árbol copiado al portapapeles');
                        break;
                    case 'export':
                        // Exportar a archivo
                        const uri = await vscode.window.showSaveDialog({
                            filters: { 'Text files': ['txt'] },
                            defaultUri: vscode.Uri.file(path.join(rootPath, 'arbol.txt'))
                        });
                        if (uri) {
                            fs.writeFileSync(uri.fsPath, message.text);
                            vscode.window.showInformationMessage(`Árbol guardado en ${uri.fsPath}`);
                        }
                        break;
                }
            }, undefined, context.subscriptions);
            vscode.window.showInformationMessage('Árbol de directorios generado correctamente');
        }
        catch (error) {
            vscode.window.showErrorMessage(`Error al generar el árbol: ${error}`);
        }
    });
    context.subscriptions.push(disposable);
    // Mostrar mensaje de donación después de 1 minuto (solo una vez)
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
    }, 60000); // 1 minuto
}
function deactivate() { }
// Función para obtener la profundidad máxima
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
// Función principal para generar el árbol
async function generateDirectoryTree(rootPath, options) {
    const rootName = path.basename(rootPath);
    let textTree = `${rootName}/\n`;
    let htmlTree = `<div class="tree-root">${rootName}/</div><div class="tree-children">`;
    try {
        const items = await fs.promises.readdir(rootPath);
        const filteredItems = items.filter(item => {
            if (!options.includeHidden && (item.startsWith('.') || item === 'node_modules')) {
                return false;
            }
            return true;
        });
        for (let i = 0; i < filteredItems.length; i++) {
            const item = filteredItems[i];
            const itemPath = path.join(rootPath, item);
            const isLast = i === filteredItems.length - 1;
            try {
                const stat = await fs.promises.stat(itemPath);
                if (stat.isDirectory()) {
                    const result = await processDirectory(itemPath, item, isLast, options, 1);
                    textTree += result.text;
                    htmlTree += result.html;
                }
                else {
                    textTree += processFile(item, isLast);
                    htmlTree += processFileHtml(item, isLast, false);
                }
            }
            catch (error) {
                textTree += `${isLast ? '└── ' : '├── '}${item} (error al acceder)\n`;
                htmlTree += processFileHtml(item, isLast, true);
            }
        }
    }
    catch (error) {
        textTree += `Error al leer el directorio: ${error}\n`;
        htmlTree += `<div class="tree-item error">Error al leer el directorio: ${error}</div>`;
    }
    htmlTree += '</div>';
    return { text: textTree, html: htmlTree };
}
// Procesar un directorio recursivamente
async function processDirectory(dirPath, dirName, isLast, options, depth) {
    const prefix = isLast ? '└── ' : '├── ';
    let textResult = `${prefix}${dirName}/\n`;
    let htmlResult = `<div class="tree-folder"><span class="folder-icon">📁</span> ${dirName}/</div><div class="tree-children">`;
    if (options.maxDepth && depth >= options.maxDepth) {
        htmlResult += '</div>';
        return { text: textResult, html: htmlResult };
    }
    try {
        const items = await fs.promises.readdir(dirPath);
        const filteredItems = items.filter(item => {
            if (!options.includeHidden && (item.startsWith('.') || item === 'node_modules')) {
                return false;
            }
            return true;
        });
        for (let i = 0; i < filteredItems.length; i++) {
            const item = filteredItems[i];
            const itemPath = path.join(dirPath, item);
            const itemIsLast = i === filteredItems.length - 1;
            const newPrefix = isLast ? '    ' : '│   ';
            try {
                const stat = await fs.promises.stat(itemPath);
                if (stat.isDirectory()) {
                    const subDirResult = await processDirectory(itemPath, item, itemIsLast, options, depth + 1);
                    const subDirLines = subDirResult.text.split('\n');
                    for (let j = 0; j < subDirLines.length; j++) {
                        const line = subDirLines[j];
                        if (j === 0) {
                            textResult += line + '\n';
                        }
                        else if (line.trim() !== '') {
                            textResult += newPrefix + line + '\n';
                        }
                    }
                    htmlResult += subDirResult.html;
                }
                else {
                    textResult += `${newPrefix}${itemIsLast ? '└── ' : '├── '}${item}\n`;
                    htmlResult += processFileHtml(item, itemIsLast, false, newPrefix.includes('│'));
                }
            }
            catch (error) {
                textResult += `${newPrefix}${itemIsLast ? '└── ' : '├── '}${item} (error al acceder)\n`;
                htmlResult += processFileHtml(item, itemIsLast, true, newPrefix.includes('│'));
            }
        }
    }
    catch (error) {
        textResult += `Error al leer el directorio: ${error}\n`;
        htmlResult += `<div class="tree-item error">Error al leer el directorio: ${error}</div>`;
    }
    htmlResult += '</div>';
    return { text: textResult, html: htmlResult };
}
// Procesar un archivo (texto)
function processFile(fileName, isLast) {
    return `${isLast ? '└── ' : '├── '}${fileName}\n`;
}
// Procesar un archivo (HTML)
function processFileHtml(fileName, isLast, isError = false, hasParent = false) {
    const icon = getFileIcon(fileName);
    const errorClass = isError ? ' error' : '';
    return `<div class="tree-file${errorClass}"><span class="file-icon">${icon}</span> ${fileName}</div>`;
}
// Obtener icono según extensión
function getFileIcon(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const iconMap = {
        '.ts': '🔷',
        '.js': '🟨',
        '.json': '📋',
        '.html': '🌐',
        '.css': '🎨',
        '.md': '📝',
        '.txt': '📄',
        '.gitignore': '🔒',
        '.vsix': '📦',
        '.png': '🖼️',
        '.jpg': '🖼️',
        '.jpeg': '🖼️',
        '.svg': '🖼️',
        '.ico': '🖼️'
    };
    return iconMap[ext] || '📄';
}
// Generar el contenido HTML del WebView
function getWebviewContent(webview, extensionPath, rootPath, treeData) {
    return `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tree Generator</title>
        <style>
            body {
                font-family: var(--vscode-font-family);
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                padding: 20px;
                margin: 0;
            }
            
            .container {
                max-width: 100%;
                overflow-x: auto;
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
            }
            
            .controls {
                display: flex;
                gap: 10px;
            }
            
            .controls button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 6px 12px;
                cursor: pointer;
                border-radius: 4px;
                font-size: 12px;
            }
            
            .controls button:hover {
                background-color: var(--vscode-button-hoverBackground);
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
                margin-bottom: 10px;
            }
            
            .option-group label {
                margin-right: 15px;
                cursor: pointer;
            }
            
            .option-group input[type="checkbox"] {
                margin-right: 5px;
                vertical-align: middle;
            }
            
            .tree-container {
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                line-height: 1.5;
                white-space: pre;
            }
            
            .tree-root {
                font-weight: bold;
                margin-bottom: 5px;
            }
            
            .tree-children {
                margin-left: 20px;
            }
            
            .tree-folder {
                color: var(--vscode-symbolIcon-folderForeground);
                margin-top: 2px;
            }
            
            .tree-file {
                margin-left: 0;
                margin-top: 2px;
            }
            
            .tree-file.error {
                color: var(--vscode-errorForeground);
            }
            
            .folder-icon, .file-icon {
                margin-right: 5px;
                display: inline-block;
                width: 20px;
            }
            
            .tree-container.with-icons .tree-folder .folder-icon,
            .tree-container.with-icons .tree-file .file-icon {
                display: inline-block;
            }
            
            .tree-container.without-icons .folder-icon,
            .tree-container.without-icons .file-icon {
                display: none;
            }
            
            .footer {
                margin-top: 20px;
                padding-top: 10px;
                border-top: 1px solid var(--vscode-panel-border);
                font-size: 0.9em;
                color: var(--vscode-descriptionForeground);
                text-align: center;
            }
            
            .footer a {
                color: var(--vscode-textLink-foreground);
                text-decoration: none;
            }
            
            .footer a:hover {
                text-decoration: underline;
            }
            
            .stats {
                margin-top: 10px;
                font-size: 0.9em;
                color: var(--vscode-descriptionForeground);
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="title">📊 Árbol de Directorios: ${path.basename(rootPath)}</div>
                <div class="controls">
                    <button onclick="toggleOptions()">⚙️ Opciones</button>
                    <button onclick="toggleIcons()">👁️ Mostrar/Ocultar iconos</button>
                    <button onclick="copyToClipboard()">📋 Copiar</button>
                    <button onclick="exportToFile()">💾 Exportar</button>
                </div>
            </div>
            
            <div class="options-panel" id="optionsPanel">
                <div class="option-group">
                    <label>
                        <input type="checkbox" id="includeHidden" ${treeData.text.includes('.git') ? 'checked' : ''}> 
                        Incluir archivos ocultos
                    </label>
                </div>
                <div class="option-group">
                    <label for="maxDepth">Profundidad máxima:</label>
                    <input type="number" id="maxDepth" min="1" placeholder="Sin límite" style="width: 100px;">
                </div>
                <button onclick="applyOptions()">Aplicar cambios</button>
            </div>
            
            <div class="tree-container with-icons" id="treeContainer">
                ${treeData.html}
            </div>
            
            <div class="stats">
                <span>Ruta: ${rootPath}</span>
            </div>
            
            <div class="footer">
                <span>¿Te gusta esta extensión? </span>
                <a href="#" onclick="donate()">☕ Invítame un café</a>
            </div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            let currentTreeData = ${JSON.stringify(treeData)};
            let currentRootPath = "${rootPath}";
            
            function toggleOptions() {
                document.getElementById('optionsPanel').classList.toggle('visible');
            }
            
            function toggleIcons() {
                const container = document.getElementById('treeContainer');
                if (container.classList.contains('with-icons')) {
                    container.classList.remove('with-icons');
                    container.classList.add('without-icons');
                } else {
                    container.classList.remove('without-icons');
                    container.classList.add('with-icons');
                }
            }
            
            function copyToClipboard() {
                vscode.postMessage({
                    command: 'copy',
                    text: currentTreeData.text
                });
            }
            
            function exportToFile() {
                vscode.postMessage({
                    command: 'export',
                    text: currentTreeData.text
                });
            }
            
            function donate() {
                vscode.postMessage({
                    command: 'donate'
                });
                vscode.commands.executeCommand('tree-generator.donate');
            }
            
            function applyOptions() {
                const includeHidden = document.getElementById('includeHidden').checked;
                const maxDepth = document.getElementById('maxDepth').value;
                
                vscode.postMessage({
                    command: 'refresh',
                    rootPath: currentRootPath,
                    includeHidden: includeHidden,
                    maxDepth: maxDepth
                });
            }
            
            // Escuchar mensajes del extension host
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateTree':
                        currentTreeData = message.treeData;
                        document.getElementById('treeContainer').innerHTML = message.treeData.html;
                        break;
                }
            });
        </script>
    </body>
    </html>`;
}
//# sourceMappingURL=extension.js.map