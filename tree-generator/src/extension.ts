import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { I18nService } from './i18n';

// Función para obtener la configuración de fuente
function getFontConfig(): { fontFamily: string, fontSize: number } {
    const config = vscode.workspace.getConfiguration('tree-generator');
    const fontFamily = config.get<string>('fontFamily', 'Consolas, Monaco, Courier New, monospace');
    const fontSize = config.get<number>('fontSize', 13);
    return { fontFamily, fontSize };
}

let donationShown = false;
let i18nService: I18nService;
let extensionContext: vscode.ExtensionContext; // Almacenar contexto para iconos SVG

export function activate(context: vscode.ExtensionContext) {
    console.log('Tree Generator extension activada');
    
    // Almacenar el contexto para usarlo en la generación de iconos SVG
    extensionContext = context;
    
    // Inicializar servicio de internacionalización
    i18nService = new I18nService(context);

    // Registrar comando para cambiar idioma
    context.subscriptions.push(
        vscode.commands.registerCommand('tree-generator.changeLanguage', async () => {
            const languages = i18nService.getAvailableLanguages();
            const selected = await vscode.window.showQuickPick(
                languages.map(lang => ({
                    label: lang.name,
                    description: lang.code,
                    code: lang.code
                })),
                {
                    placeHolder: i18nService.t('ui.selectLanguage')
                }
            );
            
            if (selected) {
                await i18nService.setLanguage(selected.code);
                // El mensaje de confirmación y recarga se maneja en i18nService.setLanguage
            }
        })
    );

    // Registrar comando para cuando cambia el idioma
    context.subscriptions.push(
        vscode.commands.registerCommand('tree-generator.languageChanged', () => {
            // Actualizar paneles abiertos si es necesario
            vscode.window.showInformationMessage(i18nService.t('messages.languageChanged'));
        })
    );

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
                let stat: fs.Stats;
                try {
                    stat = fs.statSync(uri.fsPath);
                } catch (error) {
                    console.error('[Tree Generator] Error getting file stats:', error);
                    vscode.window.showErrorMessage(i18nService.t('messages.error', { error: 'Cannot access path: ' + uri.fsPath }));
                    return;
                }
                if (stat.isDirectory()) {
                    rootPath = uri.fsPath;
                } else {
                    rootPath = path.dirname(uri.fsPath);
                }
            } else {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    vscode.window.showErrorMessage(i18nService.t('messages.noProject'));
                    return;
                }
                rootPath = workspaceFolders[0].uri.fsPath;
            }

            // Limpiar la ruta de posibles caracteres especiales
            rootPath = rootPath.replace(/\t/g, '').trim();

            // Preguntar al usuario si quiere incluir archivos ocultos
            const includeHidden = await vscode.window.showQuickPick(
                [i18nService.t('options.yes'), i18nService.t('options.no')],
                {
                    placeHolder: i18nService.t('options.includeHidden')
                }
            );

            if (includeHidden === undefined) return;

            // Obtener profundidad máxima
            const maxDepth = await getMaxDepth();
            
            // Generar el árbol (por defecto con iconos)
            const treeData = await generateDirectoryTree(rootPath, {
                includeHidden: includeHidden === i18nService.t('options.yes'),
                maxDepth: maxDepth,
                showIcons: true // Por defecto mostrar iconos
            });

            // Crear y mostrar el panel WebView
            const panel = vscode.window.createWebviewPanel(
                'treeGenerator',
                i18nService.t('ui.title', { path: path.basename(rootPath) }),
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [
                        vscode.Uri.joinPath(context.extensionUri, 'resources', 'fonts'),
                        vscode.Uri.joinPath(context.extensionUri, 'resources', 'icons')
                    ]
                }
            );

            // Obtener las URIs de las fuentes para el webview
            const fontUris = {
                robotoBold: panel.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extensionUri, 'resources', 'fonts', 'Roboto-Bold.ttf')
                ),
                robotoRegular: panel.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extensionUri, 'resources', 'fonts', 'Roboto-Regular.ttf')
                ),
                ubuntuMono: panel.webview.asWebviewUri(
                    vscode.Uri.joinPath(context.extensionUri, 'resources', 'fonts', 'UbuntuMono-Regular.ttf')
                )
            };

            // Enviar los datos al WebView
            panel.webview.html = getWebviewContent(
                rootPath, 
                treeData, 
                includeHidden === i18nService.t('options.yes'), 
                true, 
                panel,
                context,
                fontUris,
                i18nService
            );

            // Manejar mensajes del WebView
            panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'refresh':
                            // Asegurarnos de que los valores booleanos se manejen correctamente
                            const newIncludeHidden = message.includeHidden === true || message.includeHidden === 'true';
                            const newMaxDepth = message.maxDepth ? parseInt(message.maxDepth) : undefined;
                            const newShowIcons = message.showIcons === true || message.showIcons === 'true';
                            
                            // Limpiar la ruta
                            const cleanRootPath = message.rootPath.replace(/\t/g, '').trim();
                            
                            // Log para validar la recepción del mensaje
                            console.log('[Tree Generator] Refresh requested:', {
                                rootPath: cleanRootPath,
                                includeHidden: newIncludeHidden,
                                maxDepth: newMaxDepth,
                                showIcons: newShowIcons
                            });
                            
                            vscode.window.showInformationMessage(i18nService.t('messages.regenerating'));
                            
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
                            vscode.window.showInformationMessage(i18nService.t('messages.copied'));
                            break;
                        case 'export':
                            const uri = await vscode.window.showSaveDialog({
                                filters: { 'Text files': ['txt'] },
                                defaultUri: vscode.Uri.file(path.join(rootPath, 'arbol.txt'))
                            });
                            if (uri) {
                                console.log('Writing to file:', uri.fsPath, 'Text:', message.text?.substring(0, 100));
                                fs.writeFileSync(uri.fsPath, message.text);
                                vscode.window.showInformationMessage(
                                    i18nService.t('messages.saved', { path: uri.fsPath })
                                );
                            }
                            break;
                        case 'copySelection':
                            await vscode.env.clipboard.writeText(message.text);
                            vscode.window.showInformationMessage(i18nService.t('messages.selectionCopied'));
                            break;
                        case 'donate':
                            vscode.commands.executeCommand('tree-generator.donate');
                            break;
                        case 'changeLanguage':
                            vscode.commands.executeCommand('tree-generator.changeLanguage');
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(
                i18nService.t('messages.error', { error: errorMessage })
            );
        }
    });

    context.subscriptions.push(disposable);

    // Mostrar mensaje de donación
    setTimeout(() => {
        if (!context.globalState.get('donationShown') && !donationShown) {
            vscode.window.showInformationMessage(
                i18nService.t('messages.donationPrompt'),
                i18nService.t('messages.donateNow'),
                i18nService.t('messages.later')
            ).then(selection => {
                if (selection === i18nService.t('messages.donateNow')) {
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
        prompt: i18nService.t('options.maxDepth'),
        placeHolder: i18nService.t('options.maxDepthPlaceholder'),
        validateInput: (value) => {
            if (value) {
                const num = parseInt(value);
                if (isNaN(num)) {
                    return i18nService.t('options.invalidNumber');
                }
                if (num < 1) {
                    return 'Depth must be at least 1';
                }
                if (num > 50) {
                    return 'Depth cannot exceed 50 levels';
                }
            }
            return null;
        }
    });
    
    return input ? parseInt(input) : undefined;
}

// Función para generar el árbol visual con formato adecuado
function generateVisualTree(rootPath: string, options: { includeHidden: boolean, maxDepth?: number, showIcons: boolean }): string {
    const rootName = path.basename(rootPath);
    const rootIcon = options.showIcons ? '📁 ' : '';
    let treeOutput = `${rootIcon}${rootName}/\n`;
    
    function processDirectory(dirPath: string, prefix: string = '', depth: number = 0): string {
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
                    const dirIcon = options.showIcons ? '📁 ' : '';
                    dirOutput += `${prefix}${connector}${dirIcon}${item.name}/\n`;
                    const newPrefix = prefix + (isLast ? '    ' : '│   ');
                    dirOutput += processDirectory(item.path, newPrefix, depth + 1);
                } else {
                    const icon = options.showIcons ? getFileIcon(item.name) + ' ' : '';
                    dirOutput += `${prefix}${connector}${icon}${item.name}\n`;
                }
            }
        } catch (error) {
            dirOutput += `${prefix}Error: ${error}\n`;
        }
        
        return dirOutput;
    }
    
    treeOutput += processDirectory(rootPath, '', 1);
    return treeOutput;
}

// Función para generar el árbol HTML con estructura colapsable
function generateCollapsibleHTML(
    rootPath: string, 
    options: { includeHidden: boolean, maxDepth?: number, showIcons: boolean },
    fontConfig: { fontFamily: string, fontSize: number },
    i18n: I18nService,
    webview: vscode.Webview,
    context: vscode.ExtensionContext
): string {
    const rootName = path.basename(rootPath);
    // Usar emoji para texto, pero para HTML usamos el SVG si está disponible
    const rootIconEmoji = options.showIcons ? '📁 ' : '';
    const rootIconSvg = options.showIcons && webview ? getFolderIconSVG(webview, context) : '';
    
    function processDirectory(dirPath: string, depth: number = 0, prefix: string = '', isLast: boolean = true): string {
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
                const isLastItem = i === itemsWithStats.length - 1;
                const connector = isLastItem ? '└── ' : '├── ';
                const itemId = `item-${depth}-${i}`;
                
                // Crear el prefijo visual para mantener la estructura del árbol
                let visualPrefix = prefix;
                
                if (item.isDirectory) {
                    // Usar emoji para texto, pero para HTML usamos el SVG
                    const dirIconEmoji = options.showIcons ? '📁 ' : '';
                    const dirIconSvg = options.showIcons && webview ? getFolderIconSVG(webview, context) : '';
                    const contentId = `content-${itemId}`;
                    
                    // Determinar el prefijo para el contenido de la carpeta
                    const contentPrefix = prefix + (isLastItem ? '    ' : '│   ');
                    
                    html += `
                        <div class="tree-item folder" data-depth="${depth}" data-path="${escapeHtml(item.path)}">
                            <div class="tree-line folder-header" onclick="toggleFolder('${contentId}', this)" data-fullpath="${escapeHtml(item.path)}">
                                <span class="prefix">${visualPrefix}</span>
                                <span class="connector">${connector}</span>
                                <span class="folder-icon ${options.showIcons ? 'visible' : 'hidden'}">${dirIconSvg || dirIconEmoji}</span>
                                <span class="folder-name">${escapeHtml(item.name)}/</span>
                                <span class="toggle-icon">▼</span>
                            </div>
                            <div class="folder-content" id="${contentId}">
                                ${processDirectory(item.path, depth + 1, contentPrefix, isLastItem)}
                            </div>
                        </div>
                    `;
                } else {
                    // Usar emoji para texto, pero para HTML usamos el SVG
                    const iconEmoji = options.showIcons ? getFileIcon(item.name) + ' ' : '';
                    const iconSvg = options.showIcons && webview ? getFileIconSVG(item.name, webview, context) : '';
                    html += `
                        <div class="tree-item file" data-depth="${depth}" data-path="${escapeHtml(item.path)}">
                            <div class="tree-line" data-fullpath="${escapeHtml(item.path)}">
                                <span class="prefix">${visualPrefix}</span>
                                <span class="connector">${connector}</span>
                                <span class="file-icon ${options.showIcons ? 'visible' : 'hidden'}">${iconSvg || iconEmoji}</span>
                                <span class="file-name">${escapeHtml(item.name)}</span>
                            </div>
                        </div>
                    `;
                }
            }
        } catch (error) {
            html += `<div class="tree-item error">Error: ${error}</div>`;
        }
        
        return html;
    }
    
    return `
        <div class="collapsible-tree" style="font-family: 'UbuntuMono', 'RobotoRegular', '${fontConfig.fontFamily}', monospace; font-size: ${fontConfig.fontSize}px;">
            <div class="tree-item root folder">
                <div class="tree-line folder-header" onclick="toggleFolder('root-content', this)">
                    <span class="root-icon ${options.showIcons ? 'visible' : 'hidden'}">${rootIconSvg || rootIconEmoji}</span>
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
function calculateDirectorySize(rootPath: string, includeHidden: boolean): number {
    let totalSize = 0;
    
    function processDirectory(dirPath: string, depth: number = 0): void {
        if (depth > 20) return; // Evitar recursion excesiva
        
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
                    } else {
                        totalSize += stat.size;
                    }
                } catch {
                    // Ignorar errores de acceso
                }
            }
        } catch {
            // Ignorar errores de lectura
        }
    }
    
    processDirectory(rootPath, 0);
    return totalSize;
}

// Función para formatear tamaño en bytes
function formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function generateDirectoryTree(rootPath: string, options: { includeHidden: boolean, maxDepth?: number, showIcons: boolean }): Promise<{ text: string, html: string, size: string }> {
    // Obtener configuración de fuente
    const fontConfig = getFontConfig();
    
    // Generar el árbol visual con formato
    const visualTree = generateVisualTree(rootPath, options);
    
    // Generar árbol HTML (sin webview - se generará en getWebviewContent)
    const collapsibleHtml = '';
    
    // Calcular el tamaño del directorio
    const directorySize = calculateDirectorySize(rootPath, options.includeHidden);
    const formattedSize = formatSize(directorySize);
    
    return { 
        text: visualTree, 
        html: collapsibleHtml,
        size: formattedSize
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

// Función para obtener el icono SVG local (para visualización HTML)
function getFileIconSVG(fileName: string, webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName).toLowerCase();
    
    // Mapeo de extensiones a nombres de archivos SVG
    const svgMap: { [key: string]: string } = {
        '.css': 'file-css',
        '.scss': 'file-css',
        '.sass': 'file-css',
        '.less': 'file-css',
        '.json': 'file-json',
        '.pdf': 'file-pdf',
        '.txt': 'file-txt',
        '.zip': 'file-zipper',
        '.tar': 'file-zipper',
        '.gz': 'file-zipper',
        '.sql': 'sql',
        '.java': 'file-java',
        '.swift': 'file-swift',
        '.py': 'python-file',
        '.php': 'php-file'
    };
    
    // Archivos especiales
    let svgName: string | undefined;
    
    if (baseName === 'dockerfile') {
        svgName = 'file-docker';
    } else if (baseName === 'gitignore' || baseName === '.gitignore') {
        svgName = 'git';
    } else if (baseName === 'package.json' || baseName === 'package-lock.json') {
        svgName = 'lock';
    } else if (baseName === 'env' || baseName === '.env' || baseName === 'makefile' || baseName === 'tsconfig.json') {
        svgName = 'settings';
    } else {
        svgName = svgMap[ext];
    }
    
    if (svgName) {
        // Usar asWebviewUri para generar una URI válida para el webview
        const resourceUri = webview.asWebviewUri(
            vscode.Uri.joinPath(context.extensionUri, 'resources', 'icons', `${svgName}.svg`)
        );
        console.log(`[Tree Generator] SVG URI (asWebviewUri): ${resourceUri}`);
        return `<img src="${resourceUri}" class="file-icon-svg" alt="">`;
    }
    
    return '';
}

// Función para obtener el icono de carpeta SVG
function getFolderIconSVG(webview: vscode.Webview, context: vscode.ExtensionContext): string {
    const resourceUri = webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, 'resources', 'icons', 'folder-open.svg')
    );
    return `<img src="${resourceUri}" class="folder-icon-svg" alt="">`;
}

// Función para escapar HTML y prevenir XSS
function escapeHtml(str: string): string {
    // Log para validar que la función está siendo utilizada
    if (str && (str.includes('<') || str.includes('>') || str.includes('"'))) {
        console.log('[Tree Generator] XSS prevention: Escaped special characters in:', str.substring(0, 50));
    }
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getWebviewContent(
    rootPath: string, 
    treeData: { text: string, html: string, size: string }, 
    includeHidden: boolean, 
    showIcons: boolean, 
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    fontUris: { robotoBold: vscode.Uri, robotoRegular: vscode.Uri, ubuntuMono: vscode.Uri },
    i18n: I18nService
): string {
    const escapedRootPath = rootPath.replace(/\\/g, '\\\\');
    const fontConfig = getFontConfig();
    const currentLang = i18n.getCurrentLanguage();
    
    // Generar el árbol HTML colapsable con webview para SVG
    const collapsibleHtml = generateCollapsibleHTML(rootPath, { includeHidden, showIcons }, fontConfig, i18n, panel.webview, context);
    
    // Traducciones para pasar al frontend
    const translations = {
        hideIcons: i18n.t('ui.hideIcons'),
        showIcons: i18n.t('ui.showIcons'),
        noSelection: i18n.t('messages.noSelection'),
        included: i18n.t('stats.included'),
        excluded: i18n.t('stats.excluded'),
        showing: i18n.t('stats.showing'),
        iconsHidden: i18n.t('stats.iconsHidden'),
        lines: i18n.t('stats.lines'),
        size: i18n.t('stats.size'),
        options: i18n.t('ui.options'),
        expandAll: i18n.t('ui.expandAll'),
        collapseAll: i18n.t('ui.collapseAll'),
        copyVisible: i18n.t('ui.copyVisible'),
        copySelection: i18n.t('ui.copySelection'),
        export: i18n.t('ui.export'),
        language: i18n.t('ui.language'),
        search: i18n.t('ui.search'),
        searchPlaceholder: i18n.t('ui.searchPlaceholder'),
        clearSearch: i18n.t('ui.clearSearch'),
        searchMatch: i18n.t('ui.searchMatch'),
        searchMatches: i18n.t('ui.searchMatches'),
        noResults: i18n.t('ui.noResults')
    };
    
    return `<!DOCTYPE html>
<html lang="${currentLang}">
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
        
        .main-content {
            flex: 1;
            min-width: 0;
        }
        
        .sidebar {
            display: flex;
            flex-direction: column;
            gap: 8px;
            padding: 10px;
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border-radius: 6px;
            flex-shrink: 0;
        }
        
        .sidebar button {
            background-color: #2E7D32;
            color: #ffffff;
            border: none;
            padding: 10px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 16px;
            transition: all 0.2s ease;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .sidebar button:hover {
            background-color: #388E3C;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }
        
        .sidebar button:active {
            background-color: #1B5E20;
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .sidebar button.active {
            background-color: #4CAF50;
            color: #ffffff;
            outline: 2px solid var(--vscode-focusBorder);
            outline-offset: 1px;
        }
        
        .header {
            display: flex;
            flex-direction: column;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .main-area {
            display: flex;
            flex: 1;
            min-width: 0;
            gap: 20px;
        }
        
        .title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .search-container {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
        }
        
        .search-input {
            flex: 1;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 13px;
            font-family: 'RobotoRegular', var(--vscode-font-family);
        }
        
        .search-input:focus {
            outline: none;
            border-color: #4CAF50;
            box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
        }
        
        .search-input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }
        
        .clear-search-btn {
            background: none;
            border: 1px solid transparent;
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            padding: 4px 8px;
            font-size: 12px;
            border-radius: 4px;
            transition: all 0.2s ease;
        }
        
        .clear-search-btn:hover {
            background-color: rgba(76, 175, 80, 0.15);
            color: #4CAF50;
        }
        
        .search-results-count {
            font-size: 12px;
            color: #4CAF50;
            padding: 4px 10px;
            background-color: rgba(76, 175, 80, 0.12);
            border-radius: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .search-results-count:hover {
            background-color: rgba(76, 175, 80, 0.2);
        }
        
        .title {
            font-size: 1.2em;
            font-weight: bold;
            font-family: 'RobotoBold', var(--vscode-font-family);
        }
        
        .controls-row {
            display: none;
        }
        
        .controls-row button {
            background-color: #2E7D32;
            color: #ffffff;
            border: none;
            padding: 6px 14px;
            cursor: pointer;
            border-radius: 4px;
            font-size: 12px;
            transition: all 0.2s ease;
            font-family: 'RobotoRegular', var(--vscode-font-family);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .controls-row button:hover {
            background-color: #388E3C;
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
        }
        
        .controls-row button:active {
            background-color: #1B5E20;
            transform: translateY(0);
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .controls-row button.active {
            background-color: #4CAF50;
            color: #ffffff;
            outline: 2px solid #81C784;
            outline-offset: 1px;
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
            background-color: #2E7D32;
            color: #ffffff;
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            border-radius: 4px;
            transition: all 0.2s ease;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }
        
        .option-group button:hover {
            background-color: #388E3C;
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
            min-height: 300px;
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
            vertical-align: middle;
        }
        
        /* Estilos para iconos SVG */
        .folder-icon-svg, .file-icon-svg {
            display: inline-block;
            width: 18px;
            height: 18px;
            vertical-align: middle;
            margin-right: 4px;
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
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            align-items: flex-start;
        }
        
        .stats-container {
            display: block;
            width: 100%;
            margin-top: 15px;
        }
        
        .stats-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            justify-content: flex-start;
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
        
        /* Search styles */
        .search-hidden {
            display: none !important;
        }
        
        .search-match {
            background-color: rgba(76, 175, 80, 0.2);
            border-radius: 3px;
            padding: 1px 3px;
            margin: -1px -3px;
            transition: background-color 0.15s ease;
        }
        
        .search-match:hover {
            background-color: rgba(76, 175, 80, 0.35);
        }
        
        .search-match .folder-name,
        .search-match .file-name,
        .search-match .root-name {
            color: #4CAF50;
            font-weight: 600;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title-row">
                <div class="title">${i18n.t('ui.title', { path: path.basename(rootPath) })}</div>
            </div>
            
            <div class="search-container">
                <input type="text" id="searchInput" class="search-input" placeholder="${i18n.t('ui.searchPlaceholder')}" autocomplete="off" aria-label="${i18n.t('ui.search')}" role="searchbox">
                <button class="clear-search-btn" onclick="clearSearch()" title="${i18n.t('ui.clearSearch')}" aria-label="${i18n.t('ui.clearSearch')}">✕</button>
                <span class="search-results-count" id="searchResultsCount"></span>
            </div>
        </div>
        
        <div class="main-area">
            <div class="main-content">
                <div class="options-panel" id="optionsPanel">
                    <div class="option-group">
                        <label>
                            <input type="checkbox" id="includeHidden" ${includeHidden ? 'checked' : ''}> 
                            ${i18n.t('options.includeHidden').replace('?', '')}
                        </label>
                        
                        <label>
                            ${i18n.t('options.maxDepth')}:
                            <input type="number" id="maxDepth" min="1" placeholder="${i18n.t('options.maxDepthPlaceholder')}" value="">
                        </label>
                        
                        <button onclick="applyOptions()">${i18n.t('ui.apply')}</button>
                        <button onclick="resetOptions()">${i18n.t('ui.reset')}</button>
                    </div>
                </div>
                
                <div class="status-message" id="statusMessage" style="display: none;">
                    <span class="loading"></span>
                    <span id="statusText">${i18n.t('messages.regenerating')}</span>
                </div>
                
                <div class="tree-container" id="treeContainer">
                    ${collapsibleHtml}
                </div>
            </div>
            
            <div class="sidebar" role="toolbar" aria-label="Tree controls">
                <button onclick="toggleOptions()" title="${i18n.t('ui.options')}" aria-label="${i18n.t('ui.options')}">⚙️</button>
                <button onclick="toggleIcons()" id="toggleIconsBtnSidebar" class="${showIcons ? 'active' : ''}" title="${showIcons ? i18n.t('ui.hideIcons') : i18n.t('ui.showIcons')}" aria-label="${showIcons ? i18n.t('ui.hideIcons') : i18n.t('ui.showIcons')}">
                    ${showIcons ? '👁️' : '👁️‍🗨️'}
                </button>
                <button onclick="expandAll()" title="${i18n.t('ui.expandAll')}" aria-label="${i18n.t('ui.expandAll')}">📂</button>
                <button onclick="collapseAll()" title="${i18n.t('ui.collapseAll')}" aria-label="${i18n.t('ui.collapseAll')}">📁</button>
                <button onclick="copyVisibleTree()" title="${i18n.t('ui.copyVisible')}" aria-label="${i18n.t('ui.copyVisible')}">📋</button>
                <button onclick="copySelection()" title="${i18n.t('ui.copySelection')}" aria-label="${i18n.t('ui.copySelection')}">✂️</button>
                <button onclick="exportToFile()" title="${i18n.t('ui.export')}" aria-label="${i18n.t('ui.export')}">💾</button>
                <button onclick="changeLanguage()" title="${i18n.t('ui.language')}" aria-label="${i18n.t('ui.language')}">🌐</button>
            </div>
        </div>
        
        <div class="stats-container">
            <div class="stats">
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">${i18n.t('stats.path')}:</span>
                        <span title="${rootPath}">${rootPath.length > 50 ? rootPath.substring(0, 47) + '...' : rootPath}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">${i18n.t('stats.hidden')}:</span>
                        <span id="hiddenStatus">${includeHidden ? i18n.t('stats.included') : i18n.t('stats.excluded')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">${i18n.t('stats.icons')}:</span>
                        <span id="iconsStatus">${showIcons ? i18n.t('stats.showing') : i18n.t('stats.hidden')}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">${i18n.t('stats.lines')}:</span>
                        <span>${(treeData.text.match(/\n/g) || []).length}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">${i18n.t('stats.size')}:</span>
                        <span>${treeData.size}</span>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <span>${i18n.t('footer.likeIt')} </span>
            <a href="#" onclick="donate()">${i18n.t('footer.buyCoffee')}</a>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        let currentTreeData = ${JSON.stringify(treeData)};
        let currentRootPath = "${escapedRootPath}";
        let currentIncludeHidden = ${includeHidden};
        let currentShowIcons = ${showIcons};
        
        // Traducciones
        const translations = ${JSON.stringify(translations)};
        
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
            // Actualizar botón del sidebar (visible con iconos)
            const sidebarBtn = document.getElementById('toggleIconsBtnSidebar');
            if (sidebarBtn) {
                sidebarBtn.className = currentShowIcons ? 'active' : '';
                sidebarBtn.title = currentShowIcons ? translations.hideIcons : translations.showIcons;
                sidebarBtn.innerHTML = currentShowIcons ? '👁️' : '👁️‍🗨️';
            }
        }
        
        function updateHiddenCheckbox() {
            document.getElementById('includeHidden').checked = currentIncludeHidden;
        }
        
        // Función para cambiar idioma
        function changeLanguage() {
            vscode.postMessage({ command: 'changeLanguage' });
        }
        
        // Función para generar texto del árbol basado en el estado actual del DOM
        function generateTreeTextFromDOM() {
            const rootElement = document.querySelector('.tree-item.root');
            if (!rootElement) {
                return '';
            }
            
            let result = '';
            
            function processElement(element, prefix = '', isLast = true) {
                // Obtener el tipo de elemento
                const isFolder = element.classList.contains('folder');
                const isFile = element.classList.contains('file');
                const isRoot = element.classList.contains('root');
                
                if (isRoot) {
                    const rootNameEl = element.querySelector('.root-name');
                    const rootName = rootNameEl?.textContent || '';
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
                vscode.window.showInformationMessage(translations.noSelection);
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
                const newCollapsibleHtml = generateCollapsibleHTML(
                    message.rootPath,
                    { includeHidden: message.includeHidden, showIcons: message.showIcons },
                    getFontConfig(),
                    i18nService,
                    panel.webview,
                    context
                );
                document.getElementById('treeContainer').innerHTML = newCollapsibleHtml;
                
                // Actualizar checkbox y botón de iconos
                document.getElementById('includeHidden').checked = currentIncludeHidden;
                updateIconsButton();
                
                // Actualizar estadísticas
                document.getElementById('hiddenStatus').textContent = currentIncludeHidden ? translations.included : translations.excluded;
                document.getElementById('iconsStatus').textContent = currentShowIcons ? translations.showing : translations.iconsHidden;
                
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
        
        // Initialize values
        document.addEventListener('DOMContentLoaded', function() {
            updateIconsButton();
            
            // Add real-time search listener
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.addEventListener('input', debounce(filterTree, 300));
                searchInput.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') {
                        clearSearch();
                    }
                });
            }
        });
        
        // Debounce function to avoid multiple consecutive searches
        function debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        }
        
        // Filter tree function
        function filterTree() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
            const resultsCountEl = document.getElementById('searchResultsCount');
            
            if (!searchTerm) {
                clearSearch();
                return;
            }
            
            let matchCount = 0;
            const treeItems = document.querySelectorAll('.tree-item');
            
            // First pass: mark all matching items and expand parents
            treeItems.forEach(item => {
                const nameEl = item.querySelector('.folder-name, .file-name, .root-name');
                if (nameEl) {
                    const name = nameEl.textContent.toLowerCase();
                    if (name.includes(searchTerm)) {
                        item.classList.remove('search-hidden');
                        item.classList.add('search-match');
                        matchCount++;
                        
                        // Expand parent folder if collapsed
                        let parent = item.parentElement;
                        while (parent) {
                            if (parent.classList.contains('folder-content')) {
                                parent.classList.remove('collapsed');
                                const header = parent.previousElementSibling;
                                if (header && header.classList.contains('folder-header')) {
                                    header.classList.remove('collapsed');
                                }
                            }
                            parent = parent.parentElement;
                        }
                    }
                }
            });
            
            // Second pass: hide non-matching items (but keep parents with matches visible)
            treeItems.forEach(item => {
                if (!item.classList.contains('search-match')) {
                    // Check if this item has any matching descendants
                    const hasMatchingDescendants = item.querySelector('.search-match');
                    if (!hasMatchingDescendants) {
                        item.classList.add('search-hidden');
                    } else {
                        // This folder has matching children, keep it visible
                        item.classList.remove('search-hidden');
                    }
                }
            });
            
            // Update results counter
            const matchText = matchCount === 1 ? translations.searchMatch || 'match' : (translations.searchMatches || 'matches');
            resultsCountEl.textContent = matchCount > 0 
                ? matchCount + ' ' + matchText 
                : translations.noResults || 'No results';
        }
        
        // Clear search function
        function clearSearch() {
            const searchInput = document.getElementById('searchInput');
            const resultsCountEl = document.getElementById('searchResultsCount');
            
            if (searchInput) {
                searchInput.value = '';
            }
            
            if (resultsCountEl) {
                resultsCountEl.textContent = '';
            }
            
            const treeItems = document.querySelectorAll('.tree-item');
            treeItems.forEach(item => {
                item.classList.remove('search-hidden', 'search-match');
            });
        }
    </script>
</body>
</html>`;
}