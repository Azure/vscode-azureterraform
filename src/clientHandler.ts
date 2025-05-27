import * as vscode from "vscode";
import { TelemetryReporter } from "@vscode/extension-telemetry";
import {
  DocumentSelector,
  Executable,
  LanguageClient,
  LanguageClientOptions,
  RevealOutputChannelOn,
  ServerOptions,
  State,
} from "vscode-languageclient/node";
import { ServerPath } from "./serverPath";
import { config } from "./vscodeUtils";
import { TelemetryFeature } from "./telemetry";

export interface TerraformLanguageClient {
  client: LanguageClient;
}

/**
 * ClientHandler maintains lifecycles of language clients
 * based on the server's capabilities
 */
export class ClientHandler {
  private tfClient: TerraformLanguageClient | undefined;

  constructor(
    private lsPath: ServerPath,
    private outputChannel: vscode.OutputChannel,
    private reporter: TelemetryReporter
  ) {}

  public async startClient(): Promise<void> {
    console.log("Starting client");

    this.tfClient = await this.createTerraformClient();
    const disposable = this.tfClient.client.start();

    this.reporter.sendRawTelemetryEvent("startClient", {
      usePathToBinary: `${this.lsPath.hasCustomBinPath()}`,
    });

    return disposable;
  }

  private async createTerraformClient(): Promise<TerraformLanguageClient> {
    const serverOptions = await this.getServerOptions();

    const documentSelector: DocumentSelector = [
      { scheme: "file", language: "terraform" },
    ];

    const clientOptions: LanguageClientOptions = {
      documentSelector: documentSelector,
      initializationFailedHandler: (error) => {
        this.reporter.sendTelemetryErrorEvent("initializationFailed", {
          err: `${error}`,
        });
        return false;
      },
      outputChannel: this.outputChannel,
      revealOutputChannelOn: RevealOutputChannelOn.Never,
    };

    const id = `terraform`;
    const client = new LanguageClient(id, serverOptions, clientOptions);

    if (vscode.env.isTelemetryEnabled) {
      client.registerFeature(new TelemetryFeature(client, this.reporter));
    }

    client.onDidChangeState((event) => {
      console.log(
        `Client: ${State[event.oldState]} --> ${State[event.newState]}`
      );
      if (event.newState === State.Stopped) {
        this.reporter.sendRawTelemetryEvent("stopClient");
      }
    });

    return { client };
  }

  private async getServerOptions(): Promise<ServerOptions> {
    const cmd = await this.lsPath.resolvedPathToBinary();
    const serverArgs = config("azureTerraform").get<string[]>(
      "languageServer.args",
      []
    );
    const executable: Executable = {
      command: cmd,
      args: serverArgs,
      options: {},
    };
    const serverOptions: ServerOptions = {
      run: executable,
      debug: executable,
    };
    this.outputChannel.appendLine(
      `Launching language server: ${cmd} ${serverArgs.join(" ")}`
    );
    return serverOptions;
  }

  public async stopClient(): Promise<void> {
    if (this.tfClient?.client === undefined) {
      return;
    }
    await this.tfClient.client.stop();
    console.log("Client stopped");
  }

  public getClient(): TerraformLanguageClient | undefined {
    return this.tfClient;
  }
}
