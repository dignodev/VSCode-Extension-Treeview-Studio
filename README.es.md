# TreeView Studio 🌳

[English](./README.md) | Español | [日本語](./README.ja.md)

[![VS Code](https://img.shields.io/badge/VS%20Code-%235586A4?style=flat&logo=visual-studio-code)](https://code.visualstudio.com/) [![Versión](https://img.shields.io/badge/Versión-0.3.0-blue)](https://marketplace.visualstudio.com/) [![Licencia](https://img.shields.io/badge/Licencia-MIT-green)](LICENSE) [![Node.js](https://img.shields.io/badge/Node.js-%23339933?style=flat&logo=node.js)](https://nodejs.org/)

Una extensión de Visual Studio Code que genera una visualización de árbol de directorios de tu proyecto. Perfecta para documentación, compartir la estructura del proyecto o entender la organización del código base.

## Características

### Características Principales
- **Generación de Árbol de Directorios**: Crea una estructura de árbol visual de cualquier carpeta en tu proyecto
- **Prompts Interactivos**: Pregunta si deseas incluir archivos ocultos (`.git`, `node_modules`, etc.)
- **Profundidad Configurable**: Establece la profundidad máxima para la visualización del árbol
- **Integración con Menú Contextual**: Haz clic derecho en cualquier carpeta del Explorador para generar su árbol
- **Soporte de Workspace**: Funciona con todo el workspace si no se selecciona ninguna carpeta
- **Formato de Árbol Visual**: Usa notación estándar de árbol (`├──`, `└──`, `│`) para una visualización clara
- **Apoya al Desarrollador**: Opción para donate y apoyar el desarrollo del proyecto

### Novedades en Versión 0.3.0 

#### Rendimiento y Caché
- **Sistema de Caché Inteligente**: Caché automático para un acceso más rápido
- **Invalidación Automática**: El caché se limpia automáticamente cuando los archivos cambian
- **Limpieza Manual de Caché**: Comando para limpiar el caché cuando sea necesario

#### Soporte Multilingüe
- **6 Idiomas Soportados**: Inglés, Español, Francés, Alemán, Chino, Japonés
- **Cambio de Idioma**: Cambia el idioma desde la Paleta de Comandos
- **Detección Automática**: Detecta automáticamente tu idioma de VS Code

#### UI/UX Mejorada
- **Panel de Opciones en Tiempo Real**: Cambia la configuración sin regenerar el árbol
- **Búsqueda y Filtro**: Encuentra archivos y carpetas rápidamente
- **Expandir/Contraer Todo**: Navega árboles grandes fácilmente
- **Fuentes Personalizables**: Elige tu familia y tamaño de fuente preferido
- **Entradas Contraíbles**: Comienza con las carpetas contraídas por defecto

#### Exportar y Compartir
- **Copiar al Portapapeles**: Copia el árbol completo o partes seleccionadas
- **Exportar a Archivo**: Guarda el árbol como archivo de texto

## Instalación

### Desde el Código Fuente

1. Clona este repositorio:
   ```bash
   git clone https://github.com/dignodev/treeview-studio.git
   cd treeview-studio/tree-generator
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
   - Navega a `tree-generator/tree-generator-0.3.0.vsix`

### Instalación Alternativa

También puedes instalar directamente desde la línea de comandos:
```bash
code --install-extension tree-generator/tree-generator-0.3.0.vsix
```

## Uso

### Método 1: Menú Contextual

1. Haz clic derecho en cualquier carpeta del Explorador de VS Code
2. Selecciona **"Generate Directory Tree"** del menú contextual
3. Sigue las indicaciones:
   - Elige si deseas incluir archivos ocultos (Yes/No)
   - Ingresa la profundidad máxima (dejar vacío para ilimitado)

### Método 2: Paleta de Comandos

1. Presiona `Ctrl+Shift+P` (o `Cmd+Shift+P` en Mac)
2. Escribe "Generate Directory Tree" o "tree-generator"
3. Presiona Enter
4. Sigue las mismas indicaciones que arriba

### Método 3: Cambio de Idioma

1. Presiona `Ctrl+Shift+P` (o `Cmd+Shift+P` en Mac)
2. Escribe "Change Language"
3. Selecciona tu idioma preferido
4. Recarga VS Code cuando se te pida

### Método 4: Limpiar Caché

1. Presiona `Ctrl+Shift+P`
2. Escribe "Clear Tree Cache"
3. Presiona Enter

## Interfaz WebView

El árbol se muestra en un WebView interactivo con:

- **Barra de Búsqueda**: Filtra archivos y carpetas en tiempo real
- **Panel de Opciones** :
  - Mostrar/Ocultar archivos ocultos
  - Ajustar profundidad máxima
  - Mostrar/Ocultar iconos
  - Contraer carpetas por defecto
- **Expandir Todo** : Expande todas las carpetas
- **Contraer Todo** : Contrae todas las carpetas
- **Copiar** : Copia el árbol al portapapeles
- **Exportar** : Guarda el árbol en un archivo
- **Estadísticas**: Muestra la ruta, cantidad de archivos, líneas y tamaño

## Tipos de Archivos e Iconos Soportados 

La extensión incluye iconos para más de 50 tipos de archivos, incluyendo:

| Categoría | Extensiones |
|-----------|-------------|
| **Web** | `.html`, `.css`, `.scss`, `.sass`, `.less` |
| **JavaScript/TypeScript** | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` |
| **Frameworks** | React, Vue, Angular, Svelte, Next.js, Node.js |
| **Datos** | `.json`, `.xml`, `.yaml`, `.yml`, `.toml`, `.ini` |
| **Documentos** | `.md`, `.txt`, `.pdf` |
| **Imágenes** | `.png`, `.jpg`, `.jpeg`, `.svg`, `.ico`, `.gif`, `.webp` |
| **Video/Audio** | `.mp4`, `.mp3`, `.wav`, `.ogg` |
| **Bases de Datos** | `.sql`, `.db`, `.sqlite`, PostgreSQL, MongoDB |
| **DevOps** | Docker, Kubernetes, Terraform |
| **Programación** | Python, Java, C#, Ruby, Go, Rust, Swift, Kotlin, Scala, PHP |
| **Configuración** | `.gitignore`, `.env`, `.npmrc` |

## Configuración

Puedes personalizar la extensión a través de la Configuración de VS Code:

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

### Opciones de Configuración

| Configuración | Tipo | Por Defecto | Descripción |
|---------------|------|-------------|-------------|
| `fontFamily` | string | Consolas, Monaco, Courier New, monospace | Familia de fuente para el árbol |
| `fontSize` | number | 13 | Tamaño de fuente para el árbol |
| `showIcons` | boolean | true | Mostrar iconos de tipo de archivo |
| `includeHidden` | boolean | false | Incluir archivos ocultos (.git, node_modules) |
| `maxDepth` | number | 10 | Profundidad máxima del directorio |
| `collapseEntries` | boolean | false | Iniciar con carpetas contraídas |

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
│   └── favico.ico
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
│   │   ├── extension.ts      # Código fuente principal de la extensión
│   │   └── i18n.ts          # Servicio de internacionalización
│   ├── locales/             # Archivos de traducción
│   │   ├── en/translation.json
│   │   ├── es/translation.json
│   │   ├── fr/translation.json
│   │   ├── de/translation.json
│   │   ├── zh/translation.json
│   │   └── ja/translation.json
│   ├── resources/
│   │   ├── fonts/           # Fuentes personalizadas
│   │   └── icons/           # Iconos de tipo de archivo
│   ├── out/                 # JavaScript compilado
│   ├── package.json         # Manifiesto de la extensión
│   └── tsconfig.json       # Configuración de TypeScript
├── LICENSE                 # Licencia MIT
└── README.md              # Este archivo
```

## Contribuir

¡Las contribuciones son bienvenidas! Por favor, no dudes en enviar un Pull Request.

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - consulta el archivo [LICENSE](LICENSE) para más detalles.

## Autor

Creado con ❤️ para la comunidad de VS Code.

---

**¡Disfruta generando árboles de directorios! 🌳**
