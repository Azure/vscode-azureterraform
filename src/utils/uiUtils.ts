"use strict";

import * as opn from "opn";
import * as vscode from "vscode";

export async function openUrlHint(message: string, url: string): Promise<void> {
    const open: vscode.MessageItem = { title: "Open" };
    const close: vscode.MessageItem = { title: "Close", isCloseAffordance: true };
    const response = await vscode.window.showInformationMessage(`${message} (See: ${url})`, open, close);
    if (response === open && url) {
        opn(url);
    }
}
