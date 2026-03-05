# TreeView Studio 🌳

[English](./README.md) | [Español](./README.es.md) | 日本語

[![VS Code](https://img.shields.io/badge/VS%20Code-%235586A4?style=flat&logo=visual-studio-code)](https://code.visualstudio.com/) [![バージョン](https://img.shields.io/badge/バージョン-0.3.2-blue)](https://marketplace.visualstudio.com/) [![ライセンス](https://img.shields.io/badge/ライセンス-MIT-green)](LICENSE) [![Node.js](https://img.shields.io/badge/Node.js-%23339933?style=flat&logo=node.js)](https://nodejs.org/)

Visual Studio Codeの拡張機能で、プロジェクト全体のディレクトリツリー構造を生成します。ドキュメント作成、プロジェクト構造の共有、コードベースの理解に最適です。

## 機能

### 主な機能
- **ディレクトリツリー生成**: プロジェクト内の任意のフォルダのツリー構造を作成
- **インタラクティブプロンプト**: 非表示ファイル（`.git`、`node_modules`など）を含めるかどうかを選択
- **深度設定可能**: ツリー表示の最大深度を設定可能
- **コンテキストメニュー統合**: エクスプローラーで任意のフォルダを右クリックしてツリーを生成
- **ワークスペースサポート**: フォルダが選択されていない場合はワークスペース全体で動作
- **視覚的なツリー形式**: 明確な表示に標準的なツリー記法（`├──`、`└──`、`│`）を使用
- **開発者をサポート**: プロジェクトの開発を支援するために寄付できるオプション

### バージョン 0.3.2 の新機能 

#### パフォーマンスとキャッシュ
- **スマートキャッシュシステム**: 高速アクセス用の自動キャッシュ
- **自動無効化**: ファイルが変更されるとキャッシュが自動的にクリア
- **手動キャッシュクリア**: 必要に応じてキャッシュをクリアするコマンド

#### 多言語サポート
- **6つの言語に対応**: 英語、スペイン語、フランス語、ドイツ語中国語、日本語
- **言語切り替え**: コマンドパレットから言語を変更
- **自動検出**: VS Codeの言語を自動的に検出

#### 強化されたUI/UX
- **リアルタイムオプションパネル**: ツリーを再生成せずに設定を変更
- **検索とフィルター**: ファイルやフォルダを素早く検索
- **すべて展開/折りたたむ**: 大きなツリーを簡単にナビゲート
- **カスタムフォント**: 好みのフォントファミリーとサイズを選択
- **折りたたみ可能なエントリ**: デフォルトでフォルダを折りたたむ

#### 💾 エクスポートと共有
- **クリップボードにコピー**: ツリー全体または選択部分をコピー
- **ファイルにエクスポート**: ツリーをテキストファイルとして保存

## インストール

### ソースからインストール

1. このリポジトリをクローン:
   ```bash
   git clone https://github.com/dignodev/treeview-studio.git
   cd treeview-studio/tree-generator
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
   - `tree-generator/tree-generator-0.3.2.vsix`に移動

### 代替インストール

コマンドラインから直接インストールできます:
```bash
code --install-extension tree-generator/tree-generator-0.3.2.vsix
```

## 使用方法

### 方法1: コンテキストメニュー

1. VS Codeエクスプローラーで任意のフォルダを右クリック
2. コンテキストメニューから**"Generate Directory Tree"**を選択
3. プロンプトに従う:
   - 非表示ファイルを含めるかどうか選択（Yes/No）
   - 最大深度を入力（空欄の場合は無制限）

### 方法2: コマンドパレット

1. `Ctrl+Shift+P`（Macでは`Cmd+Shift+P`）を押す
2. "Generate Directory Tree"または"tree-generator"と入力
3. Enterを押す
4. 上記と同じプロンプトに従う

### 方法3: 言語切り替え

1. `Ctrl+Shift+P`（Macでは`Cmd+Shift+P`）を押す
2. "Change Language"と入力
3. 好みの言語を選択
4. プロンプトに応じてVS Codeを再読み込み

### 方法4: キャッシュクリア

1. `Ctrl+Shift+P`を押す
2. "Clear Tree Cache"と入力
3. Enterを押す

## WebViewインターフェース

ツリーはインタラクティブなWebViewで表示:

- **検索バー**: リアルタイムでファイルやフォルダをフィルタリング
- **オプションパネル** :
  - 非表示ファイルの表示/非表示
  - 最大深度の調整
  - アイコンの表示/非表示
  - デフォルトでフォルダを折りたたむ
- **すべて展開** : すべてのフォルダを展開
- **すべて折りたたむ** (⇅): すべてのフォルダを折りたたむ
- **コピー** : ツリーをクリップボードにコピー
- **エクスポート** : ツリーをファイルに保存
- **統計**: パス、ファイル数、行数、サイズを表示

## 対応ファイルタイプとアイコン 

拡張機能には50以上のファイルタイプのアイコンが含まれています:

| カテゴリ | 拡張子 |
|---------|--------|
| **Web** | `.html`, `.css`, `.scss`, `.sass`, `.less` |
| **JavaScript/TypeScript** | `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs` |
| **フレームワーク** | React, Vue, Angular, Svelte, Next.js, Node.js |
| **データ** | `.json`, `.xml`, `.yaml`, `.yml`, `.toml`, `.ini` |
| **ドキュメント** | `.md`, `.txt`, `.pdf` |
| **画像** | `.png`, `.jpg`, `.jpeg`, `.svg`, `.ico`, `.gif`, `.webp` |
| **動画/音声** | `.mp4`, `.mp3`, `.wav`, `.ogg` |
| **データベース** | `.sql`, `.db`, `.sqlite`, PostgreSQL, MongoDB |
| **DevOps** | Docker, Kubernetes, Terraform |
| **プログラミング** | Python, Java, C#, Ruby, Go, Rust, Swift, Kotlin, Scala, PHP |
| **設定** | `.gitignore`, `.env`, `.npmrc` |

## 設定

VS Code設定から拡張機能をカスタマイズできます:

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

### 設定オプション

| 設定 | タイプ | デフォルト | 説明 |
|------|--------|-----------|------|
| `fontFamily` | string | Consolas, Monaco, Courier New, monospace | ツリーのフォントファミリー |
| `fontSize` | number | 13 | ツリーのフォントサイズ |
| `showIcons` | boolean | true | ファイルタイプアイコンを表示 |
| `includeHidden` | boolean | false | 非表示ファイルを含める（.git, node_modules） |
| `maxDepth` | number | 10 | ディレクトリの最大深度 |
| `collapseEntries` | boolean | false | デフォルトでフォルダを折りたたむ |

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
│   └── favico.ico
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
│   │   ├── extension.ts      # 拡張機能のメインソースコード
│   │   └── i18n.ts          # 国際化サービス
│   ├── locales/             # 翻訳ファイル
│   │   ├── en/translation.json
│   │   ├── es/translation.json
│   │   ├── fr/translation.json
│   │   ├── de/translation.json
│   │   ├── zh/translation.json
│   │   └── ja/translation.json
│   ├── resources/
│   │   ├── fonts/           # カスタムフォント
│   │   └── icons            # ファイルタイプアイコン
│   ├── out/                 # コンパイルされたJavaScript
│   ├── package.json         # 拡張機能マニフェスト
│   └── tsconfig.json       # TypeScript設定
├── LICENSE                 # MITライセンス
└── README.md              # このファイル
```

## コントリビューション

コントリビューションは大歓迎です！プルリクエストをお気軽に送信してください。

## ライセンス

このプロジェクトはMITライセンスの下でライセンスされています - 詳細については[LICENSE](LICENSE)ファイルを参照してください。

---

**ディレクトリツリーの生成をお楽しみください！ 🌳**
