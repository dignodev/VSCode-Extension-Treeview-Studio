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
exports.I18nService = void 0;
const vscode = __importStar(require("vscode"));
class I18nService {
    constructor(context) {
        this.translations = new Map();
        this.packageTranslations = new Map();
        this.fallbackLanguage = 'en';
        this.context = context;

        const savedLanguage = context.globalState.get('tree-generator.language');
        const vscodeLanguage = vscode.env.language;

        this.currentLanguage = savedLanguage || this.getSupportedLanguage(vscodeLanguage) || this.fallbackLanguage;
        // Cargar traducciones
        this.loadTranslations();
        this.loadPackageTranslations();
    }

    async loadPackageTranslations() {
        const languages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];
        for (const lang of languages) {
            try {

                const fileName = lang === 'en' ? 'package.nls.json' : `package.nls.${lang}.json`;
                const uri = vscode.Uri.joinPath(this.context.extensionUri, fileName);
                try {
                    const fileContent = await vscode.workspace.fs.readFile(uri);
                    const translations = JSON.parse(fileContent.toString());
                    this.packageTranslations.set(lang, translations);
                }
                catch (error) {

                    if (lang !== 'en') {
                        const altUri = vscode.Uri.joinPath(this.context.extensionUri, 'package.nls.json');
                        const fileContent = await vscode.workspace.fs.readFile(altUri);
                        const translations = JSON.parse(fileContent.toString());
                        this.packageTranslations.set(lang, translations);
                    }
                }
            }
            catch (error) {
                console.error(`Error loading package translations for ${lang}:`, error);
            }
        }
    }

    getSupportedLanguage(lang) {
        const supportedLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];

        if (supportedLanguages.includes(lang)) {
            return lang;
        }

        const baseLang = lang.split('-')[0];
        if (supportedLanguages.includes(baseLang)) {
            return baseLang;
        }
        return undefined;
    }

    async loadTranslations() {
        const languages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];
        for (const lang of languages) {
            try {
                const uri = vscode.Uri.joinPath(this.context.extensionUri, 'locales', lang, 'translation.json');
                const fileContent = await vscode.workspace.fs.readFile(uri);
                const translations = JSON.parse(fileContent.toString());
                this.translations.set(lang, translations);
            }
            catch (error) {
                console.error(`Error loading translations for ${lang}:`, error);
            }
        }
    }

    localize(key, ...args) {

        let translation = this.getPackageTranslation(this.currentLanguage, key);

        if (!translation) {
            translation = this.getPackageTranslation(this.fallbackLanguage, key);
        }

        if (!translation) {
            return key;
        }

        if (args.length > 0) {
            return this.formatString(translation, args);
        }
        return translation;
    }

    getPackageTranslation(lang, key) {
        const translations = this.packageTranslations.get(lang);
        if (!translations)
            return undefined;
        return translations[key];
    }

    formatString(str, args) {
        return str.replace(/{(\d+)}/g, (match, index) => {
            return typeof args[index] !== 'undefined' ? args[index] : match;
        });
    }

    t(key, params) {

        let translation = this.getNestedTranslation(this.currentLanguage, key);

        if (!translation) {
            translation = this.getNestedTranslation(this.fallbackLanguage, key);
        }

        if (!translation) {
            return key;
        }

        if (params) {
            return this.replaceParams(translation, params);
        }
        return translation;
    }

    getNestedTranslation(lang, key) {
        const translations = this.translations.get(lang);
        if (!translations)
            return undefined;
        const keys = key.split('.');
        let current = translations;
        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            }
            else {
                return undefined;
            }
        }
        return typeof current === 'string' ? current : undefined;
    }

    replaceParams(text, params) {
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params[key]?.toString() || match;
        });
    }

    async setLanguage(lang) {
        const supportedLang = this.getSupportedLanguage(lang) || this.fallbackLanguage;
        if (supportedLang !== this.currentLanguage) {
            this.currentLanguage = supportedLang;
            await this.context.globalState.update('tree-generator.language', supportedLang);

            vscode.commands.executeCommand('tree-generator.languageChanged');

            vscode.window.showInformationMessage(this.t('messages.languageChanged'), this.t('messages.reloadNow'), this.t('messages.later')).then(selection => {
                if (selection === this.t('messages.reloadNow')) {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            });
        }
    }

    getCurrentLanguage() {
        return this.currentLanguage;
    }

    getAvailableLanguages() {
        return [
            { code: 'en', name: 'English' },
            { code: 'es', name: 'Español' },
            { code: 'fr', name: 'Français' },
            { code: 'de', name: 'Deutsch' },
            { code: 'zh', name: '中文' },
            { code: 'ja', name: '日本語' }
        ];
    }
}
exports.I18nService = I18nService;
