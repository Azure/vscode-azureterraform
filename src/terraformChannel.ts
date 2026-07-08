/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

"use strict";

import * as vscode from "vscode";

export interface ITerraformChannel {
  appendLine(message: string | Error | unknown, title?: string): void;
  append(message: string | Error | unknown): void;
  show(): void;
  getChannel(): vscode.OutputChannel;
}

class TerraformChannel implements ITerraformChannel {
  private readonly channel: vscode.OutputChannel =
    vscode.window.createOutputChannel("Microsoft Terraform");

  public appendLine(message: string | Error | unknown, title?: string): void {
    if (title) {
      const simplifiedTime = new Date()
        .toISOString()
        .replace(/z|t/gi, " ")
        .trim(); // YYYY-MM-DD HH:mm:ss.sss
      const hightlightingTitle = `[${title} ${simplifiedTime}]`;
      this.channel.appendLine(hightlightingTitle);
    }
    this.channel.appendLine(String(message));
  }

  public append(message: string | Error | unknown): void {
    this.channel.append(String(message));
  }

  public show(): void {
    this.channel.show();
  }

  public getChannel(): vscode.OutputChannel {
    return this.channel;
  }
}

export const terraformChannel: ITerraformChannel = new TerraformChannel();
