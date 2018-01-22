"use strict";

import * as path from "path";
import * as vscode from "vscode";
import { Constants } from "./constants";

import { CloudShell } from "./cloudShell";
import { isDockerInstalled } from "./utilities";

export abstract class BaseShell {
    protected outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.initShellInternal();
    }

    public runTerraformCmd(tfCommand: string, workingDir: string): void {

        // We keep the TFConfiguration for the moment - will need to be updated to sync folders
        const tfActiveFile = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
        this.outputChannel.appendLine(`Running - ${tfCommand}, Active File: ${tfActiveFile}`);

        // Run Terraform command
        this.runTerraformInternal(tfCommand, workingDir);

    }

    public async runTerraformCmdAsync(tfCommand: string): Promise<any> {
        const tfActiveFile = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
        this.outputChannel.appendLine(`Running - ${tfCommand}`);
        this.outputChannel.show();

        return this.runTerraformAsyncInternal(tfActiveFile, tfCommand);
    }

    // Method used to run the end to end tests
    public async runTerraformTests(testType: string): Promise<any> {

        // Check the environment variables to ensure SPN exist (See )
        return this.runTerraformTestsInternal(testType);
    }

    protected output(label: string, message: string): void {
        this.outputChannel.append(`[${label}] ${message}`);
    }

    protected outputLine(label: string, message: string): void {
        this.outputChannel.appendLine(`[${label}] ${message}`);
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
