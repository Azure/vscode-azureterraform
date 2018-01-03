'use strict'

import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import * as os from 'os';
import { Constants } from './constants';
import { execSync } from 'child_process';


export enum TestOption {
    lint = "lint",
    e2enossh = "e2e - no ssh",
    e2ewithssh = "e2e - with ssh",
    custom = "custom"
} 

export class CSTerminal {
    accessToken: string;
    consoleURI: string;
    terminal: vscode.Terminal;
}

export function localExecCmd(cmd: string, args: string[], outputChannel: vscode.OutputChannel, cb: Function): void {
    try {
        var cp = require('child_process').spawn(cmd, args);    

        cp.stdout.on('data', function (data) {
            if (outputChannel) {
                outputChannel.append('\n' +String(data));
                outputChannel.show();
            }
        });

        cp.stderr.on('data', function (data) {
            if (outputChannel) outputChannel.append(String(data));
        });

        cp.on('close', function (code) {
            if (cb) {
                if (0 == code) {
                    cb();
                } else {
                    var e = new Error("External command failed");
                    e.stack = "exit code: " + code;
                    cb(e);
                }
            }
        });
    } catch (e) {
        e.stack = "ERROR: " + e;
        if (cb) cb(e);
    }
}


export function isDockerInstalled(outputChannel: vscode.OutputChannel, cb: Function): void {
    var retVal = false;

    if (process.platform === 'win32') {
        localExecCmd('cmd.exe', ['/c', 'docker', '-v'], outputChannel, function (err) {
            if (err) {
                vscode.window.showErrorMessage('Docker isn\'t installed, please install Docker to continue (https://www.docker.com/).');
                cb(err)
            } else {
                cb();
            }
        });
    }
    else {

    localExecCmd('docker', ['version'], outputChannel, function(err) {
            if (err) {
                vscode.window.showErrorMessage('Docker isn\'t installed, please install Docker to continue (https://www.docker.com)');
                cb(err);
            } else {
                cb();
            }
        })
    }

}

export function isDotInstalled(outputChannel: vscode.OutputChannel, cb: Function): void {
    var retVal = false;

    if (process.platform === 'win32') {
        localExecCmd('cmd.exe', ['/c', 'dot', '-V'], outputChannel, function (err) {
            if (err) {
                vscode.window.showErrorMessage('GraphViz - Dot is not installed, please install GraphViz to continue (https://www.graphviz.org).');
                cb(err)
            } else {
                cb();
            }
        });
    }
    else {

    localExecCmd('dot', ['-V'], outputChannel, function(err) {
            if (err) {
                vscode.window.showErrorMessage('GraphViz - Dot is not installed, please install GraphViz to continue (https://www.graphviz.org).');
                cb(err);
            } else {
                cb();
            }
        })
    }

}

export function isEmpty(param){
    if ( param==null || param.lenght==0 || param == undefined)
        return true;
    else
        return false;
}
