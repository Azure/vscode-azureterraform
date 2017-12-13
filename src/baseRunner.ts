"use strict";

import * as vscode from "vscode";
import { Constants } from "./constants";
import * as utilties from "./utilities";
import * as path from "path";

export enum Option {
    docker = "docker",
    local = "local"
}


export abstract class BaseRunner {
    protected _outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this._outputChannel = outputChannel;
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

    // public runPlaybook(): void {
    //     var playbook = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
    //     vscode.window.showInputBox({ value: playbook, prompt: 'Please input playbook name', placeHolder: 'playbook', password: false })
    //         .then((input) => {
    //             if (input != undefined && input != '') {
    //                 playbook = input;
    //             }

    //             this._outputChannel.append(Constants.LineSeperator + '\nRun playbook: ' + playbook + '\n');
    //             this._outputChannel.show();

    //             if (!utilties.validatePlaybook(playbook, this._outputChannel)) {
    //                 return;
    //             }

    //             return this.runPlaybookInternal(playbook);
    //         })
    // }

    public runTerraform(TFCommand: string): void {
        var TFConfiguration = vscode.window.activeTextEditor ? vscode.window.activeTextEditor.document.fileName : null;
        // var TFFolder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file()
        //var TFFiles = vscode.workspace.findFiles('*')
        this._outputChannel.append("Starting Cloudshell - Terraform")
        this._outputChannel.show();

        return this.runTerraformInternal(TFConfiguration, TFCommand);
    
    }


    //protected abstract runPlaybookInternal(playbook: string);
    protected abstract runTerraformInternal(TFConfiguration: string, TFCommand: string);
}
