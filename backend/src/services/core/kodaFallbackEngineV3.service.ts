/**
 * @file kodaFallbackEngineV3.service.ts
 * @description
 * This service provides a JSON-based fallback generation engine.
 * It loads fallback templates from a JSON file (fallbacks.json),
 * supports multilingual responses, style-aware formatting,
 * and generates 1-2 part structured fallback responses.
 *
 * The engine selects a fallback scenario, picks the appropriate style,
 * replaces placeholders with provided values, and returns a fully formatted response.
 *
 * The design ensures robustness, extensibility, and production readiness.
 */

import fs from 'fs';
import path from 'path';

/**
 * Interface representing the structure of a fallback template part.
 */
interface FallbackPart {
  text: string;
}

/**
 * Interface representing the structure of a fallback scenario in a specific language.
 * Each scenario contains one or two parts.
 */
interface FallbackScenarioLang {
  parts: FallbackPart[];
}

/**
 * Interface representing the styles available for a fallback scenario in a specific language.
 */
interface FallbackScenarioStyles {
  [styleName: string]: FallbackScenarioLang;
}

/**
 * Interface representing the fallback scenarios for a specific language.
 */
interface FallbackLanguageScenarios {
  [scenarioName: string]: FallbackScenarioStyles;
}

/**
 * Interface representing the entire fallback JSON structure.
 * Top level keys are language codes (e.g., 'en', 'fr').
 */
interface FallbacksJson {
  [languageCode: string]: FallbackLanguageScenarios;
}

/**
 * Options for generating a fallback response.
 */
interface GenerateFallbackOptions {
  language: string; // Language code, e.g., 'en', 'fr'
  scenario: string; // Scenario name, e.g., 'default', 'timeout'
  style?: string;   // Style name, e.g., 'formal', 'casual'. Optional, defaults to 'default'
  placeholders?: Record<string, string>; // Placeholder key-value pairs to replace in text
}

/**
 * The structure of the generated fallback response.
 */
interface FallbackResponse {
  parts: string[]; // Array of 1 or 2 formatted parts
}

/**
 * Service class responsible for loading fallbacks.json and generating fallback responses.
 */
export class KodaFallbackEngineV3Service {
  private fallbacks: FallbacksJson;

  /**
   * Creates an instance of KodaFallbackEngineV3Service.
   * Loads and parses the fallbacks.json file synchronously on initialization.
   * Throws an error if the file cannot be loaded or parsed.
   *
   * @param fallbackFilePath - Optional path to the fallbacks.json file. Defaults to './fallbacks.json' relative to this file.
   */
  constructor(fallbackFilePath?: string) {
    const filePath = fallbackFilePath ?? path.resolve(__dirname, 'fallbacks.json');
    this.fallbacks = this.loadFallbacksFile(filePath);
  }

  /**
   * Loads and parses the fallbacks.json file.
   *
   * @param filePath - Absolute path to the fallbacks.json file.
   * @returns Parsed fallbacks JSON object.
   * @throws Error if file cannot be read or JSON is invalid.
   */
  private loadFallbacksFile(filePath: string): FallbacksJson {
    try {
      const fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
      const parsed: unknown = JSON.parse(fileContent);

      // Validate top-level structure is an object
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('Fallbacks JSON root is not an object');
      }

      return parsed as FallbacksJson;
    } catch (error) {
      throw new Error(`Failed to load or parse fallbacks.json at ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Generates a fallback response based on the provided options.
   * Selects the scenario and style, replaces placeholders, and returns formatted parts.
   *
   * @param options - Options including language, scenario, style, and placeholders.
   * @returns A FallbackResponse containing 1 or 2 parts.
   * @throws Error if language, scenario, or style is not found or invalid.
   */
  public generateFallback(options: GenerateFallbackOptions): FallbackResponse {
    const { language, scenario, style = 'default', placeholders = {} } = options;

    // Validate language exists
    const languageScenarios = this.fallbacks[language];
    if (!languageScenarios) {
      throw new Error(`Fallback language '${language}' not found`);
    }

    // Validate scenario exists
    const scenarioStyles = languageScenarios[scenario];
    if (!scenarioStyles) {
      throw new Error(`Fallback scenario '${scenario}' not found for language '${language}'`);
    }

    // Validate style exists
    const scenarioLang = scenarioStyles[style];
    if (!scenarioLang) {
      throw new Error(`Fallback style '${style}' not found for scenario '${scenario}' and language '${language}'`);
    }

    // Validate parts array exists and has 1 or 2 parts
    const parts = scenarioLang.parts;
    if (!Array.isArray(parts) || parts.length === 0 || parts.length > 2) {
      throw new Error(`Fallback parts for scenario '${scenario}', style '${style}', language '${language}' must be an array of 1 or 2 parts`);
    }

    // Replace placeholders in each part's text
    const formattedParts = parts.map((part) => this.replacePlaceholders(part.text, placeholders));

    return { parts: formattedParts };
  }

  /**
   * Replaces placeholders in the given text with corresponding values from the placeholders object.
   * Placeholders are denoted by {{key}} in the text.
   * If a placeholder key is not found in the placeholders object, it is replaced with an empty string.
   *
   * @param text - The text containing placeholders.
   * @param placeholders - Key-value pairs for replacement.
   * @returns The text with placeholders replaced.
   */
  private replacePlaceholders(text: string, placeholders: Record<string, string>): string {
    return text.replace(/{{\s*([^{}\s]+)\s*}}/g, (match, key) => {
      if (Object.prototype.hasOwnProperty.call(placeholders, key)) {
        return placeholders[key];
      }
      // If placeholder key not found, replace with empty string to avoid leaking placeholders
      return '';
    });
  }
}
