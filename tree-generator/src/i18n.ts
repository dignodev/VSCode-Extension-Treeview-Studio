import * as vscode from 'vscode';

export interface Translations {
    [key: string]: string | Translations;
}

export class I18nService {
    private currentLanguage: string;
    private translations: Map<string, Translations> = new Map();
    private fallbackLanguage = 'en';
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        
        // Cargar idioma guardado o detectar de VSCode
        const savedLanguage = context.globalState.get<string>('tree-generator.language');
        const vscodeLanguage = vscode.env.language;
        
        // Prioridad: idioma guardado > idioma de VSCode > inglés
        this.currentLanguage = savedLanguage || this.getSupportedLanguage(vscodeLanguage) || this.fallbackLanguage;
        
        // Cargar traducciones
        this.loadTranslations();
    }

    /**
     * Obtiene el idioma más cercano soportado
     */
    private getSupportedLanguage(lang: string): string | undefined {
        const supportedLanguages = ['en', 'es', 'fr', 'de', 'zh', 'ja'];
        
        // Si es exacto
        if (supportedLanguages.includes(lang)) {
            return lang;
        }
        
        // Si es con región (ej: es-ES, es-MX)
        const baseLang = lang.split('-')[0];
        if (supportedLanguages.includes(baseLang)) {
            return baseLang;
        }
        
        return undefined;
    }

    /**
     * Carga las traducciones de todos los idiomas
     */
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

    /**
     * Obtiene una traducción por clave
     */
    public t(key: string, params?: Record<string, string | number>): string {
        // Buscar en el idioma actual
        let translation = this.getNestedTranslation(this.currentLanguage, key);
        
        // Si no existe, buscar en inglés
        if (!translation) {
            translation = this.getNestedTranslation(this.fallbackLanguage, key);
        }
        
        // Si aún no existe, devolver la clave
        if (!translation) {
            return key;
        }
        
        // Reemplazar parámetros
        if (params) {
            return this.replaceParams(translation, params);
        }
        
        return translation;
    }

    /**
     * Obtiene una traducción anidada
     */
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

    /**
     * Reemplaza parámetros en la traducción
     */
    private replaceParams(text: string, params: Record<string, string | number>): string {
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
            return params[key]?.toString() || match;
        });
    }

    /**
     * Cambia el idioma actual
     */
    public async setLanguage(lang: string): Promise<void> {
        const supportedLang = this.getSupportedLanguage(lang) || this.fallbackLanguage;
        
        if (supportedLang !== this.currentLanguage) {
            this.currentLanguage = supportedLang;
            await this.context.globalState.update('tree-generator.language', supportedLang);
            
            // Notificar cambio de idioma
            vscode.commands.executeCommand('tree-generator.languageChanged');
        }
    }

    /**
     * Obtiene el idioma actual
     */
    public getCurrentLanguage(): string {
        return this.currentLanguage;
    }

    /**
     * Obtiene la lista de idiomas disponibles
     */
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