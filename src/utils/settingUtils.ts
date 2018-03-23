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

function getTerraformExtensionSetting<T>(key: string, fsPath?: string): T | undefined {
    const projectConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(extensionPrefix, fsPath ? vscode.Uri.file(fsPath) : undefined);
    return projectConfiguration.get<T>(key);
}
