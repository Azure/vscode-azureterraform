"use strict";

import * as vscode from 'vscode';
import { AzureAccount, AzureSession, AzureLoginStatus } from './azure-account.api';

export class TFTerminal{

    constructor(type: TerminalType, name: string){
        this.type = type;
        this.name = name;
    }
    
    public type : TerminalType;
    public terminal : vscode.Terminal;
    public name : string;
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
