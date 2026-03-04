import * as vscode from 'vscode';

export interface Translations {
    [key: string]: string | Translations;
}

export class I18nService {
    private currentLanguage: string;
    private translations: Map<string, Translations> = new Map();
    private packageTranslations: Map<string, any> = new Map();
    private fallbackLanguage = 'en';
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        

        const savedLanguage = context.globalState.get<string>('tree-generator.language');
        const vscodeLanguage = vscode.env.language;
        

        this.currentLanguage = savedLanguage || this.getSupportedLanguage(vscodeLanguage) || this.fallbackLanguage;
        

        this.loadTranslations();
        this.loadPackageTranslations();
    }

    
    // Carga las traducciones del package.nls.json
    private async loadPackageTranslations() {
        const languages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];
        
        for (const lang of languages) {
            try {
                const fileName = lang === 'en' ? 'package.nls.json' : `package.nls.${lang}.json`;
                const uri = vscode.Uri.joinPath(this.context.extensionUri, fileName);
                
                try {
                    const fileContent = await vscode.workspace.fs.readFile(uri);
                    const translations = JSON.parse(fileContent.toString());
                    this.packageTranslations.set(lang, translations);
                } catch (error) {

                    if (lang !== 'en') {
                        const altUri = vscode.Uri.joinPath(this.context.extensionUri, 'package.nls.json');
                        const fileContent = await vscode.workspace.fs.readFile(altUri);
                        const translations = JSON.parse(fileContent.toString());
                        this.packageTranslations.set(lang, translations);
                    }
                }
            } catch (error) {
                console.error(`Error loading package translations for ${lang}:`, error);
            }
        }
    }

    
    // Obtener idioma más cercano soportado
    private getSupportedLanguage(lang: string): string | undefined {
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


    // Carga las traducciones de todos los idiomas

    private async loadTranslations() {
        const languages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];
        
        for (const lang of languages) {
            try {
                const uri = vscode.Uri.joinPath(this.context.extensionUri, 'locales', lang, 'translation.json');
                const fileContent = await vscode.workspace.fs.readFile(uri);
                const translations = JSON.parse(fileContent.toString()) as Translations;
                this.translations.set(lang, translations);
            } catch (error) {
                console.error(`Error loading translations for ${lang}:`, error);
            }
        }
    }

    // Obtener traducción para el package.json
    public localize(key: string, ...args: string[]): string {
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

    // Obtiene traducción del package
    private getPackageTranslation(lang: string, key: string): string | undefined {
        const translations = this.packageTranslations.get(lang);
        if (!translations) return undefined;
        
        return translations[key];
    }

    // Formatea un string, con argumentos
    private formatString(str: string, args: string[]): string {
        return str.replace(/{(\d+)}/g, (match, index) => {
            return typeof args[index] !== 'undefined' ? args[index] : match;
        });
    }


    // Obtiene una traducción por clave
    public t(key: string, params?: Record<string, string | number>): string {

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

    // Obtiene una traducción anidada
    private getNestedTranslation(lang: string, key: string): string | undefined {
        const translations = this.translations.get(lang);
        if (!translations) return undefined;
        
        const keys = key.split('.');
        let current: any = translations;
        
        for (const k of keys) {
            if (current && typeof current === 'object' && k in current) {
                current = current[k];
            } else {
                return undefined;
            }
        }
        
        return typeof current === 'string' ? current : undefined;
    }

    
    // Reemplaza parámetros en la traducción
    private replaceParams(text: string, params: Record<string, string | number>): string {
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params[key]?.toString() || match;
        });
    }

    
    // Cambia el idioma actual
    public async setLanguage(lang: string): Promise<void> {
        const supportedLang = this.getSupportedLanguage(lang) || this.fallbackLanguage;
        
        if (supportedLang !== this.currentLanguage) {
            this.currentLanguage = supportedLang;
            await this.context.globalState.update('tree-generator.language', supportedLang);
            

            vscode.commands.executeCommand('tree-generator.languageChanged');
            

            vscode.window.showInformationMessage(
                this.t('messages.languageChanged'),
                this.t('messages.reloadNow'),
                this.t('messages.later')
            ).then(selection => {
                if (selection === this.t('messages.reloadNow')) {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            });
        }
    }


    // Obtiene el idioma actual
    public getCurrentLanguage(): string {
        return this.currentLanguage;
    }

    
    // Obtiene la lista de idiomas disponibles
    public getAvailableLanguages(): Array<{ code: string, name: string }> {
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