/**
 * Defines our experimental capabilities provided by the client.
 */
export interface ExperimentalClientCapabilities {
  experimental: {
    telemetryVersion?: number;
  };
}

/**
 * Settings for the bundled language server, mirroring the
 * `azureTerraform.languageServer` configuration contribution in package.json.
 */
export interface LanguageServerSettings {
  external: boolean;
  pathToBinary: string;
  args: string[];
  "trace.server": "off" | "messages" | "verbose";
}

/**
 * Result returned by the language server's `ms-terraform.convertJsonToAzapi`
 * command.
 */
export interface ConvertJsonToAzapiResult {
  hclcontent: string;
}
