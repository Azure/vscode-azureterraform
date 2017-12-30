"use strict";

import * as vscode from 'vscode';
import { AzureAccount, AzureSession, AzureLoginStatus } from './azure-account.api';
import { WebResource } from 'ms-rest';

export class TFTerminal{

    constructor(type: TerminalType, name: string){
        this.type = type;
        this.name = name;
    }
    
    public type : TerminalType;
    public terminal : vscode.Terminal;
    public name : string;
    public ws;
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

