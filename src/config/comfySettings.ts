import log from 'electron-log/main';
import fs from 'node:fs/promises';
import path from 'node:path';

export const DEFAULT_SETTINGS: ComfySettingsData = {
  'Comfy-Desktop.AutoUpdate': true,
  'Comfy-Desktop.SendStatistics': true,
  'Comfy.ColorPalette': 'dark',
  'Comfy.UseNewMenu': 'Top',
  'Comfy.Workflow.WorkflowTabsPosition': 'Topbar',
  'Comfy.Workflow.ShowMissingModelsWarning': true,
  'Comfy.Server.LaunchArgs': {},
  'Comfy-Desktop.UV.PythonInstallMirror': '',
  'Comfy-Desktop.UV.PypiInstallMirror': '',
  'Comfy-Desktop.UV.TorchInstallMirror': '',
} as const;

export interface ComfySettingsData {
  'Comfy-Desktop.AutoUpdate': boolean;
  'Comfy-Desktop.SendStatistics': boolean;
  'Comfy.ColorPalette': 'dark' | 'light';
  'Comfy.UseNewMenu': 'Top' | 'Bottom';
  'Comfy.Workflow.WorkflowTabsPosition': 'Topbar' | 'Sidebar';
  'Comfy.Workflow.ShowMissingModelsWarning': boolean;
  'Comfy.Server.LaunchArgs': Record<string, string>;
  'Comfy-Desktop.UV.PythonInstallMirror': string;
  'Comfy-Desktop.UV.PypiInstallMirror': string;
  'Comfy-Desktop.UV.TorchInstallMirror': string;
  [key: string]: unknown;
}

/** Backing ref for the singleton settings instance. */
let current: ComfySettings;

/** Service locator for settings. ComfySettings.load() must be called before access. */
export function useComfySettings() {
  if (!current) throw new Error('Cannot access ComfySettings before initialization.');
  return current;
}

/**
 * A read-only interface to an in-memory cache of frontend settings.
 * @see {@link ComfySettings} concrete implementation
 */
export interface FrontendSettingsCache {
  /**
   * Gets a setting from the copy of settings stored in memory.
   * @param key The key of the setting to get.
   * @returns The value of the setting.
   */
  get<K extends keyof ComfySettingsData>(key: K): ComfySettingsData[K];
}

/**
 * A read-write interface to an in-memory cache of frontend settings.
 *
 * Changes may be persisted to disk by calling {@link saveSettings}.
 * @see {@link ComfySettings} concrete implementation
 */
export interface IComfySettings extends FrontendSettingsCache {
  /**
   * Sets the value of a setting in memory - does not persist to disk.
   * @see {@link saveSettings}
   * @param key The key of the setting to set.
   * @param value The value to set the setting to.
   */
  set<K extends keyof ComfySettingsData>(key: K, value: ComfySettingsData[K]): void;
  /**
   * Overwrites the settings file on disk with the copy of settings in memory.
   * Can only be called before the ComfyUI server starts.
   * @throws Error if called after the ComfyUI server has started
   */
  saveSettings(): Promise<void>;
}

/**
 * ComfySettings is a class that loads settings from the comfy.settings.json file.
 *
 * This file is exclusively written to by the ComfyUI server once it starts.
 * The Electron process can only write to this file during initialization, before
 * the ComfyUI server starts.
 *
 * @see {@link FrontendSettingsCache} read-only interface
 * @see {@link IComfySettings} read-write interface
 */
export class ComfySettings implements IComfySettings {
  private settings: ComfySettingsData = structuredClone(DEFAULT_SETTINGS);
  private static writeLocked = false;
  readonly #basePath: string;

  private constructor(basePath: string) {
    this.#basePath = basePath;
  }

  /**
   * Locks the settings to prevent further modifications.
   * Called when the ComfyUI server starts, as it takes ownership of the settings file.
   */
  static lockWrites() {
    ComfySettings.writeLocked = true;
  }

  get filePath(): string {
    return path.join(this.#basePath, 'user', 'default', 'comfy.settings.json');
  }

  private async loadSettings() {
    try {
      await fs.access(this.filePath);
    } catch {
      log.info(`Settings file ${this.filePath} does not exist. Using default settings.`);
      return;
    }
    try {
      const fileContent = await fs.readFile(this.filePath, 'utf8');
      // TODO: Reimplement with validation and error reporting.
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      this.settings = { ...this.settings, ...JSON.parse(fileContent) };
    } catch (error) {
      if (error instanceof SyntaxError) {
        log.error(`Settings file contains invalid JSON:`, error);
      } else {
        log.error(`Settings file cannot be loaded.`, error);
      }
    }
  }

  async saveSettings() {
    if (!this.settings) return;

    if (ComfySettings.writeLocked) {
      const error = new Error('Settings are locked and cannot be modified');
      log.error(error);
      throw error;
    }

    try {
      await fs.writeFile(this.filePath, JSON.stringify(this.settings, null, 2));
    } catch (error) {
      log.error('Failed to save settings:', error);
      throw error;
    }
  }

  set<K extends keyof ComfySettingsData>(key: K, value: ComfySettingsData[K]) {
    if (ComfySettings.writeLocked) {
      throw new Error('Settings are locked and cannot be modified');
    }
    this.settings[key] = value;
  }

  get<K extends keyof ComfySettingsData>(key: K): ComfySettingsData[K] {
    return this.settings[key] ?? DEFAULT_SETTINGS[key];
  }

  /**
   * Static factory method. Loads the settings from disk.
   * @param basePath The base path where ComfyUI is installed
   * @returns The newly created instance
   */
  static async load(basePath: string): Promise<ComfySettings> {
    const instance = new ComfySettings(basePath);
    await instance.loadSettings();
    current = instance;
    return instance;
  }
}
