"use strict";

import * as vscode from "vscode";
import { DialogOption, showFolderDialog } from "./uiUtils";

export async function selectWorkspaceFolder(): Promise<string | undefined> {
    let folder: vscode.WorkspaceFolder;
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        if (vscode.workspace.workspaceFolders.length > 1) {
            folder =  await vscode.window.showWorkspaceFolderPick({
                placeHolder: "Select the working directory you wish to use",
                ignoreFocusOut: true,
            });
        } else {
            folder = vscode.workspace.workspaceFolders[0];
        }
    } else {
        const response = await vscode.window.showInformationMessage(
            "There is no folder opened in current workspace, would you like to open a folder?",
            DialogOption.OPEN,
            DialogOption.CANCEL,
        );
        if (response === DialogOption.OPEN) {
            const selectedFolder: vscode.Uri = await showFolderDialog();
            if (selectedFolder) {
                /**
                 * Open the selected folder in a workspace.
                 * NOTE: this will restart the extension host.
                 * See: https://github.com/Microsoft/vscode/issues/58
                 */
                await vscode.commands.executeCommand("vscode.openFolder", selectedFolder, false /* forceNewWindow */);
            }
        }
    }
    return folder ? folder.uri.fsPath : undefined;
}
