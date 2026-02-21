# VSCode Tree Generator

[English](./README.md)  | 日本語 | [Spanish](./README.es.md)

[![VS Code](https://img.shields.io/badge/VS%20Code-%235586A4?style=flat&logo=visual-studio-code)](https://code.visualstudio.com/) [![Version](https://img.shields.io/badge/Version-0.0.1-blue)](https://marketplace.visualstudio.com/) [![License](https://img.shields.io/badge/License-MIT-green)](LICENSE) [![Node.js](https://img.shields.io/badge/Node.js-%23339933?style=flat&logo=node.js)](https://nodejs.org/)

Visual Studio Codeの拡張機能で、プロジェクト全体のディレクトリツリー構造を生成します。ドキュメント作成、プロジェクト構造の共有、コードベースの理解に最適です。

## 機能

- **ディレクトリツリー生成**: プロジェクト内の任意のフォルダのツリー構造を作成
- **インタラクティブプロンプト**: 非表示ファイル（`.git`、`node_modules`など）を含めるかどうかを選択
- **深度設定可能**: ツリー表示の最大深度を設定可能
- **コンテキストメニュー統合**: エクスプローラーで任意のフォルダを右クリックしてツリーを生成
- **ワークスペースサポート**: フォルダが選択されていない場合はワークスペース全体で動作
- **視覚的なツリー形式**: 明確な表示に標準的なツリー記法（`├──`、`└──`、`│`）を使用

## インストール

### ソースからインストール

1. このリポジトリをクローン:
   ```bash
   git clone https://github.com/yourusername/VSCode-Tree-Github.git
   cd VSCode-Tree-Github/tree-generator
   ```

2. 依存関係をインストール:
   ```bash
   npm install
   ```

3. TypeScriptをコンパイル:
   ```bash
   npm run compile
   ```

### パッケージ化してインストール（.vsix）

拡張機能パッケージを作成してインストールするには：

1. VS Codeパッケージングツールをインストール（未インストールの場合）:
   ```bash
   npm install -g vsce
   ```

2. 拡張機能をパッケージ化:
   ```bash
   cd tree-generator
   vsce package
   ```

3. 生成された`.vsix`ファイルをインストール:
   - VS Codeを開く
   - 拡張機能に移動（`Ctrl+Shift+X`またはMacでは`Cmd+Shift+X`）
   - 右上の`...`メニューをクリック
   - "VSIXからインストール..."を選択
   - `tree-generator/tree-generator-0.0.1.vsix`に移動

### 代替インストール

コマンドラインから直接インストールできます:
```bash
code --install-extension tree-generator/tree-generator-0.0.1.vsx
```

## 使用方法

### 方法1: コンテキストメニュー

1. VS Codeエクスプローラーで任意のフォルダを右クリック
2. コンテキストメニューから**"Generar Árbol de Directorios"**を選択
3. プロンプトに従う:
   - 非表示ファイルを含めるかどうか選択（Sí/No）
   - 最大深度を入力（空欄の場合は無制限）

### 方法2: コマンドパレット

1. `Ctrl+Shift+P`（Macでは`Cmd+Shift+P`）を押す
2. "Generar Árbol de Directorios"と入力
3. Enterを押す
4. 上記と同じプロンプトに従う

### 方法3: ワークスペースルート

フォルダが選択されていない場合、拡張機能はワークスペース全体のツリーを生成します。

## 出力例

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

## 必要条件

- Visual Studio Code バージョン1.85.0以上
- Node.js 16.x以上

## 開発

### 開発環境のセットアップ

```bash
cd tree-generator
npm install
```

### 開発モードで実行

1. VS Codeで`F5`を押す
2. 拡張機能が読み込まれた新しいVS Codeウィンドウが開く
3. フォルダを右クリックして拡張機能をテスト

### 本番用にビルド

```bash
npm run vscode:prepublish
```

## プロジェクト構造

```
VSCode-Tree-Github/
├── tree-generator/
│   ├── src/
│   │   └── extension.ts      # 拡張機能のメインソースコード
│   ├── out/                  # コンパイルされたJavaScript
│   ├── package.json          # 拡張機能マニフェスト
│   └── tsconfig.json         # TypeScript設定
├── LICENSE                   # MITライセンス
└── README.md                 # このファイル
```

## コントリビューション

コントリビューションは大歓迎です！プルリクエストをお気軽に提交してください。

## ライセンス

このプロジェクトはMITライセンスの下でライセンスされています - 詳細については[LICENSE](LICENSE)ファイルを参照してください。

---

**ディレクトリツリーの生成をお楽しみください！ 🌳**
