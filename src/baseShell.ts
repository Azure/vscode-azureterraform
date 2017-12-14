"use strict";

import * as vscode from "vscode";
import { Constants } from "./constants";
import * as path from "path";

export abstract class BaseShell {
    protected _outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
        this.initShellInternal();
    }

    protected output(label: string, message: string): void {
        this._outputChannel.append(`[${label}] ${message}`);
    }

    protected outputLine(label: string, message: string): void {
        this._outputChannel.appendLine(`[${label}] ${message}`);
    }

    protected isWindows(): boolean {
        return process.platform === 'win32';
    }
    
    public runTerraformCmd(TFCommand: string): void {
        var TFConfiguration = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
        this._outputChannel.append("Starting Cloudshell - Terraform")
        this._outputChannel.show();

        return this.runTerraformInternal(TFConfiguration, TFCommand);
    
    }

    //protected abstract runPlaybookInternal(playbook: string);
    protected abstract runTerraformInternal(TFConfiguration: string, TFCommand: string);
    protected abstract initShellInternal();
    protected abstract syncWorkspaceInternal();
}
