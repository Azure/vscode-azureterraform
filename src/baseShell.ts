"use strict";

import * as vscode from "vscode";
import { terraformChannel } from "./terraformChannel";

export abstract class BaseShell {

    public terminal: vscode.Terminal | undefined;

    constructor() {
        this.initShellInternal();
    }

    public abstract runTerraformCmd(tfCommand: string);

    public abstract runTerraformTests(testType: string, workingDirectory: string);

    protected isWindows(): boolean {
        return process.platform === "win32";
    }

    protected dispose(): void {
        terraformChannel.appendLine(`Terraform terminal: ${this.terminal.name} closed`);
        this.terminal = undefined;
    }

    protected abstract initShellInternal();
}
