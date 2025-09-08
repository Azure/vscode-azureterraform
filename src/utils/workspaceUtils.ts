/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as _ from "lodash";
import * as vscode from "vscode";
import * as path from "path";
import { DialogOption, showFolderDialog } from "./uiUtils";

export async function selectWorkspaceFolder(): Promise<string | undefined> {
  let folder: vscode.WorkspaceFolder;

  // Prefer the workspace folder that contains the currently active file
  const activeUri = vscode.window.activeTextEditor?.document?.uri;
  if (activeUri) {
    // If the active document is a real file on disk, return the folder containing that file
    if (activeUri.scheme === "file") {
      return path.dirname(activeUri.fsPath);
    }
    // Otherwise fall through to existing logic
  }
  if (!_.isEmpty(vscode.workspace.workspaceFolders)) {
    if (vscode.workspace.workspaceFolders.length > 1) {
      folder = await vscode.window.showWorkspaceFolderPick({
        placeHolder: "Select the working directory you wish to use",
        ignoreFocusOut: true,
      });
    } else {
      folder = vscode.workspace.workspaceFolders[0];
    }
  } else {
    const response = await vscode.window.showInformationMessage(
      "There is no folder opened in current workspace, would you like to open a folder?",
      DialogOption.open,
      DialogOption.cancel
    );
    if (response === DialogOption.open) {
      const selectedFolder: vscode.Uri = await showFolderDialog();
      if (selectedFolder) {
        /**
         * Open the selected folder in a workspace.
         * NOTE: this will restart the extension host.
         * See: https://github.com/Microsoft/vscode/issues/58
         */
        await vscode.commands.executeCommand(
          "vscode.openFolder",
          selectedFolder,
          false /* forceNewWindow */
        );
      }
    }
  }
  return folder ? folder.uri.fsPath : undefined;
}
