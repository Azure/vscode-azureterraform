"use strict";

import * as vscode from "vscode";
import { delay } from "./cloudConsoleLauncher";
import { terraformChannel } from "./terraformChannel";

export abstract class BaseShell {

    constructor() {
        this.initShellInternal();
    }

    public runTerraformCmd(tfCommand: string, workingDir: string): void {

        // We keep the TFConfiguration for the moment - will need to be updated to sync folders
        const tfActiveFile = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
        terraformChannel.appendLine(`Running - ${tfCommand}, Active File: ${tfActiveFile}`);

        // Save all open files
        vscode.workspace.saveAll().then(() => {
            // Run Terraform command
            delay(500);
            this.runTerraformInternal(tfCommand, workingDir);

        });

    }

    public async runTerraformCmdAsync(tfCommand: string): Promise<any> {
        const tfActiveFile = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
        terraformChannel.appendLine(`Running - ${tfCommand}`);
        terraformChannel.show();

        return this.runTerraformAsyncInternal(tfActiveFile, tfCommand);
    }

    // Method used to run the end to end tests
    public async runTerraformTests(testType: string): Promise<any> {

        // Check the environment variables to ensure SPN exist (See )
        return await this.runTerraformTestsInternal(testType);
    }

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
    protected abstract runTerraformAsyncInternal(tfConfiguration: string, tfCommand: string): Promise<any>;
    protected abstract initShellInternal();
    protected abstract syncWorkspaceInternal(fileName: string);
    protected abstract runTerraformTestsInternal(testType: string);
}
