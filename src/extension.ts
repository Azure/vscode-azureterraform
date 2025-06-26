/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import { GenericResourceExpanded } from "@azure/arm-resources";
import * as _ from "lodash";
import * as vscode from "vscode";
import * as TelemetryWrapper from "vscode-extension-telemetry-wrapper";
import { listAzureResourcesGrouped, selectSubscription } from "./auth";
import { TerraformCommand } from "./shared";
import { TestOption } from "./shared";
import { ShouldShowSurvey, ShowSurvey } from "./survey";
import { ExportResourceGroup, ExportSingleResource } from "./terraformExport";
import { terraformShellManager } from "./terraformShellManager";
import { getIconForResourceType } from "./utils/icon";
import {
  getSyncFileBlobPattern,
  isTerminalSetToCloudShell,
} from "./utils/settingUtils";
import { checkTerraformInstalled } from "./utils/terraformUtils";
import { DialogOption } from "./utils/uiUtils";
import { selectWorkspaceFolder } from "./utils/workspaceUtils";
import { ClientHandler } from "./clientHandler";
import { ServerPath } from "./serverPath";
import { config } from "./vscodeUtils";
import { TelemetryReporter } from "@vscode/extension-telemetry";
import { terraformChannel } from "./terraformChannel";

let fileWatcher: vscode.FileSystemWatcher;

let reporter: TelemetryReporter;
let clientHandler: ClientHandler;

export async function activate(ctx: vscode.ExtensionContext) {
  const manifest = ctx.extension.packageJSON;
  reporter = new TelemetryReporter(manifest.appInsightsConnectionString);
  await checkTerraformInstalled();
  await TelemetryWrapper.initializeFromJsonFile(
    ctx.asAbsolutePath("./package.json")
  );
  initFileWatcher(ctx);

  const lsPath = new ServerPath(ctx);
  const outputChannel = terraformChannel.getChannel();
  clientHandler = new ClientHandler(lsPath, outputChannel, reporter);

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.init",
      () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Init);
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.plan",
      () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Plan);
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.apply",
      () => {
        terraformShellManager
          .getShell()
          .runTerraformCmd(TerraformCommand.Apply);
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.destroy",
      () => {
        terraformShellManager
          .getShell()
          .runTerraformCmd(TerraformCommand.Destroy);
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.refresh",
      () => {
        terraformShellManager
          .getShell()
          .runTerraformCmd(TerraformCommand.Refresh);
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.validate",
      () => {
        terraformShellManager
          .getShell()
          .runTerraformCmd(TerraformCommand.Validate);
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.visualize",
      async () => {
        if (isTerminalSetToCloudShell()) {
          const choice: vscode.MessageItem =
            await vscode.window.showInformationMessage(
              "Visualization only works locally. Would you like to run it in the integrated terminal?",
              DialogOption.ok,
              DialogOption.cancel
            );
          if (choice === DialogOption.cancel) {
            return;
          }
        }
        await terraformShellManager.getIntegratedShell().visualize();
      }
    )
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand("azureTerraform.exectest", async () => {
      const pick: string = await vscode.window.showQuickPick(
        [TestOption.lint, TestOption.e2e, TestOption.custom],
        { placeHolder: "Select the type of test that you want to run" }
      );
      if (!pick) {
        return;
      }
      const workingDirectory: string = await selectWorkspaceFolder();
      if (!workingDirectory) {
        return;
      }
      await terraformShellManager
        .getShell()
        .runTerraformTests(pick, workingDirectory);
    })
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.push",
      async () => {
        if (!isTerminalSetToCloudShell()) {
          vscode.window.showErrorMessage(
            "Push function only available when using cloudshell. Which is not currently supported."
          );
          return;
        }
        if (_.isEmpty(vscode.workspace.workspaceFolders)) {
          vscode.window.showInformationMessage(
            "Please open a workspace in VS Code first."
          );
          return;
        }
        await terraformShellManager
          .getCloudShell()
          .pushFiles(
            await vscode.workspace.findFiles(getSyncFileBlobPattern())
          );
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.showSurvey",
      async () => {
        await ShowSurvey();
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.selectSubscription",
      async () => {
        const subscription = await selectSubscription();
        if (subscription) {
          vscode.window.showInformationMessage(
            `Set active Azure subscription to: ${subscription.name}`
          );
        }
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.exportResource",
      async () => {
        const subscription = await selectSubscription();
        if (!subscription) {
          // Message already shown by ensureTenantAndSubscriptionSelected if cancelled/failed
          return;
        }

        // Get credential from the validated subscription object
        const credential = subscription.credential;
        if (!credential) {
          vscode.window.showErrorMessage(
            "Could not get credentials for the selected subscription."
          );
          return;
        }

        const groupedResources = await listAzureResourcesGrouped(
          credential,
          subscription.subscriptionId
        );

        if (!groupedResources || groupedResources.size === 0) {
          vscode.window.showInformationMessage(
            `No resource groups with exportable resources found in subscription "${subscription.name}".`
          );
          return;
        }

        // --- Level 1: Select Resource Group ---
        const groupPicks: Array<
          vscode.QuickPickItem & {
            groupName: string;
            resources: GenericResourceExpanded[];
            isChangeSubscription?: boolean;
          }
        > = [
          {
            label: `$(symbol-namespace) Select another subscription`,
            groupName: "",
            resources: [],
            isChangeSubscription: true,
          },
        ].concat(
          Array.from(groupedResources.entries()).map(
            ([groupName, resources]) => ({
              label: `$(symbol-namespace) ${groupName}`,
              detail: `$(location) Location: ${
                resources[0]?.location || "N/A"
              } | $(list-unordered) Resources: ${resources.length}`,
              groupName,
              resources,
              isChangeSubscription: false,
            })
          )
        );

        const selectedGroupPick = await vscode.window.showQuickPick(
          groupPicks,
          {
            placeHolder:
              "Select the Resource Group containing the resource(s) to export",
            matchOnDetail: true,
            ignoreFocusOut: true,
          }
        );

        if (!selectedGroupPick) {
          vscode.window.showInformationMessage(
            "Resource group selection cancelled."
          );
          return;
        }

        if (selectedGroupPick.isChangeSubscription) {
          await selectSubscription();
          await vscode.commands.executeCommand("azureTerraform.exportResource");
          return;
        }

        type ResourcePickItem = vscode.QuickPickItem &
          (
            | {
                resource: GenericResourceExpanded;
                isGroupExport?: false;
                isChangeSubscription?: boolean;
              }
            | {
                resource?: undefined;
                isGroupExport: true;
                isChangeSubscription?: false;
              }
          );

        const resourcePicks: ResourcePickItem[] = [
          // Option to select another subscription
          {
            label: `$(symbol-namespace) Select another subscription`,
            description: "",
            detail: "",
            resource: undefined,
            isGroupExport: false,
            isChangeSubscription: true,
          },
          // Option to export the entire group
          {
            label: `$(folder-opened) Export ALL resources in group '${selectedGroupPick.groupName}'`,
            description: `(${selectedGroupPick.resources.length} resources)`,
            detail: `Exports the entire resource group configuration.`,
            isGroupExport: true,
          },
          ...selectedGroupPick.resources.map(
            (res): ResourcePickItem => ({
              label: `${getIconForResourceType(res.type)} ${
                res.name || "Unnamed Resource"
              }`,
              description: res.type || "Unknown Type",
              detail: `$(location) Location: ${
                res.location || "N/A"
              } | $(key) ID: ${res.id || "N/A"}`,
              resource: res,
              isGroupExport: false,
            })
          ),
        ];

        const selectedResourceOrGroupPick =
          await vscode.window.showQuickPick<ResourcePickItem>(resourcePicks, {
            placeHolder: `Select a resource OR export all from group "${selectedGroupPick.groupName}"`,
            matchOnDescription: true,
            matchOnDetail: true,
            ignoreFocusOut: true,
          });

        if (!selectedResourceOrGroupPick) {
          vscode.window.showInformationMessage("Resource selection cancelled.");
          return;
        }

        if (selectedResourceOrGroupPick.isChangeSubscription) {
          await selectSubscription();
          await vscode.commands.executeCommand("azureTerraform.exportResource");
          return;
        }

        if (selectedResourceOrGroupPick.isGroupExport) {
          vscode.window.showInformationMessage(
            `Starting export for all resources in group: ${selectedGroupPick.groupName}`
          );
          const targetProvider = await promptForTargetProvider();
          await ExportResourceGroup(
            subscription,
            selectedGroupPick.resources,
            selectedGroupPick.groupName,
            targetProvider
          );
        } else if (selectedResourceOrGroupPick.resource?.id) {
          vscode.window.showInformationMessage(
            `Starting export for resource: ${selectedResourceOrGroupPick.resource.name}`
          );
          const targetProvider = await promptForTargetProvider();
          await ExportSingleResource(
            subscription,
            selectedResourceOrGroupPick.resource,
            targetProvider
          );
        } else {
          vscode.window.showErrorMessage(
            "Invalid selection or the selected resource is missing a required ID."
          );
        }
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.enableLanguageServer",
      async () => {
        if (!enabled()) {
          const currentConfig: any =
            config("azureTerraform").get("languageServer");
          currentConfig.external = true;
          await config("azureTerraform").update(
            "languageServer",
            currentConfig,
            vscode.ConfigurationTarget.Global
          );
          startLanguageServer();
        }
      }
    )
  );

  ctx.subscriptions.push(
    TelemetryWrapper.instrumentOperationAsVsCodeCommand(
      "azureTerraform.disableLanguageServer",
      async () => {
        if (enabled()) {
          const currentConfig: any =
            config("azureTerraform").get("languageServer");
          currentConfig.external = false;
          await config("azureTerraform").update(
            "languageServer",
            currentConfig,
            vscode.ConfigurationTarget.Global
          );
          stopLanguageServer();
        }
      }
    )
  );

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(
      async (event: vscode.ConfigurationChangeEvent) => {
        if (event.affectsConfiguration("azureTerraform.languageServer")) {
          const reloadMsg =
            "Reload VSCode window to apply language server changes";
          const selected = await vscode.window.showInformationMessage(
            reloadMsg,
            "Reload"
          );
          if (selected === "Reload") {
            vscode.commands.executeCommand("workbench.action.reloadWindow");
          }
        }
      }
    )
  );

  ctx.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(
      async (event: vscode.TextDocumentChangeEvent) => {
        if (event.document.languageId !== "terraform") {
          return;
        }

        const lsClient = clientHandler.getClient();
        if (!lsClient) {
          return;
        }

        const editor = vscode.window.activeTextEditor;
        if (
          event.reason !== vscode.TextDocumentChangeReason.Redo &&
          event.reason !== vscode.TextDocumentChangeReason.Undo &&
          event.document === editor?.document &&
          event.contentChanges.length === 1
        ) {
          const contentChange = event.contentChanges[0];

          // Ignore deletions and trivial changes
          if (
            contentChange.text.length < 2 ||
            isEmptyOrWhitespace(contentChange.text)
          ) {
            return;
          }

          const clipboardText = await vscode.env.clipboard.readText();

          if (!areEqualIgnoringWhitespace(contentChange.text, clipboardText)) {
            return;
          }

          try {
            const result: any = await lsClient.client.sendRequest(
              "workspace/executeCommand",
              {
                command: "ms-terraform.convertJsonToAzapi",
                arguments: [`jsonContent=${clipboardText}`],
              }
            );

            await editor.edit((editBuilder) => {
              const startPoint = contentChange.range.start;
              const endPoint = editor.selection.active;
              const replaceRange = new vscode.Range(startPoint, endPoint);
              editBuilder.replace(replaceRange, result.hclcontent);
            });
          } catch (error) {
            outputChannel.appendLine(
              `Error converting JSON to AzApi: ${error}`
            );
          }
        }
      }
    )
  );

  if (enabled()) {
    startLanguageServer();
  }

  if (await ShouldShowSurvey()) {
    await ShowSurvey();
  }
}

async function promptForTargetProvider(): Promise<string> {
  const providerPicks: vscode.QuickPickItem[] = [
    { label: "azurerm", description: "AzureRM Provider" },
    { label: "azapi", description: "Azure API Provider" },
  ];

  const selectedProvider = await vscode.window.showQuickPick(providerPicks, {
    placeHolder: "Select the target provider for the export",
    ignoreFocusOut: true,
  });

  return selectedProvider ? selectedProvider.label : "azurerm";
}

export function deactivate(): void {
  terraformShellManager.dispose();
  if (fileWatcher) {
    fileWatcher.dispose();
  }

  if (clientHandler) {
    clientHandler.stopClient();
  }
}

function initFileWatcher(ctx: vscode.ExtensionContext): void {
  fileWatcher = vscode.workspace.createFileSystemWatcher(
    getSyncFileBlobPattern()
  );
  ctx.subscriptions.push(
    fileWatcher.onDidDelete((deletedUri) => {
      if (isTerminalSetToCloudShell()) {
        terraformShellManager.getCloudShell().deleteFiles([deletedUri]);
      }
    })
  );
}

async function startLanguageServer() {
  try {
    await clientHandler.startClient();
  } catch (error) {
    console.log(error); // for test failure reporting
    reporter.sendTelemetryErrorEvent("startLanguageServer", {
      err: `${error}`,
    });
    if (error instanceof Error) {
      vscode.window.showErrorMessage(
        error instanceof Error ? error.message : error
      );
    } else if (typeof error === "string") {
      vscode.window.showErrorMessage(error);
    }
  }
}

async function stopLanguageServer() {
  try {
    await clientHandler.stopClient();
  } catch (error) {
    console.log(error); // for test failure reporting
    reporter.sendTelemetryErrorEvent("stopLanguageServer", {
      err: `${error}`,
    });
    if (error instanceof Error) {
      vscode.window.showErrorMessage(
        error instanceof Error ? error.message : error
      );
    } else if (typeof error === "string") {
      vscode.window.showErrorMessage(error);
    }
  }
}

function enabled(): boolean {
  return config("azureTerraform").get("languageServer.external", true);
}

function isEmptyOrWhitespace(s: string): boolean {
  return /^\s*$/.test(s);
}

function areEqualIgnoringWhitespace(a: string, b: string): boolean {
  return removeWhitespace(a) === removeWhitespace(b);
}

function removeWhitespace(s: string): string {
  return s.replace(/\s*/g, "");
}
