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

            if (includeHidden === undefined) return;

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
                            const newIncludeHidden = message.includeHidden === 'true';
                            const newMaxDepth = message.maxDepth ? parseInt(message.maxDepth) : undefined;
                            
                            // Limpiar la ruta
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

    // Mostrar mensaje de donación
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
    }, 60000);
}

export function deactivate() {}

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

// Función para generar el árbol visual con formato adecuado
function generateVisualTree(rootPath: string, options: { includeHidden: boolean, maxDepth?: number }): string {
    const rootName = path.basename(rootPath);
    let result = `📁 ${rootName}/\n`;
    
    function processDirectory(dirPath: string, prefix: string = '', depth: number = 0): string {
        if (options.maxDepth && depth >= options.maxDepth) {
            return '';
        }

        let result = '';
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
                } catch {
                    return {
                        name: item,
                        path: itemPath,
                        isDirectory: false
                    };
                }
            });

            // Ordenar: directorios primero
            itemsWithStats.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });

            for (let i = 0; i < itemsWithStats.length; i++) {
                const item = itemsWithStats[i];
                const isLast = i === itemsWithStats.length - 1;
                const connector = isLast ? '└── ' : '├── ';
                
                if (item.isDirectory) {
                    result += `${prefix}${connector}📁 ${item.name}/\n`;
                    const newPrefix = prefix + (isLast ? '    ' : '│   ');
                    result += processDirectory(item.path, newPrefix, depth + 1);
                } else {
                    const icon = getFileIcon(item.name);
                    result += `${prefix}${connector}${icon} ${item.name}\n`;
                }
            }
        } catch (error) {
            result += `${prefix}Error: ${error}\n`;
        }
        
        return result;
    }
    
    return result + processDirectory(rootPath, '', 1);
}

async function generateDirectoryTree(rootPath: string, options: { includeHidden: boolean, maxDepth?: number }): Promise<{ text: string, html: string }> {
    // Generar el árbol visual con formato
    const visualTree = generateVisualTree(rootPath, options);
    
    // Para el HTML, simplemente envolvemos el texto en un pre con estilo monoespaciado
    const htmlTree = `<pre style="font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.6; margin: 0; white-space: pre-wrap;">${visualTree}</pre>`;
    
    return { 
        text: visualTree, 
        html: htmlTree 
    };
}

function getFileIcon(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName).toLowerCase();
    
    const iconMap: { [key: string]: string } = {
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
    
    if (baseName === 'dockerfile') return '🐳';
    if (baseName === 'makefile') return '⚙️';
    if (baseName === '.gitignore') return '🔀';
    if (baseName === '.env') return '⚙️';
    if (baseName === 'package.json') return '📦';
    if (baseName === 'package-lock.json') return '🔒';
    if (baseName === 'tsconfig.json') return '⚙️';
    
    return iconMap[ext] || '📄';
}

function getWebviewContent(rootPath: string, treeData: { text: string, html: string }, includeHidden: boolean): string {
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
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.6;
            background-color: var(--vscode-editor-background);
            padding: 15px;
            border-radius: 4px;
            border: 1px solid var(--vscode-panel-border);
            overflow-x: auto;
        }
        
        .stats {
            margin-top: 15px;
            font-size: 0.9em;
            color: var(--vscode-descriptionForeground);
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 4px;
            word-break: break-all;
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
        }
        
        pre {
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">Árbol de Directorios: ${path.basename(rootPath)}</div>
            <div class="controls">
                <button onclick="toggleOptions()">Opciones</button>
                <button onclick="copyToClipboard()">Copiar</button>
                <button onclick="exportToFile()">Exportar</button>
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
                    <input type="number" id="maxDepth" min="1" placeholder="Sin límite">
                </label>
                
                <button onclick="applyOptions()">Aplicar cambios</button>
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
            <div>📁 Ruta: ${rootPath}</div>
            <div style="margin-top: 5px;">
                👁️ Archivos ocultos: ${includeHidden ? 'Incluidos' : 'Excluidos'}
            </div>
            <div style="margin-top: 5px;">
                📊 Líneas: ${(treeData.text.match(/\n/g) || []).length}
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
        
        function toggleOptions() {
            document.getElementById('optionsPanel').classList.toggle('visible');
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
            vscode.postMessage({ command: 'donate' });
            vscode.commands.executeCommand('tree-generator.donate');
        }
        
        function showLoading(show) {
            const statusMsg = document.getElementById('statusMessage');
            statusMsg.style.display = show ? 'flex' : 'none';
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
        
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.command === 'updateTree') {
                currentTreeData = message.treeData;
                document.getElementById('treeContainer').innerHTML = message.treeData.html;
                document.getElementById('includeHidden').checked = message.includeHidden;
                showLoading(false);
            }
        });
    </script>
</body>
</html>`;
}