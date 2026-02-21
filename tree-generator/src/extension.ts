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
            const panel = vscode.window.createWebviewPanel(
                'treeGenerator',
                `Árbol: ${path.basename(rootPath)}`,
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'media'))]
                }
            );

            // Enviar los datos al WebView
            panel.webview.html = getWebviewContent(panel.webview, context.extensionPath, rootPath, treeData);

            // Manejar mensajes del WebView
            panel.webview.onDidReceiveMessage(
                async message => {
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
                },
                undefined,
                context.subscriptions
            );

            vscode.window.showInformationMessage('Árbol de directorios generado correctamente');

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
                } else {
                    textTree += processFile(item, isLast);
                    htmlTree += processFileHtml(item, isLast, false);
                }
            } catch (error) {
                textTree += `${isLast ? '└── ' : '├── '}${item} (error al acceder)\n`;
                htmlTree += processFileHtml(item, isLast, true);
            }
        }
    } catch (error) {
        textTree += `Error al leer el directorio: ${error}\n`;
        htmlTree += `<div class="tree-item error">Error al leer el directorio: ${error}</div>`;
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
    let htmlResult = `<div class="tree-folder"><span class="codicon $(folder)"></span> ${dirName}/</div><div class="tree-children">`;
    
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
                        } else if (line.trim() !== '') {
                            textResult += newPrefix + line + '\n';
                        }
                    }
                    htmlResult += subDirResult.html;
                } else {
                    textResult += `${newPrefix}${itemIsLast ? '└── ' : '├── '}${item}\n`;
                    htmlResult += processFileHtml(item, itemIsLast, false, newPrefix.includes('│'));
                }
            } catch (error) {
                textResult += `${newPrefix}${itemIsLast ? '└── ' : '├── '}${item} (error al acceder)\n`;
                htmlResult += processFileHtml(item, itemIsLast, true, newPrefix.includes('│'));
            }
        }
    } catch (error) {
        textResult += `Error al leer el directorio: ${error}\n`;
        htmlResult += `<div class="tree-item error">Error al leer el directorio: ${error}</div>`;
    }
    
    htmlResult += '</div>';
    return { text: textResult, html: htmlResult };
}

// Procesar un archivo (texto)
function processFile(fileName: string, isLast: boolean): string {
    return `${isLast ? '└── ' : '├── '}${fileName}\n`;
}

// Procesar un archivo (HTML)
function processFileHtml(fileName: string, isLast: boolean, isError: boolean = false, hasParent: boolean = false): string {
    const iconClass = getFileIconClass(fileName);
    const errorClass = isError ? ' error' : '';
    return `<div class="tree-file${errorClass}"><span class="codicon ${iconClass}"></span> ${fileName}</div>`;
}

// Obtener clase de icono según extensión
function getFileIconClass(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName).toLowerCase();
    
    // Map of file extensions to VS Code icon classes
    const iconMap: { [key: string]: string } = {
        // TypeScript/JavaScript
        '.ts': 'ts-file',
        '.tsx': 'ts-file',
        '.js': 'js-file',
        '.jsx': 'js-file',
        '.mjs': 'js-file',
        '.cjs': 'js-file',
        
        // Web
        '.html': 'html-file',
        '.htm': 'html-file',
        '.css': 'css-file',
        '.scss': 'css-file',
        '.sass': 'css-file',
        '.less': 'css-file',
        
        // Data/Config
        '.json': 'json-file',
        '.xml': 'xml-file',
        '.yaml': 'yaml-file',
        '.yml': 'yaml-file',
        
        // Documents
        '.md': 'md-file',
        '.txt': 'txt-file',
        '.pdf': 'pdf-file',
        
        // Images
        '.png': 'img-file',
        '.jpg': 'img-file',
        '.jpeg': 'img-file',
        '.gif': 'img-file',
        '.svg': 'img-file',
        '.ico': 'img-file',
        '.webp': 'img-file',
        
        // Code files
        '.py': 'py-file',
        '.java': 'java-file',
        '.c': 'c-file',
        '.cpp': 'cpp-file',
        '.h': 'h-file',
        '.hpp': 'hpp-file',
        '.cs': 'cs-file',
        '.go': 'go-file',
        '.rs': 'rs-file',
        '.rb': 'rb-file',
        '.php': 'php-file',
        '.swift': 'swift-file',
        '.kt': 'kt-file',
        '.scala': 'scala-file',
        
        // Package/Build files
        '.lock': 'lock-file',
        '.vsix': 'vsix-file',
        '.npm': 'npm-file',
        
        // Docker/Config
        'dockerfile': 'dockerfile-file',
        '.dockerfile': 'dockerfile-file',
        'makefile': 'makefile-file',
        '.env': 'env-file',
        '.gitignore': 'gitignore-file',
        
        // Database
        '.sql': 'sql-file',
        '.db': 'db-file',
        '.sqlite': 'sqlite-file',
        
        // Other
        '.zip': 'zip-file',
        '.tar': 'zip-file',
        '.gz': 'zip-file',
        '.log': 'log-file',
        '.sh': 'sh-file',
        '.bat': 'bat-file',
        '.ps1': 'ps1-file'
    };
    
    // Check for exact filename matches
    if (baseName === 'dockerfile') return 'dockerfile-file';
    if (baseName === 'makefile') return 'makefile-file';
    if (baseName === '.gitignore') return 'gitignore-file';
    if (baseName === '.env') return 'env-file';
    
    return iconMap[ext] || 'file-icon';
}

// Obtener icono según extensión usando iconos de VS Code
function getFileIcon(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName).toLowerCase();
    
    // Map of file extensions to VS Code codicon class names
    const iconMap: { [key: string]: string } = {
        // TypeScript/JavaScript
        '.ts': '$(symbol-type) ts-file',
        '.tsx': '$(symbol-type) ts-file',
        '.js': '$(symbol-numeric) js-file',
        '.jsx': '$(symbol-numeric) js-file',
        '.mjs': '$(symbol-numeric) js-file',
        '.cjs': '$(symbol-numeric) js-file',
        
        // Web
        '.html': '$(code) html-file',
        '.htm': '$(code) html-file',
        '.css': '$(symbol-property) css-file',
        '.scss': '$(symbol-property) css-file',
        '.sass': '$(symbol-property) css-file',
        '.less': '$(symbol-property) css-file',
        
        // Data/Config
        '.json': '$(json) json-file',
        '.xml': '$(xml) xml-file',
        '.yaml': '$(yaml) yaml-file',
        '.yml': '$(yaml) yaml-file',
        
        // Documents
        '.md': '$(markdown) md-file',
        '.txt': '$(file-text) txt-file',
        '.pdf': '$(pdf) pdf-file',
        '.doc': '$(word) doc-file',
        '.docx': '$(word) doc-file',
        
        // Images
        '.png': '$(image) img-file',
        '.jpg': '$(image) img-file',
        '.jpeg': '$(image) img-file',
        '.gif': '$(image) img-file',
        '.svg': '$(image) img-file',
        '.ico': '$(image) img-file',
        '.webp': '$(image) img-file',
        
        // Code files
        '.py': '$(python) py-file',
        '.java': '$(java) java-file',
        '.c': '$(c) c-file',
        '.cpp': '$(cpp) cpp-file',
        '.h': '$(header) h-file',
        '.hpp': '$(header) hpp-file',
        '.cs': '$(csharp) cs-file',
        '.go': '$(go) go-file',
        '.rs': '$(rust) rs-file',
        '.rb': '$(ruby) rb-file',
        '.php': '$(php) php-file',
        '.swift': '$(swift) swift-file',
        '.kt': '$(kotlin) kt-file',
        '.scala': '$(scala) scala-file',
        
        // Package/Build files
        '.lock': '$(lock) lock-file',
        '.vsix': '$(package) vsix-file',
        '.npm': '$(npm) npm-file',
        
        // Docker/Config
        'dockerfile': '$(docker) dockerfile-file',
        '.dockerfile': '$(docker) dockerfile-file',
        'makefile': '$(file-code) makefile-file',
        '.env': '$(settings) env-file',
        '.gitignore': '$(git) gitignore-file',
        
        // Database
        '.sql': '$(database) sql-file',
        '.db': '$(database) db-file',
        '.sqlite': '$(database) sqlite-file',
        
        // Other
        '.zip': '$(zip) zip-file',
        '.tar': '$(zip) tar-file',
        '.gz': '$(zip) gz-file',
        '.log': '$(file-text) log-file',
        '.sh': '$(terminal) sh-file',
        '.bat': '$(terminal) bat-file',
        '.ps1': '$(terminal) ps1-file'
    };
    
    // Check for exact filename matches first
    if (baseName === 'dockerfile') return '$(docker) dockerfile-file';
    if (baseName === 'makefile') return '$(file-code) makefile-file';
    if (baseName === '.gitignore') return '$(git) gitignore-file';
    if (baseName === '.env') return '$(settings) env-file';
    
    return iconMap[ext] || '$(file) file-icon';
}

// Generar el contenido HTML del WebView
function getWebviewContent(webview: vscode.Webview, extensionPath: string, rootPath: string, treeData: { text: string, html: string }): string {
    return `<!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tree Generator</title>
        <style>
            /* VS Code Codicons font */
            @font-face {
                font-family: 'codicon';
                src: url('https://microsoft.github.io/vscode-codicons/dist/codicon.ttf') format('truetype');
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
                line-height: 1.8;
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
                display: flex;
                align-items: center;
            }
            
            .tree-file {
                margin-left: 0;
                margin-top: 2px;
                display: flex;
                align-items: center;
            }
            
            .tree-file.error {
                color: var(--vscode-errorForeground);
            }
            
            /* VS Code Codicon styling */
            .codicon {
                font-family: 'codicon', sans-serif;
                font-size: 14px;
                line-height: 1;
                display: inline-block;
                margin-right: 6px;
                vertical-align: middle;
                font-weight: normal;
                font-style: normal;
                text-align: center;
                width: 16px;
            }
            
            /* File type specific icons */
            .ts-file { color: #3178c6; }
            .js-file { color: #f7df1e; }
            .html-file { color: #e34c26; }
            .css-file { color: #563d7c; }
            .json-file { color: #cbcb41; }
            .md-file { color: #083fa1; }
            .img-file { color: #a1e44d; }
            .py-file { color: #3776ab; }
            .java-file { color: #b07219; }
            .c-file, .cpp-file { color: #555555; }
            .cs-file { color: #68217a; }
            .go-file { color: #00add8; }
            .rs-file { color: #dea584; }
            .rb-file { color: #cc342d; }
            .php-file { color: #4f5d95; }
            .swift-file { color: #fa7343; }
            .kt-file { color: #a97bff; }
            .sql-file { color: #e38c00; }
            .gitignore-file { color: #f14e32; }
            .vsix-file { color: #0066bf; }
            .zip-file { color: #b3b3b3; }
            .dockerfile-file { color: #2496ed; }
            .env-file { color: #ecd53f; }
            .lock-file { color: #808080; }
            .file-icon { color: #808080; }
            .folder-icon { color: var(--vscode-symbolIcon-folderForeground); }
            
            /* Codicon folder icons */
            .codicon.\$folder::before { content: '📁'; font-size: 14px; }
            .codicon.\$folder-open::before { content: '📂'; font-size: 14px; }
            .codicon.\$file::before { content: '📄'; font-size: 14px; }
            .codicon.\$symbol-type::before { content: '🔷'; font-size: 14px; }
            .codicon.\$symbol-numeric::before { content: '🟨'; font-size: 14px; }
            .codicon.\$code::before { content: '🌐'; font-size: 14px; }
            .codicon.\$symbol-property::before { content: '🎨'; font-size: 14px; }
            .codicon.\$json::before { content: '📋'; font-size: 14px; }
            .codicon.\$markdown::before { content: '📝'; font-size: 14px; }
            .codicon.\$image::before { content: '🖼️'; font-size: 14px; }
            .codicon.\$python::before { content: '🐍'; font-size: 14px; }
            .codicon.\$java::before { content: '☕'; font-size: 14px; }
            .codicon.\$c::before { content: '📘'; font-size: 14px; }
            .codicon.\$cpp::before { content: '📗'; font-size: 14px; }
            .codicon.\$csharp::before { content: '🎯'; font-size: 14px; }
            .codicon.\$go::before { content: '🐹'; font-size: 14px; }
            .codicon.\$rust::before { content: '🦀'; font-size: 14px; }
            .codicon.\$ruby::before { content: '💎'; font-size: 14px; }
            .codicon.\$php::before { content: '🐘'; font-size: 14px; }
            .codicon.\$swift::before { content: '🐦'; font-size: 14px; }
            .codicon.\$kotlin::before { content: '🟣'; font-size: 14px; }
            .codicon.\$database::before { content: '🗄️'; font-size: 14px; }
            .codicon.\$git::before { content: '🔀'; font-size: 14px; }
            .codicon.\$package::before { content: '📦'; font-size: 14px; }
            .codicon.\$zip::before { content: '🗜️'; font-size: 14px; }
            .codicon.\$docker::before { content: '🐳'; font-size: 14px; }
            .codicon.\$settings::before { content: '⚙️'; font-size: 14px; }
            .codicon.\$lock::before { content: '🔒'; font-size: 14px; }
            .codicon.\$terminal::before { content: '💻'; font-size: 14px; }
            .codicon.\$file-text::before { content: '📄'; font-size: 14px; }
            .codicon.\$pdf::before { content: '📕'; font-size: 14px; }
            .codicon.\$word::before { content: '📘'; font-size: 14px; }
            .codicon.\$xml::before { content: '📰'; font-size: 14px; }
            .codicon.\$yaml::before { content: '📐'; font-size: 14px; }
            .codicon.\$npm::before { content: '📦'; font-size: 14px; }
            .codicon.\$header::before { content: '📑'; font-size: 14px; }
            .codicon.\$file-code::before { content: '📝'; font-size: 14px; }
            
            .tree-container.with-icons .tree-folder .folder-icon,
            .tree-container.with-icons .tree-file .file-icon {
                display: inline-flex;
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