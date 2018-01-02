"use strict";

import * as vscode from 'vscode';
import { BaseShell } from './baseShell';
import { join } from 'path';
import { extensions, commands, workspace, Disposable, Uri, window, ViewColumn } from 'vscode';
import { TFTerminal, TerminalType} from './shared'
import { Constants } from './constants'
const fs = require('fs-extra')

export class IntegratedShell extends BaseShell {
    static readonly GRAPH_FILE_NAME =  './graph.png';
    private graphUri : Uri;
    
    //terminal wrapper
    public term = new TFTerminal(
        TerminalType.Integrated, 
        Constants.TerraformTerminalName);

    //init shell env and hook up close handler. Close handler ensures if user closes terminal window, 
    // that extension is notified and can handle appropriately.
    protected initShellInternal() {
        //set path for 
        this.graphUri = Uri.file(join(workspace.rootPath || '', IntegratedShell.GRAPH_FILE_NAME));

        if ('onDidCloseTerminal' in <any>vscode.window) {
            (<any>vscode.window).onDidCloseTerminal((terminal) => {
                if (terminal == this.term.terminal ) {
                    this.outputLine('Terraform Terminal closed', terminal.name);
                    this.term.terminal = null;
                }
            });
        }
    }
    //run synchronous tf cmd
    protected runTerraformInternal(TFconfiguration: string, TFCommand: string): void {
        this.checkCreateTerminal();
        var term = this.term.terminal;
        term.show();
        term.sendText(TFCommand);
        return;
    }

    //run tf cmd async and return promise.
    protected runTerraformAsyncInternal(TFConfiguration: string, TFCommand: string) : Promise<any>{
        this.checkCreateTerminal();

        var term = this.term.terminal;
        
        term.show();

        let ret = term.sendText(TFCommand);
        return Promise.all([ret]);
    }

    public visualize(): void {
        this.deletePng();
        this.runTerraformCmdAsync("terraform graph | dot -Tpng > graph.png").then(() => {
            this.displayPng();
        });
    }

    private  deletePng() : void {
        if(fs.existsSync(this.graphUri.path)){
            fs.unlinkSync(this.graphUri.path)
        }
    }

    private displayPng(): void {
        //add 2 second delay before opening file due to file creation latency
        setTimeout(() => {commands.executeCommand('vscode.open', this.graphUri,ViewColumn.Two);}
        ,2000);
    }

    protected syncWorkspaceInternal()
    {
        //not implemented for integrated terminal
    }

    private checkCreateTerminal(): void {
        
        if ( this.term.terminal == null ) {
            this.term.terminal = vscode.window.createTerminal(
                Constants.TerraformTerminalName);
        }
    }
    


}

