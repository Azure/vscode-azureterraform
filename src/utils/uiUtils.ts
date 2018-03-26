/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as opn from "opn";
import * as vscode from "vscode";
import { terraformChannel } from "../terraformChannel";

export async function openUrlHint(message: string, url: string): Promise<void> {
    const response = await vscode.window.showInformationMessage(message, DialogOption.learnMore, DialogOption.cancel);
    if (response === DialogOption.learnMore && url) {
        opn(url);
    }
}

export async function showFolderDialog(): Promise<vscode.Uri | undefined> {
    const defaultUri: vscode.Uri | undefined = vscode.workspace.rootPath ? vscode.Uri.file(vscode.workspace.rootPath) : undefined;
    const options: vscode.OpenDialogOptions = {
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select",
        defaultUri,
    };
    const result: vscode.Uri[] | undefined = await vscode.window.showOpenDialog(options);
    if (!result || result.length === 0) {
        return undefined;
    }
    return result[0];
}

export async function promptForOpenOutputChannel(message: string, type: DialogType): Promise<void> {
    let result: vscode.MessageItem;
    switch (type) {
        case DialogType.info:
            result = await vscode.window.showInformationMessage(message, DialogOption.open, DialogOption.cancel);
            break;
        case DialogType.warning:
            result = await vscode.window.showWarningMessage(message, DialogOption.open, DialogOption.cancel);
            break;
        case DialogType.error:
            result = await vscode.window.showErrorMessage(message, DialogOption.open, DialogOption.cancel);
            break;
        default:
            break;
    }

    if (result === DialogOption.open) {
        terraformChannel.show();
    }
}

export namespace DialogOption {
    export const ok: vscode.MessageItem = { title: "OK" };
    export const cancel: vscode.MessageItem = { title: "Cancel", isCloseAffordance: true };
    export const open: vscode.MessageItem = { title: "Open" };
    export const learnMore: vscode.MessageItem = { title: "Learn More" };
}

export enum DialogType {
    info = "info",
    warning = "warning",
    error = "error",
}
