/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as vscode from "vscode";

export interface ITerraformChannel {
  appendLine(message: any, title?: string): void;
  append(message: any): void;
  show(): void;
}

class TerraformChannel implements ITerraformChannel {
  private readonly channel: vscode.OutputChannel =
    vscode.window.createOutputChannel("Azure Terraform");

  public appendLine(message: any, title?: string): void {
    if (title) {
      const simplifiedTime = new Date()
        .toISOString()
        .replace(/z|t/gi, " ")
        .trim(); // YYYY-MM-DD HH:mm:ss.sss
      const hightlightingTitle = `[${title} ${simplifiedTime}]`;
      this.channel.appendLine(hightlightingTitle);
    }
    this.channel.appendLine(message);
  }

  public append(message: any): void {
    this.channel.append(message);
  }

  public show(): void {
    this.channel.show();
  }
}

export const terraformChannel: ITerraformChannel = new TerraformChannel();
