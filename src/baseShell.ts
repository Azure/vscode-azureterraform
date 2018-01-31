"use strict";

import * as vscode from "vscode";
import { terraformChannel } from "./terraformChannel";

export abstract class BaseShell {

    constructor() {
        this.initShellInternal();
    }

    public runTerraformCmd(tfCommand: string, workingDir: string): void {

        // We keep the TFConfiguration for the moment - will need to be updated to sync folders
        const tfActiveFile = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
        terraformChannel.appendLine(`Running - ${tfCommand}, Active File: ${tfActiveFile}`);

        // Run Terraform command
        this.runTerraformInternal(tfCommand, workingDir);

    }

    public async runTerraformCmdAsync(tfCommand: string): Promise<any> {
        const tfActiveFile = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
        terraformChannel.appendLine(`Running - ${tfCommand}`);
        terraformChannel.show();

        return this.runTerraformAsyncInternal(tfActiveFile, tfCommand);
    }

    public abstract runTerraformTests(testType: string, workingDirectory: string);

    protected output(label: string, message: string): void {
        terraformChannel.appendLine(`[${label}] ${message}`);
    }

    protected outputLine(label: string, message: string): void {
        terraformChannel.appendLine(`[${label}] ${message}`);
    }

    protected isWindows(): boolean {
        return process.platform === "win32";
    }

    protected abstract runTerraformInternal(tfCommand: string, workingDir: string);
    protected abstract runTerraformAsyncInternal(tfConfiguration: string, tfCommand: string): void;
    protected abstract initShellInternal();
}
