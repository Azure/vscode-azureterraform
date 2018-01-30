"use strict";

import * as vscode from "vscode";
import { DialogOption, showFolderDialog } from "./uiUtils";

export async function selectWorkspaceFolder(): Promise<string | undefined> {
    let folder: vscode.WorkspaceFolder;
    if (vscode.workspace.workspaceFolders) {
        if (vscode.workspace.workspaceFolders.length > 1) {
            folder =  await vscode.window.showWorkspaceFolderPick({
                placeHolder: "Select the working directory you wish to use",
                ignoreFocusOut: true,
            });
        } else {
            folder = vscode.workspace.workspaceFolders[0];
        }
        return folder.uri.fsPath;
    } else {
        const response = await vscode.window.showInformationMessage(
            "There is no folder opened in current workspace, would you like to open a folder?",
            DialogOption.OPEN,
            DialogOption.CANCEL,
        );
        if (response === DialogOption.OPEN) {
            const selectedFolder: vscode.Uri = await showFolderDialog();
            if (selectedFolder) {
                await vscode.commands.executeCommand("vscode.openFolder", selectedFolder, false /* forceNewWindow */);
            }
        }
    }
}
