# VSCode Tree Generator

[English](./README.md)  | [日本語](./README.jp.md) | Spanish

[![VS Code](https://img.shields.io/badge/VS%20Code-%235586A4?style=flat&logo=visual-studio-code)](https://code.visualstudio.com/) [![Versión](https://img.shields.io/badge/Versión-0.0.1-blue)](https://marketplace.visualstudio.com/) [![Licencia](https://img.shields.io/badge/Licencia-MIT-green)](LICENSE) [![Node.js](https://img.shields.io/badge/Node.js-%23339933?style=flat&logo=node.js)](https://nodejs.org/)

Una extensión de Visual Studio Code que genera una visualización de árbol de directorios de tu proyecto. Perfecta para documentación, compartir la estructura del proyecto o entender la organización del código base.

## Características

- **Generación de Árbol de Directorios**: Crea una estructura de árbol visual de cualquier carpeta en tu proyecto
- **Prompts Interactivos**: Pregunta si deseas incluir archivos ocultos (`.git`, `node_modules`, etc.)
- **Profundidad Configurable**: Establece la profundidad máxima para la visualización del árbol
- **Integración con Menú Contextual**: Haz clic derecho en cualquier carpeta del Explorador para generar su árbol
- **Soporte de Workspace**: Funciona con todo el workspace si no se selecciona ninguna carpeta
- **Formato de Árbol Visual**: Usa notación estándar de árbol (`├──`, `└──`, `│`) para una visualización clara

## Instalación

### Desde el Código Fuente

1. Clona este repositorio:
   ```bash
   git clone https://github.com/yourusername/VSCode-Tree-Github.git
   cd VSCode-Tree-Github/tree-generator
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Compila TypeScript:
   ```bash
   npm run compile
   ```

### Empaquetar e Instalar (.vsix)

Para crear e instalar el paquete de la extensión:

1. Instala la herramienta de empaquetado de VS Code (si no está instalada):
   ```bash
   npm install -g vsce
   ```

2. Empaqueta la extensión:
   ```bash
   cd tree-generator
   vsce package
   ```

3. Instala el archivo `.vsix` generado:
   - Abre VS Code
   - Ve a Extensiones (`Ctrl+Shift+X` o `Cmd+Shift+X` en Mac)
   - Haz clic en el menú `...` en la esquina superior derecha
   - Selecciona "Instalar desde VSIX..."
   - Navega a `tree-generator/tree-generator-0.0.1.vsix`

### Instalación Alternativa

También puedes instalar directamente desde la línea de comandos:
```bash
code --install-extension tree-generator/tree-generator-0.0.1.vsx
```

## Uso

### Método 1: Menú Contextual

1. Haz clic derecho en cualquier carpeta del Explorador de VS Code
2. Selecciona **"Generar Árbol de Directorios"** del menú contextual
3. Sigue las indicaciones:
   - Elige si deseas incluir archivos ocultos (Sí/No)
   - Ingresa la profundidad máxima (dejar vacío para ilimitado)

### Método 2: Paleta de Comandos

1. Presiona `Ctrl+Shift+P` (o `Cmd+Shift+P` en Mac)
2. Escribe "Generar Árbol de Directorios"
3. Presiona Enter
4. Sigue las mismas indicaciones que arriba

### Método 3: Raíz del Workspace

Si no se selecciona ninguna carpeta, la extensión generará un árbol de todo el workspace.

## Ejemplo de Salida

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

## Requisitos

- Visual Studio Code versión 1.85.0 o superior
- Node.js 16.x o superior

## Desarrollo

### Configurar Entorno de Desarrollo

```bash
cd tree-generator
npm install
```

### Ejecutar en Modo Desarrollo

1. Presiona `F5` en VS Code
2. Se abrirá una nueva ventana de VS Code con la extensión cargada
3. Prueba la extensión haciendo clic derecho en una carpeta

### Compilar para Producción

```bash
npm run vscode:prepublish
```

## Estructura del Proyecto

```
VSCode-Tree-Github/
├── tree-generator/
│   ├── src/
│   │   └── extension.ts      # Código fuente principal de la extensión
│   ├── out/                  # JavaScript compilado
│   ├── package.json          # Manifiesto de la extensión
│   └── tsconfig.json         # Configuración de TypeScript
├── LICENSE                   # Licencia MIT
└── README.md                # Este archivo
```

## Contribuir

¡Las contribuciones son bienvenidas! Por favor, no dudes en enviar un Pull Request.

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - consulta el archivo [LICENSE](LICENSE) para más detalles.

## Autor

Creado con ❤️ para la comunidad de VS Code.

---

**¡Disfruta generando árboles de directorios! 🌳**
