import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('Tree Generator extension activada');

    let disposable = vscode.commands.registerCommand('tree-generator.generateTree', async (uri: vscode.Uri) => {
        try {
            // Obtener la ruta del directorio seleccionado
            let rootPath: string;
            
            if (uri && uri.fsPath) {
                // Si se seleccionó un directorio en el explorador
                const stat = fs.statSync(uri.fsPath);
                if (stat.isDirectory()) {
                    rootPath = uri.fsPath;
                } else {
                    // Si se seleccionó un archivo, usar su directorio padre
                    rootPath = path.dirname(uri.fsPath);
                }
            } else {
                // Si no hay selección, usar el espacio de trabajo
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders) {
                    vscode.window.showErrorMessage('No hay ningún proyecto abierto');
                    return;
                }
                rootPath = workspaceFolders[0].uri.fsPath;
            }

            // Preguntar al usuario si quiere incluir archivos ocultos usando showQuickPick
            const includeHidden = await vscode.window.showQuickPick(['Sí', 'No'], {
                placeHolder: '¿Incluir archivos ocultos (como .git, node_modules)?'
            });

            // Obtener profundidad máxima
            const maxDepth = await getMaxDepth();

            // Generar el árbol
            const treeContent = await generateDirectoryTree(rootPath, {
                includeHidden: includeHidden === 'Sí',
                maxDepth: maxDepth
            });

            // Crear y mostrar el documento con el árbol
            const document = await vscode.workspace.openTextDocument({
                content: treeContent,
                language: 'plaintext'
            });
            
            await vscode.window.showTextDocument(document);
            
            vscode.window.showInformationMessage('Árbol de directorios generado correctamente');

        } catch (error) {
            vscode.window.showErrorMessage(`Error al generar el árbol: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}

// Función para obtener la profundidad máxima del usuario
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
async function generateDirectoryTree(rootPath: string, options: { includeHidden: boolean, maxDepth?: number }): Promise<string> {
    const rootName = path.basename(rootPath);
    let tree = `${rootName}/\n`;
    
    try {
        const items = await fs.promises.readdir(rootPath);
        
        // Filtrar items según opciones
        const filteredItems = items.filter(item => {
            if (!options.includeHidden && (item.startsWith('.') || item === 'node_modules')) {
                return false;
            }
            return true;
        });

        // Procesar cada item
        for (let i = 0; i < filteredItems.length; i++) {
            const item = filteredItems[i];
            const itemPath = path.join(rootPath, item);
            const isLast = i === filteredItems.length - 1;
            
            try {
                const stat = await fs.promises.stat(itemPath);
                
                if (stat.isDirectory()) {
                    tree += await processDirectory(itemPath, item, isLast, options, 1);
                } else {
                    tree += processFile(item, isLast);
                }
            } catch (error) {
                tree += `${isLast ? '└── ' : '├── '}${item} (error al acceder)\n`;
            }
        }
    } catch (error) {
        tree += `Error al leer el directorio: ${error}\n`;
    }
    
    return tree;
}

// Procesar un directorio recursivamente
async function processDirectory(
    dirPath: string, 
    dirName: string, 
    isLast: boolean, 
    options: { includeHidden: boolean, maxDepth?: number },
    depth: number
): Promise<string> {
    const prefix = isLast ? '└── ' : '├── ';
    let result = `${prefix}${dirName}/\n`;
    
    // Verificar profundidad máxima
    if (options.maxDepth && depth >= options.maxDepth) {
        return result;
    }
    
    try {
        const items = await fs.promises.readdir(dirPath);
        
        // Filtrar items
        const filteredItems = items.filter(item => {
            if (!options.includeHidden && (item.startsWith('.') || item === 'node_modules')) {
                return false;
            }
            return true;
        });

        // Procesar cada item
        for (let i = 0; i < filteredItems.length; i++) {
            const item = filteredItems[i];
            const itemPath = path.join(dirPath, item);
            const itemIsLast = i === filteredItems.length - 1;
            const newPrefix = isLast ? '    ' : '│   ';
            
            try {
                const stat = await fs.promises.stat(itemPath);
                
                if (stat.isDirectory()) {
                    const subDirResult = await processDirectory(
                        itemPath, 
                        item, 
                        itemIsLast, 
                        options,
                        depth + 1
                    );
                    // Agregar indentación a cada línea del subdirectorio
                    const subDirLines = subDirResult.split('\n');
                    for (let j = 0; j < subDirLines.length; j++) {
                        const line = subDirLines[j];
                        if (j === 0) {
                            result += line + '\n';
                        } else if (line.trim() !== '') {
                            result += newPrefix + line + '\n';
                        }
                    }
                } else {
                    result += `${newPrefix}${itemIsLast ? '└── ' : '├── '}${item}\n`;
                }
            } catch (error) {
                result += `${newPrefix}${itemIsLast ? '└── ' : '├── '}${item} (error al acceder)\n`;
            }
        }
    } catch (error) {
        result += `Error al leer el directorio: ${error}\n`;
    }
    
    return result;
}

// Procesar un archivo
function processFile(fileName: string, isLast: boolean): string {
    return `${isLast ? '└── ' : '├── '}${fileName}\n`;
}