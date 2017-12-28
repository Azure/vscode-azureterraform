
import { AzureAccount, AzureSession } from "./azure-account.api";
import { OutputChannel, commands, window, MessageItem, Terminal, env } from "vscode";
import { getUserSettings, provisionConsole, runInTerminal, resetConsole , Errors} from './cloudConsoleLauncher'
import { clearInterval, setTimeout } from "timers";
import { CSTerminal } from './utilities';
import { configure } from "vscode/lib/testrunner";
import { PassThrough } from "stream";
import * as path from 'path';
import { TerminalType } from "./shared";

export function openCloudConsole(api: AzureAccount, outputChannel: OutputChannel, tempFile: string) {
    return (
        async function retry(): Promise<any> {

            console.log('Starting openCloudConsole');
            outputChannel.append('\nConnecting to CloudShell.');
            outputChannel.show();

            // Loging in to Azure using the azure account extension
            const progress = delayedInterval(() => { outputChannel.append('..') }, 500)
            if (!(await api.waitForLogin())) {
                progress.cancel();
                return commands.executeCommand('azure-account.askForLogin');
            }

            // Getting the tokens for the session
            const tokens = await Promise.all(api.sessions.map(session => acquireToken(session)));
            const result = await findUserSettings(tokens);
            if (!result) {
                progress.cancel();
                return;
                //TODO: ADD requiresSetup();
            }
            outputChannel.append('\nUsersettings obtained from Tokens - proceeding\n');

            // Getting the console URI
            let consoleUri: string;
            const armEndpoint = result.token.session.environment.resourceManagerEndpointUrl;
            const inProgress = delayed(() => window.showInformationMessage('Provisioning Cloud Shell may take few seconds'), 2000);
            try {
                consoleUri = await provisionConsole(result.token.accessToken, armEndpoint, result.userSettings, "linux");
                inProgress.cancel();
                progress.cancel();
            }
            catch (err) {
                inProgress.cancel();
                progress.cancel();
                if (err && err.message === Errors.DeploymentOsTypeConflict) {
                    return deploymentConflict(retry, result.token.accessToken, armEndpoint);
                }
                throw err;
            }

            let shellPath = path.join(__dirname, `../bin/node.sh`);
            let modulePath = path.join(__dirname, 'cloudConsoleLauncher');
            let shellArgs = [
                process.argv0,
                '-e',
                `require('${modulePath}').main()`,
            ];

            let response = await runInTerminal(result.token.accessToken, consoleUri, '');

            //var myCSTerminal: CSTerminal = null;
            //myCSTerminal.accessToken = result.token.accessToken;
            //myCSTerminal.consoleURI = consoleUri;

            progress.cancel()
            const terminal = window.createTerminal({
            name: "Terraform in CloudShell",
            shellPath,
            shellArgs,
            env: {
                CLOUD_CONSOLE_ACCESS_TOKEN: result.token.accessToken,
                CLOUD_CONSOLE_URI: consoleUri,
                CLOUDSHELL_TEMP_FILE: tempFile,
                // to workaround tls error: https://github.com/VSChina/vscode-ansible/pull/44
                NODE_TLS_REJECT_UNAUTHORIZED: "0"
                }
            });
            
            //terminal.show();
            return terminal;
  

        })().catch(err => {
            outputChannel.append('\nConnecting to CloudShell failed with error: \n' + err);
            outputChannel.show();
            throw err;
        });
}

async function deploymentConflict(retry: () => Promise<void>, accessToken: string, armEndpoint: string) {
	const ok: MessageItem = { title: "OK" };
	const cancel: MessageItem = { title: "Cancel", isCloseAffordance: true };
	const message = "Starting a linux session will terminate all active sessions. Any running processes in active ";
	const response = await window.showWarningMessage(message, ok, cancel);
	if (response === ok) {
		await resetConsole(accessToken, armEndpoint);
		return retry();
	}
}


interface Token {
    session: AzureSession;
    accessToken: string;
    refreshToken: string;
}

async function acquireToken(session: AzureSession) {
    return new Promise<Token>((resolve, reject) => {
        const credentials: any = session.credentials;
        const environment: any = session.environment;
        credentials.context.acquireToken(environment.activeDirectoryResourceId, credentials.username, credentials.clientId, function (err: any, result: any) {
            if (err) {
                reject(err);
            } else {
                resolve({
                    session,
                    accessToken: result.accessToken,
                    refreshToken: result.refreshToken
                });
            }
        });
    });
}

async function findUserSettings(tokens: Token[]) {
    for (const token of tokens) {
        const userSettings = await getUserSettings(token.accessToken, token.session.environment.resourceManagerEndpointUrl);
        if (userSettings && userSettings.storageProfile) {
            return { userSettings, token };
        }
    }
}

function delayedInterval(func: () => void, interval: number) {
    const handle = setInterval(func, interval);
    return {
        cancel: () => clearInterval(handle)
    }
}

function delayed(func: () => void, delay: number) {
    const handle = setTimeout(func, delay);
    return {
        cancel: () => clearTimeout(handle)
    }
}