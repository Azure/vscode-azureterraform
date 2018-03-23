/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";

const extensionPrefix: string = "azureTerraform";

export function isTerminalSetToCloudShell(): boolean {
    return getTerraformExtensionSetting<string>("terminal") === "cloudshell";
}

export function getSyncFileBlobPattern(): vscode.GlobPattern {
    return getTerraformExtensionSetting<vscode.GlobPattern>("files");
}

export async function updateGlobalSetting<T = string>(section: string, value: T): Promise<void> {
    const projectConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(extensionPrefix);
    await projectConfiguration.update(section, value, vscode.ConfigurationTarget.Global);
}

export async function updateWorkspaceSetting<T = string>(section: string, value: T, fsPath: string): Promise<void> {
    const projectConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(extensionPrefix, vscode.Uri.file(fsPath));
    await projectConfiguration.update(section, value);
}

function getTerraformExtensionSetting<T>(key: string, fsPath?: string): T | undefined {
    const projectConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(extensionPrefix, fsPath ? vscode.Uri.file(fsPath) : undefined);
    return projectConfiguration.get<T>(key);
}
