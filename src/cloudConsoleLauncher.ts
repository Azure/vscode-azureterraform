"use strict";

import * as fsExtra from "fs-extra";
import * as request from "request-promise";
import { setTimeout } from "timers";
import * as WS from "ws";

const consoleApiVersion = "2017-08-01-preview";

export enum Errors {
	DeploymentOsTypeConflict = "DeploymentOsTypeConflict",
}

function getConsoleUri(armEndpoint: string) {
	return `${armEndpoint}/providers/Microsoft.Portal/consoles/default?api-version=${consoleApiVersion}`;
}

export interface IUserSettings {
	preferredLocation: string;
	preferredOsType: string; // The last OS chosen in the portal.
	storageProfile: any;
}

export async function getUserSettings(accessToken: string, armEndpoint: string): Promise<IUserSettings | undefined> {
	const targetUri = `${armEndpoint}/providers/Microsoft.Portal/userSettings/cloudconsole?api-version=${consoleApiVersion}`;
	const response = await request({
		uri: targetUri,
		method: "GET",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
			"Authorization": `Bearer ${accessToken}`,
		},
		simple: false,
		resolveWithFullResponse: true,
		json: true,
	});

	if (response.statusCode < 200 || response.statusCode > 299) {
		// if (response.body && response.body.error && response.body.error.message) {
		// 	console.log(`${response.body.error.message} (${response.statusCode})`);
		// } else {
		// 	console.log(response.statusCode, response.headers, response.body);
		// }
		return;
	}

	return response.body && response.body.properties;
}

export async function provisionConsole(
	accessToken: string,
	armEndpoint: string,
	userSettings: IUserSettings,
	osType: string): Promise<string> {
	let response = await createTerminal(accessToken, armEndpoint, userSettings, osType, true);
	for (let i = 0; i < 10; i++ , response = await createTerminal(accessToken, armEndpoint, userSettings, osType, false)) {
		if (response.statusCode < 200 || response.statusCode > 299) {
			if (response.statusCode === 409 && response.body
				&& response.body.error && response.body.error.code === Errors.DeploymentOsTypeConflict) {
				throw new Error(Errors.DeploymentOsTypeConflict);
			} else if (response.body && response.body.error && response.body.error.message) {
				throw new Error(`${response.body.error.message} (${response.statusCode})`);
			} else {
				throw new Error(`${response.statusCode} ${response.headers} ${response.body}`);
			}
		}

		const consoleResource = response.body;
		if (consoleResource.properties.provisioningState === "Succeeded") {
			return consoleResource.properties.uri;
		} else if (consoleResource.properties.provisioningState === "Failed") {
			break;
		}
	}
	throw new Error(`Sorry, your Cloud Shell failed to provision. Please retry later. Request correlation id: ${response.headers["x-ms-routing-request-id"]}`);
}

async function createTerminal(
	accessToken: string,
	armEndpoint: string,
	userSettings: IUserSettings,
	osType: string,
	initial: boolean) {
	return request({
		uri: getConsoleUri(armEndpoint),
		method: initial ? "PUT" : "GET",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
			"Authorization": `Bearer ${accessToken}`,
			"x-ms-console-preferred-location": userSettings.preferredLocation,
		},
		simple: false,
		resolveWithFullResponse: true,
		json: true,
		body: initial ? {
			properties: {
				osType,
			},
		} : undefined,
	});
}

export async function getStorageAccountKey(
	resourceGroup: string,
	subscriptionId: string,
	accessToken: string,
	storageAccountName: string) {
	return request({
		uri: `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Storage/storageAccounts/${storageAccountName}/listKeys?api-version=2017-06-01`,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${accessToken}`,
		},
		simple: false,
		resolveWithFullResponse: true,
		json: true,
	});
}

export async function resetConsole(accessToken: string, armEndpoint: string) {
	const response = await request({
		uri: getConsoleUri(armEndpoint),
		method: "DELETE",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
			"Authorization": `Bearer ${accessToken}`,
		},
		simple: false,
		resolveWithFullResponse: true,
		json: true,
	});

	if (response.statusCode < 200 || response.statusCode > 299) {
		if (response.body && response.body.error && response.body.error.message) {
			throw new Error(`${response.body.error.message} (${response.statusCode})`);
		} else {
			throw new Error(`${response.statusCode} ${response.headers} ${response.body}`);
		}
	}
}

async function connectTerminal(accessToken: string, consoleUri: string, tempFilePath: string) {
	console.log("Connecting terminal...");

	for (let i = 0; i < 10; i++) {
		const response = await initializeTerminal(accessToken, consoleUri);

		if (response.statusCode < 200 || response.statusCode > 299) {
			if (response.statusCode !== 503 && response.statusCode !== 504 && response.body && response.body.error) {
				if (response.body && response.body.error && response.body.error.message) {
					console.log(`${response.body.error.message} (${response.statusCode})`);
				} else {
					console.log(response.statusCode, response.headers, response.body);
				}
				break;
			}
			await delay(1000 * (i + 1));
			console.log(`\x1b[AConnecting terminal...${".".repeat(i + 1)}`);
			continue;
		}

		const res = response.body;
		const termId = res.id;
		// terminalIdleTimeout = res.idleTimeout || terminalIdleTimeout;

		const ws = connectSocket(res.socketUri);

		if (tempFilePath) {
			const RETRY_INTERVAL = 500;
			const RETRY_TIMES = 30;
			for (let m = 0; m < RETRY_TIMES; m++) {
				if (ws.readyState !== ws.OPEN) {
					await delay(RETRY_INTERVAL);
				} else {
					fsExtra.writeFileSync(tempFilePath, Date.now() + ": cloud shell web socket opened.\n");
					break;
				}
			}
		}

		process.stdout.on("resize", () => {
			resize(accessToken, consoleUri, termId)
				.catch(console.error);
		});

		return ws;
	}

	console.log("Failed to connect to the terminal.");
}

async function initializeTerminal(accessToken: string, consoleUri: string) {
	const initialGeometry = getWindowSize();
	return request({
		uri: consoleUri + "/terminals?cols=" + initialGeometry.cols + "&rows=" + initialGeometry.rows,
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Accept": "application/json",
			"Authorization": `Bearer ${accessToken}`,
		},
		simple: false,
		resolveWithFullResponse: true,
		json: true,
		body: {
			tokens: [],
		},
	});
}

function getWindowSize() {
	const stdout: any = process.stdout;
	const windowSize: [number, number] = stdout.isTTY ? stdout.getWindowSize() : [80, 30];
	return {
		cols: windowSize[0],
		rows: windowSize[1],
	};
}

let resizeToken = {};
async function resize(accessToken: string, consoleUri: string, termId: string) {
	const token = resizeToken = {};
	await delay(300);

	for (let i = 0; i < 10; i++) {
		if (token !== resizeToken) {
			return;
		}

		const { cols, rows } = getWindowSize();
		const response = await request({
			uri: consoleUri + "/terminals/" + termId + "/size?cols=" + cols + "&rows=" + rows,
			method: "POST",
			headers: {
				"Accept": "application/json",
				"Content-Type": "application/json",
				"Authorization": `Bearer ${accessToken}`,
			},
			simple: false,
			resolveWithFullResponse: true,
			json: true,
		});

		if (response.statusCode < 200 || response.statusCode > 299) {
			if (response.statusCode !== 503 && response.statusCode !== 504 && response.body && response.body.error) {
				if (response.body && response.body.error && response.body.error.message) {
					console.log(`${response.body.error.message} (${response.statusCode})`);
				} else {
					console.log(response.statusCode, response.headers, response.body);
				}
				break;
			}
			await delay(1000 * (i + 1));
			continue;
		}

		return;
	}

	console.log("Failed to resize terminal.");
}

export async function runInTerminal(accessToken: string, consoleUri: string, tempFile: string) {
	if (tempFile) {
		process.stdin.setRawMode!(true);
		process.stdin.resume();
	}

	return connectTerminal(accessToken, consoleUri, tempFile);
}

function connectSocket(url: string) {

	const ws = new WS(url);

	ws.on("open", () => {
		process.stdin.on("data", (data) => {
			ws.send(data);
		});
		startKeepAlive();
	});

	ws.on("message", (data) => {
		process.stdout.write(String(data));
	});

	ws.on("error", (error) => {
		console.log(error.toString());
	});

	ws.on("close", () => {
		console.log("websocket closed");
	});

	function startKeepAlive() {
		let isAlive = true;
		ws.on("pong", () => {
			isAlive = true;
		});
		const timer = setInterval(() => {
			if (isAlive === false) {
				console.log("Socket timeout");
				clearInterval(timer);
				if (ws) {
					ws.terminate();
				}
			} else {
				isAlive = false;
				if (ws && ws.readyState === ws.OPEN) {
					ws.ping();
				}
			}
		}, 60000 /* 60 seconds */);
		timer.unref();
	}

	return ws;
}

export async function delay(ms: number) {
	return new Promise<void>((resole) => setTimeout(resole, ms));
}

export function main() {
	const accessToken = process.env.CLOUD_CONSOLE_ACCESS_TOKEN!;
	const consoleUri = process.env.CLOUD_CONSOLE_URI!;
	const tempFile = process.env.CLOUDSHELL_TEMP_FILE!;
	return runInTerminal(accessToken, consoleUri, tempFile)
		.catch(console.error);
}
