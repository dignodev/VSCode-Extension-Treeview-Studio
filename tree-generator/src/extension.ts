import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let donationShown = false;

export function activate(context: vscode.ExtensionContext) {
    console.log('Tree Generator extension activada');

    // Registrar comando para donación
    context.subscriptions.push(
        vscode.commands.registerCommand('tree-generator.donate', () => {
            vscode.env.openExternal(vscode.Uri.parse('https://www.buymeacoffee.com/dignodev'));
        })
    );

    // Registrar comando principal
    let disposable = vscode.commands.registerCommand('tree-generator.generateTree', async (uri: vscode.Uri) => {
        try {
            // Obtener la ruta del directorio seleccionado
            let rootPath: string;
            
            if (uri && uri.fsPath) {
                const stat = fs.statSync(uri.fsPath);
                if (stat.isDirectory()) {
                    rootPath = uri.fsPath;
                } else {
                    rootPath = path.dirname(uri.fsPath);
                }
            } else {
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

            if (includeHidden === undefined) return; // Usuario canceló

            // Obtener profundidad máxima
            const maxDepth = await getMaxDepth();
            
            // Generar el árbol
            const treeData = await generateDirectoryTree(rootPath, {
                includeHidden: includeHidden === 'Sí',
                maxDepth: maxDepth
            });

            // Crear y mostrar el panel WebView
            const panel = vscode.window.createWebviewPanel(
                'treeGenerator',
                `Árbol: ${path.basename(rootPath)}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            // Enviar los datos al WebView
            panel.webview.html = getWebviewContent(rootPath, treeData, includeHidden === 'Sí');

            // Manejar mensajes del WebView
            panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'refresh':
                            // Regenerar el árbol con nuevas opciones
                            const newIncludeHidden = message.includeHidden === 'true';
                            const newMaxDepth = message.maxDepth ? parseInt(message.maxDepth) : undefined;
                            
                            // Limpiar la ruta de nuevo
                            const cleanRootPath = message.rootPath.replace(/\t/g, '').trim();
                            
                            vscode.window.showInformationMessage(`Regenerando árbol...`);
                            
                            const newTreeData = await generateDirectoryTree(cleanRootPath, {
                                includeHidden: newIncludeHidden,
                                maxDepth: newMaxDepth
                            });
                            
                            panel.webview.postMessage({ 
                                command: 'updateTree', 
                                treeData: newTreeData,
                                includeHidden: newIncludeHidden
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
                },
                undefined,
                context.subscriptions
            );

        } catch (error) {
            vscode.window.showErrorMessage(`Error al generar el árbol: ${error}`);
        }
    });

    context.subscriptions.push(disposable);

    // Mostrar mensaje de donación después de 1 minuto (solo una vez)
    setTimeout(() => {
        if (!context.globalState.get('donationShown') && !donationShown) {
            vscode.window.showInformationMessage(
                '¿Disfrutando Tree Generator? Si quieres apoyar el desarrollo, considera invitarme a un café ☕',
                'Apoyar ahora', 'Más tarde'
            ).then(selection => {
                if (selection === 'Apoyar ahora') {
                    vscode.commands.executeCommand('tree-generator.donate');
                }
                context.globalState.update('donationShown', true);
                donationShown = true;
            });
        }
    }, 60000); // 1 minuto
}

export function deactivate() {}

// Función para obtener la profundidad máxima
async function getMaxDepth(): Promise<number | undefined> {
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
async function generateDirectoryTree(rootPath: string, options: { includeHidden: boolean, maxDepth?: number }): Promise<{ text: string, html: string }> {
    const rootName = path.basename(rootPath);
    let textTree = `${rootName}/\n`;
    let htmlTree = `<div class="tree-root"><span class="icon">📁</span> ${rootName}/</div><div class="tree-children">`;
    
    try {
        // Verificar que el directorio existe
        if (!fs.existsSync(rootPath)) {
            throw new Error(`El directorio no existe: ${rootPath}`);
        }

        const items = await fs.promises.readdir(rootPath);
        
        // Primero, obtener información de todos los items para ordenar
        const itemsWithStats = await Promise.all(
            items.map(async (item) => {
                const itemPath = path.join(rootPath, item);
                try {
                    const stat = await fs.promises.stat(itemPath);
                    return {
                        name: item,
                        path: itemPath,
                        isDirectory: stat.isDirectory(),
                        isFile: stat.isFile()
                    };
                } catch {
                    return {
                        name: item,
                        path: itemPath,
                        isDirectory: false,
                        isFile: false,
                        error: true
                    };
                }
            })
        );

        // Filtrar según opciones
        const filteredItems = itemsWithStats.filter(item => {
            if (!options.includeHidden) {
                if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '.git') {
                    return false;
                }
            }
            return true;
        });

        // Ordenar: directorios primero, luego archivos, ambos alfabéticamente
        filteredItems.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

        for (let i = 0; i < filteredItems.length; i++) {
            const item = filteredItems[i];
            const isLast = i === filteredItems.length - 1;
            
            if (item.error) {
                textTree += `${isLast ? '└── ' : '├── '}${item.name} (error al acceder)\n`;
                htmlTree += `<div class="tree-file error"><span class="icon">⚠️</span> ${item.name} (error)</div>`;
            } else if (item.isDirectory) {
                const result = await processDirectory(item.path, item.name, isLast, options, 1);
                textTree += result.text;
                htmlTree += result.html;
            } else {
                textTree += processFile(item.name, isLast);
                htmlTree += processFileHtml(item.name, isLast);
            }
        }
    } catch (error) {
        textTree = `Error al leer el directorio: ${error}\n`;
        htmlTree = `<div class="tree-item error"><span class="icon">❌</span> Error al leer el directorio: ${error}</div>`;
    }
    
    htmlTree += '</div>';
    return { text: textTree, html: htmlTree };
}

// Procesar un directorio recursivamente
async function processDirectory(
    dirPath: string, 
    dirName: string, 
    isLast: boolean, 
    options: { includeHidden: boolean, maxDepth?: number },
    depth: number
): Promise<{ text: string, html: string }> {
    const prefix = isLast ? '└── ' : '├── ';
    let textResult = `${prefix}${dirName}/\n`;
    let htmlResult = `<div class="tree-folder"><span class="icon">📁</span> ${dirName}/</div><div class="tree-children">`;
    
    // Si alcanzamos la profundidad máxima, no procesamos más
    if (options.maxDepth && depth >= options.maxDepth) {
        htmlResult += '</div>';
        return { text: textResult, html: htmlResult };
    }
    
    try {
        const items = await fs.promises.readdir(dirPath);
        
        // Primero, obtener información de todos los items para ordenar
        const itemsWithStats = await Promise.all(
            items.map(async (item) => {
                const itemPath = path.join(dirPath, item);
                try {
                    const stat = await fs.promises.stat(itemPath);
                    return {
                        name: item,
                        path: itemPath,
                        isDirectory: stat.isDirectory(),
                        isFile: stat.isFile()
                    };
                } catch {
                    return {
                        name: item,
                        path: itemPath,
                        isDirectory: false,
                        isFile: false,
                        error: true
                    };
                }
            })
        );

        // Filtrar según opciones
        const filteredItems = itemsWithStats.filter(item => {
            if (!options.includeHidden) {
                if (item.name.startsWith('.') || item.name === 'node_modules' || item.name === '.git') {
                    return false;
                }
            }
            return true;
        });

        // Ordenar: directorios primero, luego archivos, ambos alfabéticamente
        filteredItems.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
        });

        for (let i = 0; i < filteredItems.length; i++) {
            const item = filteredItems[i];
            const itemIsLast = i === filteredItems.length - 1;
            const newPrefix = isLast ? '    ' : '│   ';
            
            if (item.error) {
                textResult += `${newPrefix}${itemIsLast ? '└── ' : '├── '}${item.name} (error al acceder)\n`;
                htmlResult += `<div class="tree-file error"><span class="icon">⚠️</span> ${item.name} (error)</div>`;
            } else if (item.isDirectory) {
                const subDirResult = await processDirectory(item.path, item.name, itemIsLast, options, depth + 1);
                const subDirLines = subDirResult.text.split('\n');
                for (let j = 0; j < subDirLines.length; j++) {
                    const line = subDirLines[j];
                    if (j === 0) {
                        textResult += line + '\n';
                    } else if (line.trim() !== '') {
                        textResult += newPrefix + line + '\n';
                    }
                }
                htmlResult += subDirResult.html;
            } else {
                textResult += `${newPrefix}${itemIsLast ? '└── ' : '├── '}${item.name}\n`;
                htmlResult += processFileHtml(item.name, itemIsLast);
            }
        }
    } catch (error) {
        textResult += `Error al leer el directorio: ${error}\n`;
        htmlResult += `<div class="tree-item error"><span class="icon">❌</span> Error al leer el directorio: ${error}</div>`;
    }
    
    htmlResult += '</div>';
    return { text: textResult, html: htmlResult };
}

// Procesar un archivo (texto)
function processFile(fileName: string, isLast: boolean): string {
    return `${isLast ? '└── ' : '├── '}${fileName}\n`;
}

// Procesar un archivo (HTML)
function processFileHtml(fileName: string, isLast: boolean, isError: boolean = false): string {
    const icon = getFileIcon(fileName);
    const errorClass = isError ? ' error' : '';
    return `<div class="tree-file${errorClass}"><span class="icon">${icon}</span> ${fileName}</div>`;
}

// Obtener icono según extensión
function getFileIcon(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName).toLowerCase();
    
    // Map of file extensions to emoji icons
    const iconMap: { [key: string]: string } = {
        // TypeScript/JavaScript
        '.ts': '🔷',
        '.tsx': '⚛️',
        '.js': '🟨',
        '.jsx': '⚛️',
        '.mjs': '🟨',
        '.cjs': '🟨',
        
        // Web
        '.html': '🌐',
        '.htm': '🌐',
        '.css': '🎨',
        '.scss': '🎨',
        '.sass': '🎨',
        '.less': '🎨',
        
        // Data/Config
        '.json': '📋',
        '.xml': '📰',
        '.yaml': '📐',
        '.yml': '📐',
        
        // Documents
        '.md': '📝',
        '.txt': '📄',
        '.pdf': '📕',
        
        // Images
        '.png': '🖼️',
        '.jpg': '🖼️',
        '.jpeg': '🖼️',
        '.gif': '🖼️',
        '.svg': '🖼️',
        '.ico': '🖼️',
        '.webp': '🖼️',
        
        // Code files
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
        
        // Package/Build files
        '.lock': '🔒',
        '.vsix': '📦',
        
        // Docker/Config
        '.env': '⚙️',
        '.gitignore': '🔀',
        
        // Database
        '.sql': '🗄️',
        '.db': '🗄️',
        '.sqlite': '🗄️',
        
        // Other
        '.zip': '🗜️',
        '.tar': '🗜️',
        '.gz': '🗜️',
        '.log': '📋',
        '.sh': '💻',
        '.bat': '💻',
        '.ps1': '💻',
        '.map': '🗺️'
    };
    
    // Check for exact filename matches
    if (baseName === 'dockerfile') return '🐳';
    if (baseName === 'makefile') return '⚙️';
    if (baseName === '.gitignore') return '🔀';
    if (baseName === '.env') return '⚙️';
    if (baseName === 'package.json') return '📦';
    if (baseName === 'package-lock.json') return '🔒';
    if (baseName === 'tsconfig.json') return '⚙️';
    
    return iconMap[ext] || '📄';
}

// Generar el contenido HTML del WebView
function getWebviewContent(rootPath: string, treeData: { text: string, html: string }, includeHidden: boolean): string {
    // Escapar la ruta para JSON
    const escapedRootPath = rootPath.replace(/\\/g, '\\\\');
    
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
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .controls {
                display: flex;
                gap: 8px;
            }
            
            .controls button {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
                border: none;
                padding: 6px 12px;
                cursor: pointer;
                border-radius: 4px;
                font-size: 12px;
                display: flex;
                align-items: center;
                gap: 4px;
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
                margin-bottom: 15px;
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
                cursor: pointer;
                width: 16px;
                height: 16px;
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
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .tree-container {
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.8;
                white-space: pre;
                background-color: var(--vscode-editor-background);
                padding: 15px;
                border-radius: 4px;
                border: 1px solid var(--vscode-panel-border);
                overflow-x: auto;
            }
            
            .tree-root {
                font-weight: bold;
                margin-bottom: 8px;
                color: var(--vscode-symbolIcon-folderForeground);
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .tree-children {
                margin-left: 24px;
            }
            
            .tree-folder {
                color: var(--vscode-symbolIcon-folderForeground);
                margin: 2px 0;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .tree-file {
                margin: 2px 0;
                white-space: nowrap;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .tree-file.error {
                color: var(--vscode-errorForeground);
            }
            
            .icon {
                display: inline-block;
                width: 20px;
                text-align: center;
                font-size: 14px;
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
                cursor: pointer;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            
            .footer a:hover {
                text-decoration: underline;
            }
            
            .stats {
                margin-top: 15px;
                font-size: 0.9em;
                color: var(--vscode-descriptionForeground);
                padding: 10px;
                background-color: var(--vscode-editor-inactiveSelectionBackground);
                border-radius: 4px;
                word-break: break-all;
                display: flex;
                gap: 20px;
                flex-wrap: wrap;
            }
            
            .stats div {
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .loading {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid var(--vscode-button-background);
                border-radius: 50%;
                border-top-color: transparent;
                animation: spin 1s linear infinite;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .status-message {
                display: flex;
                align-items: center;
                gap: 10px;
                margin: 10px 0;
                padding: 10px;
                background-color: var(--vscode-infoBackground);
                color: var(--vscode-infoForeground);
                border-radius: 4px;
            }
            
            .tab-view {
                display: flex;
                gap: 2px;
                margin-bottom: 15px;
                border-bottom: 1px solid var(--vscode-panel-border);
            }
            
            .tab {
                padding: 8px 16px;
                cursor: pointer;
                background-color: transparent;
                border: none;
                color: var(--vscode-foreground);
                opacity: 0.7;
                border-bottom: 2px solid transparent;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            
            .tab:hover {
                opacity: 1;
                background-color: var(--vscode-toolbar-hoverBackground);
            }
            
            .tab.active {
                opacity: 1;
                border-bottom-color: var(--vscode-tab-activeBorder);
            }
            
            .view {
                display: none;
            }
            
            .view.active {
                display: block;
            }
            
            .text-view {
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.6;
                white-space: pre;
                background-color: var(--vscode-editor-background);
                padding: 15px;
                border-radius: 4px;
                border: 1px solid var(--vscode-panel-border);
                overflow-x: auto;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="title">
                    <span class="icon">📊</span>
                    Árbol de Directorios: ${path.basename(rootPath)}
                </div>
                <div class="controls">
                    <button onclick="toggleOptions()" title="Opciones">
                        <span class="icon">⚙️</span>
                        Opciones
                    </button>
                    <button onclick="copyToClipboard()" title="Copiar al portapapeles">
                        <span class="icon">📋</span>
                        Copiar
                    </button>
                    <button onclick="exportToFile()" title="Exportar a archivo">
                        <span class="icon">💾</span>
                        Exportar
                    </button>
                </div>
            </div>
            
            <div class="options-panel" id="optionsPanel">
                <div class="option-group">
                    <label>
                        <input type="checkbox" id="includeHidden" ${includeHidden ? 'checked' : ''}> 
                        <span class="icon">👁️</span>
                        Incluir archivos ocultos (.git, node_modules, etc.)
                    </label>
                    
                    <label>
                        <span class="icon">📏</span>
                        Profundidad máxima:
                        <input type="number" id="maxDepth" min="1" placeholder="Sin límite">
                    </label>
                    
                    <button onclick="applyOptions()">
                        <span class="icon">🔄</span>
                        Aplicar cambios
                    </button>
                </div>
            </div>
            
            <div class="status-message" id="statusMessage" style="display: none;">
                <span class="loading"></span>
                <span id="statusText">Regenerando árbol...</span>
            </div>
            
            <div class="tab-view">
                <button class="tab active" onclick="showTab('visual')" id="tabVisual">
                    <span class="icon">👁️</span> Vista Visual
                </button>
                <button class="tab" onclick="showTab('text')" id="tabText">
                    <span class="icon">📝</span> Vista Texto
                </button>
            </div>
            
            <div class="view active" id="viewVisual">
                <div class="tree-container" id="treeContainer">
                    ${treeData.html}
                </div>
            </div>
            
            <div class="view" id="viewText">
                <div class="text-view" id="textContainer">${treeData.text}</div>
            </div>
            
            <div class="stats">
                <div><span class="icon">📁</span> Ruta: ${rootPath}</div>
                <div>
                    <span class="icon">${includeHidden ? '👁️' : '👁️‍🗨️'}</span>
                    Archivos ocultos: ${includeHidden ? 'Incluidos' : 'Excluidos'}
                </div>
                <div><span class="icon">📊</span> Elementos: ${(treeData.text.match(/\n/g) || []).length} líneas</div>
            </div>
            
            <div class="footer">
                <span>¿Te gusta esta extensión? </span>
                <a href="#" onclick="donate()">
                    <span class="icon">☕</span>
                    Invítame un café
                </a>
            </div>
        </div>
        
        <script>
            const vscode = acquireVsCodeApi();
            let currentTreeData = ${JSON.stringify(treeData)};
            let currentRootPath = "${escapedRootPath}";
            
            function toggleOptions() {
                const panel = document.getElementById('optionsPanel');
                panel.classList.toggle('visible');
            }
            
            function showTab(tabName) {
                document.getElementById('tabVisual').classList.remove('active');
                document.getElementById('tabText').classList.remove('active');
                document.getElementById('viewVisual').classList.remove('active');
                document.getElementById('viewText').classList.remove('active');
                
                document.getElementById('tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
                document.getElementById('view' + tabName.charAt(0).toUpperCase() + tabName.slice(1)).classList.add('active');
            }
            
            function copyToClipboard() {
                const activeTab = document.querySelector('.tab.active').id === 'tabVisual' ? 'visual' : 'text';
                let text = '';
                
                if (activeTab === 'visual') {
                    text = currentTreeData.text;
                } else {
                    text = document.getElementById('textContainer').innerText;
                }
                
                vscode.postMessage({
                    command: 'copy',
                    text: text
                });
            }
            
            function exportToFile() {
                const activeTab = document.querySelector('.tab.active').id === 'tabVisual' ? 'visual' : 'text';
                let text = '';
                
                if (activeTab === 'visual') {
                    text = currentTreeData.text;
                } else {
                    text = document.getElementById('textContainer').innerText;
                }
                
                vscode.postMessage({
                    command: 'export',
                    text: text
                });
            }
            
            function donate() {
                vscode.postMessage({
                    command: 'donate'
                });
                vscode.commands.executeCommand('tree-generator.donate');
            }
            
            function showLoading(show) {
                const statusMsg = document.getElementById('statusMessage');
                if (show) {
                    statusMsg.style.display = 'flex';
                } else {
                    statusMsg.style.display = 'none';
                }
            }
            
            function applyOptions() {
                const includeHidden = document.getElementById('includeHidden').checked;
                const maxDepth = document.getElementById('maxDepth').value;
                
                showLoading(true);
                
                vscode.postMessage({
                    command: 'refresh',
                    rootPath: currentRootPath,
                    includeHidden: includeHidden,
                    maxDepth: maxDepth || undefined
                });
            }
            
            // Escuchar mensajes del extension host
            window.addEventListener('message', event => {
                const message = event.data;
                switch (message.command) {
                    case 'updateTree':
                        currentTreeData = message.treeData;
                        document.getElementById('treeContainer').innerHTML = message.treeData.html;
                        document.getElementById('textContainer').innerText = message.treeData.text;
                        document.getElementById('includeHidden').checked = message.includeHidden;
                        showLoading(false);
                        break;
                }
            });
        </script>
    </body>
    </html>`;
}