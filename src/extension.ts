/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as _ from "lodash";
import * as vscode from "vscode";
import * as TelemetryWrapper from "vscode-extension-telemetry-wrapper";
import { Executable, LanguageClient, LanguageClientOptions, ServerOptions } from "vscode-languageclient/node";
import {TerraformCommand} from "./shared";
import {TestOption} from "./shared";
import {ShouldShowSurvey, ShowSurvey} from "./survey";
import {terraformShellManager} from "./terraformShellManager";
import {getSyncFileBlobPattern, isTerminalSetToCloudShell} from "./utils/settingUtils";
import {checkTerraformInstalled} from "./utils/terraformUtils";
import {DialogOption} from "./utils/uiUtils";
import {selectWorkspaceFolder} from "./utils/workspaceUtils";

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
        command: ctx.asAbsolutePath("./azurerm-lsp"),
        args: ["serve"],
    };

    const serverOptions: ServerOptions = {
        run: executable,
        debug: executable,
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: [{scheme: "file", language: "terraform"}],
        outputChannel: vscode.window.createOutputChannel("AzureRM LSP"),
        synchronize: {
            fileEvents: vscode.workspace.createFileSystemWatcher("**/*.tf"),
        },
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
