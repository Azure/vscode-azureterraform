/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import { env, MessageItem, OpenDialogOptions, Uri, window, workspace } from "vscode";
import { terraformChannel } from "../terraformChannel";

export async function openUrlHint(message: string, url: string): Promise<void> {
    const response = await window.showInformationMessage(message, DialogOption.learnMore, DialogOption.cancel);
    if (response === DialogOption.learnMore && url) {
        env.openExternal(Uri.parse(url));
    }
}

export async function showFolderDialog(): Promise<Uri | undefined> {
    const defaultUri: Uri | undefined = workspace.rootPath ? Uri.file(workspace.rootPath) : undefined;
    const options: OpenDialogOptions = {
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select",
        defaultUri,
    };
    const result: Uri[] | undefined = await window.showOpenDialog(options);
    if (!result || result.length === 0) {
        return undefined;
    }
    return result[0];
}

export async function promptForOpenOutputChannel(message: string, type: DialogType): Promise<void> {
    let result: MessageItem;
    switch (type) {
        case DialogType.info:
            result = await window.showInformationMessage(message, DialogOption.open, DialogOption.cancel);
            break;
        case DialogType.warning:
            result = await window.showWarningMessage(message, DialogOption.open, DialogOption.cancel);
            break;
        case DialogType.error:
            result = await window.showErrorMessage(message, DialogOption.open, DialogOption.cancel);
            break;
        default:
            break;
    }

    if (result === DialogOption.open) {
        terraformChannel.show();
    }
}

export namespace DialogOption {
    export const ok: MessageItem = { title: "OK" };
    export const cancel: MessageItem = { title: "Cancel", isCloseAffordance: true };
    export const open: MessageItem = { title: "Open" };
    export const learnMore: MessageItem = { title: "Learn More" };
}

export enum DialogType {
    info = "info",
    warning = "warning",
    error = "error",
}
