/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import { GenericResourceExpanded } from "@azure/arm-resources";
import * as _ from "lodash";
import * as vscode from "vscode";
import * as TelemetryWrapper from "vscode-extension-telemetry-wrapper";
import { Executable, LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";
import { listAzureResourcesGrouped, selectSubscription } from "./auth";
import { TerraformCommand } from "./shared";
import { TestOption } from "./shared";
import { ShouldShowSurvey, ShowSurvey } from "./survey";
import { ExportResourceGroup, ExportSingleResource } from "./terraformExport";
import { terraformShellManager } from "./terraformShellManager";
import {getIconForResourceType} from "./utils/icon";
import { getSyncFileBlobPattern, isTerminalSetToCloudShell } from "./utils/settingUtils";
import { checkTerraformInstalled } from "./utils/terraformUtils";
import { DialogOption } from "./utils/uiUtils";
import { selectWorkspaceFolder } from "./utils/workspaceUtils";

let fileWatcher: vscode.FileSystemWatcher;
let lspClient: LanguageClient;

export async function activate(ctx: vscode.ExtensionContext) {
    await checkTerraformInstalled();
    await TelemetryWrapper.initializeFromJsonFile(ctx.asAbsolutePath("./package.json"));
    initFileWatcher(ctx);

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.init", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Init);
    }));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.plan", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Plan);
    }));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.apply", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Apply);
    }));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.destroy", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Destroy);
    }));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.refresh", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Refresh);
    }));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.validate", () => {
        terraformShellManager.getShell().runTerraformCmd(TerraformCommand.Validate);
    }));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.visualize", async () => {
        if (isTerminalSetToCloudShell()) {
            const choice: vscode.MessageItem = await vscode.window.showInformationMessage(
                "Visualization only works locally. Would you like to run it in the integrated terminal?",
                DialogOption.ok,
                DialogOption.cancel,
            );
            if (choice === DialogOption.cancel) {
                return;
            }
        }
        await terraformShellManager.getIntegratedShell().visualize();
    }));

    ctx.subscriptions.push(vscode.commands.registerCommand("azureTerraform.exectest", async () => {
        const pick: string = await vscode.window.showQuickPick(
            [TestOption.lint, TestOption.e2e, TestOption.custom],
            {placeHolder: "Select the type of test that you want to run"},
        );
        if (!pick) {
            return;
        }
        const workingDirectory: string = await selectWorkspaceFolder();
        if (!workingDirectory) {
            return;
        }
        await terraformShellManager.getShell().runTerraformTests(pick, workingDirectory);
    }));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.push", async () => {
        if (!isTerminalSetToCloudShell()) {
            vscode.window.showErrorMessage("Push function only available when using cloudshell. Which is not currently supported.");
            return;
        }
        if (_.isEmpty(vscode.workspace.workspaceFolders)) {
            vscode.window.showInformationMessage("Please open a workspace in VS Code first.");
            return;
        }
        await terraformShellManager.getCloudShell().pushFiles(await vscode.workspace.findFiles(getSyncFileBlobPattern()));
    }));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.showSurvey", async () => {
        await ShowSurvey();
    }));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.selectSubscription", async () => {
        const subscription = await selectSubscription();
        if (subscription) {
             vscode.window.showInformationMessage(`Set active Azure subscription to: ${subscription.name}`);
        }
    }));

    ctx.subscriptions.push(TelemetryWrapper.instrumentOperationAsVsCodeCommand("azureTerraform.exportResource", async () => {
        const subscription = await selectSubscription();
        if (!subscription) {
            // Message already shown by ensureTenantAndSubscriptionSelected if cancelled/failed
            return;
        }

        // Get credential from the validated subscription object
        const credential = subscription.credential;
        if (!credential) {
             vscode.window.showErrorMessage("Could not get credentials for the selected subscription.");
             return;
        }

        const groupedResources = await listAzureResourcesGrouped(credential, subscription.subscriptionId);

        if (!groupedResources || groupedResources.size === 0) {
            vscode.window.showInformationMessage(`No resource groups with exportable resources found in subscription "${subscription.name}".`);
            return;
        }

        // --- Level 1: Select Resource Group ---
        const groupPicks: Array<vscode.QuickPickItem & { groupName: string; resources: GenericResourceExpanded[]; isChangeSubscription?: boolean }> =
            [
                {
                    label: `$(symbol-namespace) Select another subscription`,
                    groupName: "",
                    resources: [],
                    isChangeSubscription: true,
                },
            ].concat(
                Array.from(groupedResources.entries()).map(([groupName, resources]) => ({
                    label: `$(symbol-namespace) ${groupName}`,
                    detail: `$(location) Location: ${resources[0]?.location || "N/A"} | $(list-unordered) Resources: ${resources.length}`,
                    groupName,
                    resources,
                    isChangeSubscription: false,
                })),
        );

        const selectedGroupPick = await vscode.window.showQuickPick(groupPicks, {
            placeHolder: "Select the Resource Group containing the resource(s) to export",
            matchOnDetail: true,
            ignoreFocusOut: true,
        });

        if (!selectedGroupPick) {
            vscode.window.showInformationMessage("Resource group selection cancelled.");
            return;
        }

        if (selectedGroupPick.isChangeSubscription) {
            await selectSubscription();
            await vscode.commands.executeCommand("azureTerraform.exportResource");
            return;
        }

        type ResourcePickItem = vscode.QuickPickItem & ({ resource: GenericResourceExpanded; isGroupExport?: false; isChangeSubscription?: boolean } | { resource?: undefined; isGroupExport: true; isChangeSubscription?: false; })

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
            // Individual resources
            ...selectedGroupPick.resources.map((res): ResourcePickItem => ({
                label: `${getIconForResourceType(res.type)} ${res.name || "Unnamed Resource"}`,
                description: res.type || "Unknown Type",
                detail: `$(location) Location: ${res.location || "N/A"}`, // Keep details concise
                resource: res,
                isGroupExport: false,
            })),
        ];

        const selectedResourceOrGroupPick = await vscode.window.showQuickPick<ResourcePickItem>(resourcePicks, {
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
            vscode.window.showInformationMessage(`Starting export for all resources in group: ${selectedGroupPick.groupName}`);
            await ExportResourceGroup(subscription, selectedGroupPick.resources, selectedGroupPick.groupName);
        } else if (selectedResourceOrGroupPick.resource?.id) {
            vscode.window.showInformationMessage(`Starting export for resource: ${selectedResourceOrGroupPick.resource.name}`);
            await ExportSingleResource(subscription, selectedResourceOrGroupPick.resource);
        } else {
             vscode.window.showErrorMessage("Invalid selection or the selected resource is missing a required ID.");
        }
    }));

    lspClient = setupLanguageClient(ctx);

    if (await ShouldShowSurvey()) {
        await ShowSurvey();
    }
}

export function deactivate(): void {
    terraformShellManager.dispose();
    if (fileWatcher) {
        fileWatcher.dispose();
    }

    if (lspClient) {
        lspClient.dispose();
    }
}

function initFileWatcher(ctx: vscode.ExtensionContext): void {
    fileWatcher = vscode.workspace.createFileSystemWatcher(getSyncFileBlobPattern());
    ctx.subscriptions.push(
        fileWatcher.onDidDelete((deletedUri) => {
            if (isTerminalSetToCloudShell()) {
                terraformShellManager.getCloudShell().deleteFiles([deletedUri]);
            }
        }),
    );
}

function setupLanguageClient(ctx: vscode.ExtensionContext): LanguageClient {
    const executable: Executable = {
        command: ctx.asAbsolutePath("./bin/azurerm-lsp"),
        args: ["serve"],
    };

    const serverOptions: ServerOptions = {
        run: executable,
        debug: executable,
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{scheme: "file", language: "terraform"}],
        outputChannel: vscode.window.createOutputChannel("AzureRM LSP"),
    };

    const client = new LanguageClient("azurerm", serverOptions, clientOptions);

    client.start().catch((err) => {
        vscode.window.showErrorMessage(`Failed to start AzureRM LSP client: ${err.message}`);
        console.error("Failed to start AzureRM LSP client:", err);
    });

    client.onDidChangeState((event) => {
        console.log(`Client: ${event.newState}`);
    });

    return client;
}
