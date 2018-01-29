"use strict";

import * as opn from "opn";
import * as vscode from "vscode";

export async function openUrlHint(message: string, url: string): Promise<void> {
    const response = await vscode.window.showInformationMessage(`${message} (See: ${url})`, DialogOption.OPEN, DialogOption.CANCEL);
    if (response === DialogOption.OPEN && url) {
        opn(url);
    }
}

export namespace DialogOption {
    export const OK: vscode.MessageItem = { title: "OK" };
    export const CANCEL: vscode.MessageItem = { title: "Cancel", isCloseAffordance: true };
    export const OPEN: vscode.MessageItem = { title: "Open" };
}
