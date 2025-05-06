import { GenericResourceExpanded } from "@azure/arm-resources";
import { AzureSubscription } from "@microsoft/vscode-azext-azureauth";
import axios, { AxiosError } from "axios";
import * as vscode from "vscode";
import { getAccessTokenFromSubscription } from "./auth";

interface IExportRequestBody {
    type: "ExportResource" | "ExportResourceGroup";
    targetProvider: "azurerm";
    resourceIds?: string[];
    resourceGroupName?: string;
    resourceName?: string;
}

interface IPollingStatusResponse {
    status: string;
    id?: string;
    name?: string;
    startTime?: string;
    endTime?: string;
    error?: {
        code: string;
        message: string;
    };
    properties?: {
        configuration?: string;
        import?: string;
        skippedResources?: any;
        errors?: any;
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestTerraformExportWithPolling(
    subscription: AzureSubscription,
    requestBody: IExportRequestBody,
    progress: vscode.Progress<{ message?: string; increment?: number }>,
    token: vscode.CancellationToken,
    operationDescription: string,
): Promise<IPollingStatusResponse> {
    progress.report({ message: `Requesting access token for ${operationDescription}...` });
    const accessToken = await getAccessTokenFromSubscription(subscription, "https://management.azure.com/.default");
    if (!accessToken) {
        throw new Error("Failed to acquire Azure access token.");
    }

    const exportApiUrl = `https://management.azure.com/subscriptions/${subscription.subscriptionId}/providers/Microsoft.AzureTerraform/exportTerraform?api-version=2023-07-01-preview`;
    const headers = {
        "Authorization": `Bearer ${accessToken.token}`,
        "Content-Type": "application/json",
    };

    progress.report({ message: `Initiating Terraform export for ${operationDescription}...` });
    let response;
    try {
        response = await axios.post(exportApiUrl, requestBody, {
            headers,
            timeout: 45000, // Increased timeout for the initial request
            validateStatus: (status) => status === 200 || status === 202,
        });
    } catch (error) {
        handleExportError(error, operationDescription);
        throw error;
    }

    if (response.status === 200) {
        progress.report({ message: `Export for ${operationDescription} completed synchronously.`, increment: 100 });
        return {
            status: "Succeeded",
            properties: {
                configuration: response?.data?.properties?.configuration,
                import: response?.data?.properties?.import,
            },
        };
    }

    // --- Start Polling ---
    if (response.status === 202) {
        const locationUrl = response.headers["location"];
        let retryAfter = parseInt(response.headers["retry-after"] || "15", 10); // Default to 15 seconds

        if (!locationUrl) {
            throw new Error(`Export for ${operationDescription} started (202 Accepted) but no Location header received for polling.`);
        }

        progress.report({ message: `Export for ${operationDescription} in progress, polling for results...`, increment: 10 });
        const maxPollingTime = Date.now() + (5 * 60 * 1000); // 5 minutes timeout for polling

        while (Date.now() < maxPollingTime) {
            if (token.isCancellationRequested) {
                throw new Error(`Export operation for ${operationDescription} cancelled by user.`);
            }

            await sleep(retryAfter * 1000);

            progress.report({ message: `Polling status for ${operationDescription}...`, increment: 5 }); // Simplified message

            try {
                const pollResponse = await axios.get<IPollingStatusResponse>(locationUrl, {
                    headers,
                    timeout: 30000,
                });

                const operationStatus = pollResponse.data?.status;

                if (operationStatus === "Succeeded") {
                    progress.report({ message: `Export for ${operationDescription} succeeded.`, increment: 100 });
                    return pollResponse.data;
                } else if (operationStatus === "Failed") {
                    const errorDetails = pollResponse.data?.error?.message || "Unknown error during async operation.";
                    // Provide more specific error from polling response
                    throw new Error(`Export operation for ${operationDescription} failed on Azure: ${errorDetails}`);
                } else if (operationStatus === "Canceled") {
                     throw new Error(`Export operation for ${operationDescription} was canceled on the server.`);
                }

                progress.report({ message: `Export for ${operationDescription} still running...`, increment: 2 }); // Small increment while running

                retryAfter = parseInt(pollResponse.headers["retry-after"] || `${retryAfter}`, 10);

            } catch (pollError) {
                 if (axios.isAxiosError(pollError)) {
                    if (pollError.response?.status === 404 && Date.now() > maxPollingTime - 60000) {
                        console.warn(`Polling URL for ${operationDescription} returned 404 near timeout, assuming failure.`);
                        throw new Error(`Polling for ${operationDescription} failed (URL not found near timeout).`);
                    }
                    // Include status code for other polling errors
                    const statusText = pollError.response?.status ? ` (Status: ${pollError.response.status})` : "";
                    throw new Error(`Error during polling for ${operationDescription}${statusText}: ${pollError.message}`);
                 }
                 // Re-throw non-Axios errors
                 throw pollError;
            }
        }
        // If loop finishes without success
        throw new Error(`Export operation for ${operationDescription} timed out after 5 minutes.`);
    }

    // Fallback for unexpected status codes
    throw new Error(`Unexpected initial response status for ${operationDescription}: ${response.status}`);
}

async function handleExportSuccess(pollingResult: IPollingStatusResponse, operationDescription: string): Promise<void> {
    const terraformConfig = pollingResult.properties?.configuration;
    const importBlock = pollingResult.properties?.import;
    const skippedResources = pollingResult.properties?.skippedResources;
    const errors = pollingResult.properties?.errors;

    if (!terraformConfig) {
        vscode.window.showWarningMessage(`Export for ${operationDescription} completed, but the response did not contain Terraform configuration.`);
        console.warn("Export Success Response (missing configuration):", pollingResult);
        return;
    }

    let commentBlock = `# Terraform Export Details for: ${operationDescription}\n`;
    commentBlock += `# Operation ID: ${pollingResult.id || "N/A"}\n`;
    commentBlock += `# Operation Name: ${pollingResult.name || "N/A"}\n`;
    commentBlock += `# Start Time: ${pollingResult.startTime || "N/A"}\n`;
    commentBlock += `# End Time: ${pollingResult.endTime || "N/A"}\n`;

    if (skippedResources && (!Array.isArray(skippedResources) || skippedResources.length > 0)) {
        commentBlock += `# Skipped Resources: ${JSON.stringify(skippedResources)}\n`;
    } else {
        commentBlock += `# Skipped Resources: None\n`;
    }

    if (errors && (!Array.isArray(errors) || errors.length > 0)) {
        commentBlock += `# Errors Encountered: ${JSON.stringify(errors)}\n`;
    } else {
        commentBlock += `# Errors Encountered: None\n`;
    }

    if (importBlock) {
        commentBlock += `#\n# Associated Import Block:\n`;
        commentBlock += importBlock.split("\n").map((line) => `# ${line}`).join("\n");
        commentBlock += "\n";
    }
    commentBlock += "# --- End of Export Details ---\n\n";

    const fullSnippet = commentBlock + terraformConfig;

    try {
        const doc = await vscode.workspace.openTextDocument({
            content: fullSnippet,
            language: "terraform",
        });
        await vscode.window.showTextDocument(doc, { preview: false });

        vscode.window.showInformationMessage(`Terraform export for ${operationDescription} complete. Snippet opened in a new tab.`);

        // Optionally show warnings if resources were skipped or non-fatal errors occurred
        if (skippedResources && (!Array.isArray(skippedResources) || skippedResources.length > 0)) {
             vscode.window.showWarningMessage(`Some resources were skipped during the export for ${operationDescription}. See comments in the generated file.`);
        }
        if (errors && (!Array.isArray(errors) || errors.length > 0)) {
             vscode.window.showWarningMessage(`Some non-fatal errors occurred during the export for ${operationDescription}. See comments in the generated file.`);
        }

    } catch (error) {
        const typedError = error as Error;
        console.error(`Failed to open exported snippet for ${operationDescription}:`, typedError);
        vscode.window.showErrorMessage(`Failed to open snippet for ${operationDescription} in a new tab: ${typedError.message}. It has been copied to your clipboard instead.`);
        await vscode.env.clipboard.writeText(fullSnippet);
    }
}

function handleExportError(error: any, operationDescription: string): void {
    console.error(`Terraform Export Error (${operationDescription}):`, error);
    let userMessage = `Failed to export ${operationDescription}.`;
    let detailedMessage = error instanceof Error ? error.message : String(error);

    if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<any>;
        userMessage = `Network or API error during export for ${operationDescription}.`;
        detailedMessage = `Request to ${axiosError.config?.url} failed`;
        if (axiosError.response) {
            // Got a response from the server (4xx, 5xx)
            detailedMessage += ` with status ${axiosError.response.status}.`;
            const responseData = axiosError.response.data;
            // Try to extract Azure's specific error format
            const azureError = responseData?.error?.message || responseData?.Message; // Check common Azure error formats
            if (azureError) {
                detailedMessage += ` Azure Error: ${azureError}`;
            } else if (typeof responseData === "string" && responseData.length < 200) { // Show short string errors
                 detailedMessage += ` Details: ${responseData}`;
            } else {
                 detailedMessage += ` Check the console log for full response details.`;
                 console.error("Full Axios Error Response:", axiosError.response);
            }
        } else if (axiosError.request) {
            // Request was made, but no response received (network issue, timeout)
            detailedMessage += `. No response received from the server. Check network connection or Azure status.`;
        } else {
            // Error setting up the request
            detailedMessage += `. Error setting up the request: ${axiosError.message}`;
        }
    } else if (error instanceof Error) {
        // Handle specific errors thrown within our code (timeout, cancellation, polling failure)
        userMessage = `Export process for ${operationDescription} failed.`;
        detailedMessage = error.message;
    } else {
        // Fallback for unexpected error types
         userMessage = `An unexpected error occurred during export for ${operationDescription}.`;
         detailedMessage = `Check the console log for details.`;
    }

    // Show a more informative error message to the user
    vscode.window.showErrorMessage(`${userMessage} ${detailedMessage}`, { modal: false }); // Don't block UI with modal
}

/**
 * Exports a single Azure resource to Terraform.
 */
export async function ExportSingleResource(
    subscription: AzureSubscription,
    resource: GenericResourceExpanded,
): Promise<void> {
    const operationType = `resource '${resource.name || "unnamed-resource"}'`;
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Exporting Azure resource to Terraform`,
        cancellable: true, // Allow cancellation during polling
    }, async (progress, token) => {
        try {
            if (!resource.id) {
                throw new Error("Selected resource is missing a valid ID.");
            }

            progress.report({ message: `Preparing export for ${operationType}...` });

            const requestBody: IExportRequestBody = {
                type: "ExportResource",
                targetProvider: "azurerm",
                resourceIds: [resource.id],
                resourceName: resource.name || "unnamed-resource",
            };

            // Call the function that handles polling
            const finalPollingData = await requestTerraformExportWithPolling(subscription, requestBody, progress, token, operationType);
            // Handle the successful result
            await handleExportSuccess(finalPollingData, operationType);

        } catch (error) {
            // Handle errors from preparation or polling
            handleExportError(error, operationType);
        }
    });
}

/**
 * Exports all resources within a specified Azure resource group to Terraform.
 */
export async function ExportResourceGroup(
    subscription: AzureSubscription,
    resources: GenericResourceExpanded[],
    resourceGroupName: string,
): Promise<void> {
    const operationType = `resource group '${resourceGroupName}'`;
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Exporting Azure resource group to Terraform`,
        cancellable: true, // Allow cancellation during polling
    }, async (progress, token) => {
        try {
            if (!resourceGroupName) {
                throw new Error("Resource group name is required for exporting an entire group.");
            }
            if (resources.length === 0) {
                // Report progress instead of just showing info message
                progress.report({ message: `Resource group '${resourceGroupName}' is empty. Nothing to export.`, increment: 100 });
                vscode.window.showInformationMessage(`Resource group '${resourceGroupName}' is empty. Nothing to export.`);
                return;
            }

            progress.report({ message: `Preparing export for ${resources.length} resources in ${operationType}...` });

            const requestBody: IExportRequestBody = {
                type: "ExportResourceGroup",
                targetProvider: "azurerm",
                resourceGroupName,
            };

            // Call the function that handles polling
            const finalPollingData = await requestTerraformExportWithPolling(subscription, requestBody, progress, token, operationType);
             // Handle the successful result
            await handleExportSuccess(finalPollingData, operationType);
        } catch (error) {
             // Handle errors from preparation or polling
            handleExportError(error, operationType);
        }
    });
}
