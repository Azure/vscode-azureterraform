"use strict";

import * as azureStorage from "azure-storage";
import * as path from "path";
import * as vscode from "vscode";

import { FileService } from "azure-storage";
import { WebResource } from "ms-rest";
import { AzureAccount, AzureLoginStatus, AzureSession, AzureSubscription } from "./azure-account.api";
import { IExecResult } from "./utilities";

export class TFTerminal {

    public type: TerminalType;
    public terminal: vscode.Terminal;
    public name: string;
    public ws;
    public storageAccountKey: string;
    public storageAccountName: string;
    public fileShareName: string;

    constructor(type: TerminalType, name: string) {
        this.type = type;
        this.name = name;
    }
}

export enum TerminalType {
    Integrated = "integrated",
    CloudShell = "cloudshell",
}

export enum Option {
    docker = "docker",
    local = "local",
    cloudshell = "cloudshell",
}

export function escapeFile(data: string): string {
    return data.replace(/"/g, '\\"');
}

export function azFileDelete(
    storageAccountName: string,
    storageAccountKey: string,
    fileShareName: string,
    fileName: string): boolean {

    return true;
}

export function azFilePull(
    storageAccountName: string,
    storageAccountKey: string,
    fileShareName: string,
    fileName: string,
    savePath: string): void {

    const filesService = azureStorage.createFileService(storageAccountName, storageAccountKey);
}

export async function azFilePush(
    storageAccountName: string,
    storageAccountKey: string,
    fileShareName: string,
    fileName: string): Promise<void> {

    const filesService = azureStorage.createFileService(storageAccountName, storageAccountKey);
    const dirName = path.dirname(path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, fileName));
    const cloudShellDir = vscode.workspace.name + "/" + dirName;
    const pathCount = cloudShellDir.split(path.sep).length;

    // try create file share if it does not exist
    try {
        await createShare(fileShareName, filesService);
    } catch (error) {
        console.log(`Error creating FileShare: ${fileShareName}\n\n${error}`);
        return;
    }

    // try create directory path if it does not exist, dirs need to be created at each level
    try {
        for (let i = 0; i < pathCount; i++) {
            await createDirectoryPath(fileShareName, cloudShellDir, i, filesService);
        }
    } catch (error) {
        console.log(`Error creating directory: ${cloudShellDir}\n\n${error}`);
        return;
    }

    // try create file if not exist
    try {
        await createFile(fileShareName, cloudShellDir, fileName, filesService);
    } catch (error) {
        console.log(`Error creating file: ${fileName}\n\n${error}`);
    }

    return;
}

function createShare(fileShareName: string, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        fs.createShareIfNotExists(fileShareName, ((error, result, response) => {
            if (!error) {
                console.log(`FileShare: ${fileShareName} created.`);
                resolve();
            } else {
                reject(error);
            }
        }));
    });
}

function createDirectoryPath(fileShareName: string, dir: string, i: number, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        let tempDir = "";
        const dirArray = dir.split(path.sep);
        for (let j = 0; j < dirArray.length && j <= i; j++) {
            tempDir = tempDir + dirArray[j] + "/";
        }
        fs.createDirectoryIfNotExists(fileShareName, tempDir, ((error, result, response) => {
            if (!error) {
                console.log(`Created dir: ${tempDir}`);
                resolve();
            } else {
                reject(error);
            }
        }));
    });
}

function createFile(fileShareName: string, dir: string, filePath: string, fs: azureStorage.FileService): Promise<void> {
    return new Promise<void> ((resolve, reject) => {
        const fileName = path.basename(filePath);
        fs.createFileFromLocalFile(fileShareName, dir, fileName, filePath, (error, result, response) => {
            if (!error) {
                console.log(`Created file: ${fileName}`);
                resolve();
            } else {
                reject(error);
            }
        });
    });
}

// export async function azFilePush(
//     storageAccountName: string,
//     storageAccountKey: string,
//     fileShareName: string,
//     fileName: string): Promise<void> {

//     const filesService = azureStorage.createFileService(storageAccountName, storageAccountKey);
//     const dirName = path.dirname(path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, fileName));
//     const cloudShellDir = vscode.workspace.name + "/" + dirName;

//     filesService.createShareIfNotExists(fileShareName, (error, result, response) => {
//         if (!error) {
//             let dir = "";
//             for (const newdir of cloudShellDir.split(path.sep)) {
//                 dir = dir + "/" + newdir;
//                 await filesService.createDirectoryIfNotExists(fileShareName, dir , (e, res, resp) => {
//                     if (!e) {
//                         console.log(`Created dir ${dir}`);
//                     }
//                 });
//             }

//             filesService.createFileFromLocalFile(fileShareName, cloudShellDir,
//                 path.basename(fileName), fileName , (e, res, resp) => {
//                 if (!e) {
//                     console.log(`File ${path.basename(fileName)} uploaded`);
//                 } else {
//                     console.log(`Error: ${e}`);
//                 }
//                 return;
//             });
//         }
//     });
// }

// export function azFilePush(
//     storageAccountName: string,
//     storageAccountKey: string,
//     fileShareName: string,
//     fileName: string): void {

//     const filesService = azureStorage.createFileService(storageAccountName, storageAccountKey);
//     const dirName = path.dirname(path.relative(vscode.workspace.workspaceFolders[0].uri.fsPath, fileName));
//     const cloudShellDir = vscode.workspace.name + "/" + dirName;

//     filesService.createShareIfNotExists(fileShareName, (error, result, response) => {
//         if (!error) {
//             const promise = createDirIfNotExist(cloudShellDir, fileShareName, filesService);

//             promise.then(() => {
//                 filesService.createFileFromLocalFile(fileShareName, cloudShellDir,
//                     path.basename(fileName), fileName , (e, res, resp) => {
//                     if (!e) {
//                         console.log(`File ${path.basename(fileName)} uploaded`);
//                     } else {
//                         console.log(`Error: ${e}`);
//                     }
//                     return;
//                 });
//             });
//             promise.catch((err) => {
//                 console.log(err.message);
//             });
//         }
//     });
// }

// async function createDirIfNotExist(dirPath: string, fileShare: string, fs: azureStorage.FileService) {
//     return new Promise<any>((resolve, reject) => {
//         let dir = "";
//         for (const newdir of dirPath.split(path.sep)) {
//             dir = dir + "/" + newdir;
//             fs.createDirectoryIfNotExists(fileShare, dir , (e, res, resp) => {
//                 if (!e) {
//                     console.log(`Created dir ${dir}`);
//                 } else {
//                     reject(e);
//                 }
//             });
//         }

//         resolve();
//     });
// }
