"use strict";

import * as vscode from 'vscode';
import { AzureAccount, AzureSession, AzureLoginStatus, AzureSubscription } from './azure-account.api';
import { WebResource } from 'ms-rest';
import * as azure from 'azure-storage';
import * as path from "path";
import { FileService } from 'azure-storage';

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
    public ResourceGroup: string;
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
    return data.replace(/"/g, '\\"').replace(/\$/g, '\\\$');
}

export function azFilePush(storageAccountName: string, storageAccountkey: string, fileShareName: string, filename: string): void{
    var filesService = azure.createFileService(storageAccountName,storageAccountkey);
    var dirName = path.dirname(path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, filename));
    const cloudShellDir = vscode.workspace.name + "/" + dirName;

    filesService.createShareIfNotExists(fileShareName, async function(error, result, response){
        if (!error) {
            // let dir = ""
            // const dirArray = cloudShellDir.split(path.sep);
            // for (let _i=0; _i < dirArray.length; _i++ ) {
            //     dir = dir + dirArray[_i] + "/"; 
            //     await filesService.createDirectoryIfNotExists(fileShareName, dir , (e, res, resp) => {
            //         if (!e) {
            //             console.log(`Created dir ${dir}`);
            //         }
            //     });
            // }
            createAzDir(fileShareName, cloudShellDir, storageAccountkey, storageAccountName).then(()=>{
                filesService.createFileFromLocalFile(fileShareName, cloudShellDir, path.basename(filename), filename , (e, res, resp) => {
                    if (!e) {
                        console.log(`File ${path.basename(filename)} uploaded`);
                    } else {
                        console.log(`Error: ${e}`);
                    }
                    return;
                })
            });

        }
    });
}


function createAzDir(fileShareName: string, dirpath: string, storageAccountkey: string, storageAccountName: string):Promise<void>  {
    return new Promise((resolve, reject) => {
    var filesService = azure.createFileService(storageAccountName,storageAccountkey);
    const dirArray = dirpath.split(path.sep);
    
    filesService.createDirectoryIfNotExists(fileShareName, dirArray[0], (err, res, resp)=> {
        if (err) {
            reject(err);
        }
        else {
            if (dirpath.substring(dirArray[0].length) != "") {
                createAzDir(fileShareName, dirpath.substring(dirArray[0].length+1) , storageAccountkey, storageAccountName);
            }
        }

    })
    }
)}