"use strict";

import * as opn from "opn";
import * as vscode from "vscode";
import { terraformChannel } from "../terraformChannel";

export async function openUrlHint(message: string, url: string): Promise<void> {
    const response = await vscode.window.showInformationMessage(`${message} (See: ${url})`, DialogOption.OPEN, DialogOption.CANCEL);
    if (response === DialogOption.OPEN && url) {
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
            result = await vscode.window.showInformationMessage(message, DialogOption.OPEN, DialogOption.CANCEL);
            break;
        case DialogType.warning:
            result = await vscode.window.showWarningMessage(message, DialogOption.OPEN, DialogOption.CANCEL);
            break;
        case DialogType.error:
            result = await vscode.window.showErrorMessage(message, DialogOption.OPEN, DialogOption.CANCEL);
            break;
        default:
            break;
    }

    if (result === DialogOption.OPEN) {
        terraformChannel.show();
    }
}

export namespace DialogOption {
    export const OK: vscode.MessageItem = { title: "OK" };
    export const CANCEL: vscode.MessageItem = { title: "Cancel", isCloseAffordance: true };
    export const OPEN: vscode.MessageItem = { title: "Open" };
}

export enum DialogType {
    info = "info",
    warning = "warning",
    error = "error",
}
