"use strict";

import * as vscode from 'vscode';
import { BaseRunner } from './baseRunner';
import { extensions, commands, Disposable, window } from 'vscode';


export var tfterminal;

export class integratedTerminalRunner extends BaseRunner {

    protected init() {
        if ('onDidCloseTerminal' in <any>vscode.window) {
            (<any>vscode.window).onDidCloseTerminal((terminal) => {
                if (terminal == tfterminal ) {
                    console.log('Terraform Terminal closed', terminal.name);
                    tfterminal = null;
                }
            });
        }
    }

    protected runTerraformInternal(TFconfiguration: string, TFCommand: string): void {
        this.startIntegratedTerminal(TFconfiguration, TFCommand);
        return;
    }

    protected startIntegratedTerminal(TFconfiguration: string, TFCommand: string): void {

        var myterminal = this.getTerraformTerminal();

    }

    protected getTerraformTerminal(): vscode.Terminal {
        
        if ( tfterminal == null ) {
            tfterminal = vscode.window.createTerminal("Terraform")
        }
        return tfterminal
    }
    


}

