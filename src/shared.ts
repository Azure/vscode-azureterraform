"use strict";

import * as vscode from 'vscode';
import { AzureAccount, AzureSession, AzureLoginStatus, AzureSubscription } from './azure-account.api';
import { WebResource } from 'ms-rest';
import * as azure from 'azure-storage';
import * as path from "path";

export class TFTerminal{

    constructor(type: TerminalType, name: string){
        this.type = type;
        this.name = name;
    }
    
    public type : TerminalType;
    public terminal : vscode.Terminal;
    public name : string;
    public ws;
    public storageAccountKey: string; 
    public storageAccountName: string;
    public fileShareName: string; 
}

export enum TerminalType{
    Integrated = 'integrated',
    CloudShell = 'cloudshell'
}

export enum Option {
    docker = "docker",
    local = "local",
    cloudshell = "cloudshell"
}

export function escapeFile(data: string): string {
    return data.replace(/"/g, '\\"');
}

export function azFilePush(storageAccountName: string, storageAccountkey: string, fileShareName: string, filename: string): void{
    var filesService = azure.createFileService(storageAccountName,storageAccountkey);
    var dirname = path.dirname(path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, filename));

    filesService.createShareIfNotExists(fileShareName, function(error, result, response){
        if (!error) {
            var dir = ""
            for (let newdir of dirname.split(path.sep)) {
                dir = dir + "/" + newdir; 
                filesService.createDirectoryIfNotExists(fileShareName, dir , function(error, result, response) {
                    if (!error) {
                        console.log(`Created dir ${dir}`);
                    }
                });
            }
            
            filesService.createFileFromLocalFile(fileShareName, dirname, path.basename(filename), filename , function (error, result, response) {
                if (!error) {
                    console.log(`File ${path.basename(filename)} uploaded correctly`);
                } else {
                    console.log(`Error: ${error}`);
                }
                return;
            })
                
        }
    });
}
