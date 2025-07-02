import { GenericResourceExpanded } from "@azure/arm-resources";
import { AzureSubscription } from "@microsoft/vscode-azext-azureauth";
import axios, { AxiosError } from "axios";
import * as vscode from "vscode";
import { getAccessTokenFromSubscription } from "./auth";

interface IExportRequestBody {
  type: "ExportResource" | "ExportResourceGroup";
  targetProvider: string;
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
    skippedResources?: Array<{
      id?: string;
      reason?: string;
      [key: string]: any;
    }>; // More specific type
    errors?: Array<{
      code?: string;
      message?: string;
      target?: string;
      [key: string]: any;
    }>; // More specific type
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
  extensionVersion: string
): Promise<IPollingStatusResponse> {
  progress.report({
    message: `Requesting access token for ${operationDescription}...`,
  });
  const accessToken = await getAccessTokenFromSubscription(
    subscription,
    "https://management.azure.com/.default"
  );
  if (!accessToken) {
    throw new Error("Failed to acquire Azure access token.");
  }

  const exportApiUrl = `https://management.azure.com/subscriptions/${subscription.subscriptionId}/providers/Microsoft.AzureTerraform/exportTerraform?api-version=2023-07-01-preview`;
  const headers = {
    Authorization: `Bearer ${accessToken.token}`,
    "Content-Type": "application/json",
    "User-Agent": `Microsoft Terraform Extension - ${extensionVersion}`,
  };

  progress.report({
    message: `Initiating Terraform export for ${operationDescription}...`,
  });
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
    progress.report({
      message: `Export for ${operationDescription} completed synchronously.`,
      increment: 100,
    });
    // Ensure structure aligns with IPollingStatusResponse for consistent handling in handleExportSuccess
    return {
      status: "Succeeded", // Explicitly set status
      id: response.data?.id, // Pass along if available
      name: response.data?.name, // Pass along if available
      startTime: response.data?.startTime, // Pass along if available
      endTime: response.data?.endTime, // Pass along if available
      properties: {
        configuration: response.data?.properties?.configuration,
        import: response.data?.properties?.import,
        skippedResources: response.data?.properties?.skippedResources || [], // Default to empty array
        errors: response.data?.properties?.errors || [], // Default to empty array
      },
    };
  }

  // --- Start Polling ---
  if (response.status === 202) {
    const locationUrl = response.headers["location"];
    let retryAfter = parseInt(response.headers["retry-after"] || "15", 10); // Default to 15 seconds

    if (!locationUrl) {
      throw new Error(
        `Export for ${operationDescription} started (202 Accepted) but no Location header received for polling.`
      );
    }

    progress.report({
      message: `Export for ${operationDescription} in progress, polling for results...`,
      increment: 10,
    });
    const maxPollingTime = Date.now() + 5 * 60 * 1000; // 5 minutes timeout for polling

    while (Date.now() < maxPollingTime) {
      if (token.isCancellationRequested) {
        throw new Error(
          `Export operation for ${operationDescription} cancelled by user.`
        );
      }

      await sleep(retryAfter * 1000);

      progress.report({
        message: `Polling status for ${operationDescription}...`,
        increment: 5,
      }); // Simplified message

      try {
        const pollResponse = await axios.get<IPollingStatusResponse>(
          locationUrl,
          {
            headers,
            timeout: 30000,
          }
        );

        const operationStatus = pollResponse.data?.status;

        if (operationStatus === "Succeeded") {
          progress.report({
            message: `Export for ${operationDescription} succeeded.`,
            increment: 100,
          });
          return pollResponse.data;
        } else if (operationStatus === "Failed") {
          const errorDetails =
            pollResponse.data?.error?.message ||
            "Unknown error during async operation.";
          // Attempt to get more specific errors from properties if available
          let detailedErrorsMessage = "";
          if (
            pollResponse.data?.properties?.errors &&
            Array.isArray(pollResponse.data.properties.errors) &&
            pollResponse.data.properties.errors.length > 0
          ) {
            detailedErrorsMessage = pollResponse.data.properties.errors
              .map(
                (e) =>
                  `${e.code || "Error"}: ${e.message || "Details not provided"}`
              )
              .join("; ");
          }
          throw new Error(
            `Export operation for ${operationDescription} failed on Azure: ${errorDetails}${
              detailedErrorsMessage ? `. Details: ${detailedErrorsMessage}` : ""
            }`
          );
        } else if (operationStatus === "Canceled") {
          throw new Error(
            `Export operation for ${operationDescription} was canceled on the server.`
          );
        }

        progress.report({
          message: `Export for ${operationDescription} still running...`,
          increment: 2,
        }); // Small increment while running

        retryAfter = parseInt(
          pollResponse.headers["retry-after"] || `${retryAfter}`,
          10
        );
      } catch (pollError) {
        if (axios.isAxiosError(pollError)) {
          if (
            pollError.response?.status === 404 &&
            Date.now() > maxPollingTime - 60000
          ) {
            console.warn(
              `Polling URL for ${operationDescription} returned 404 near timeout, assuming failure.`
            );
            throw new Error(
              `Polling for ${operationDescription} failed (URL not found near timeout).`
            );
          }
          // Include status code for other polling errors
          const statusText = pollError.response?.status
            ? ` (Status: ${pollError.response.status})`
            : "";
          throw new Error(
            `Error during polling for ${operationDescription}${statusText}: ${pollError.message}`
          );
        }
        // Re-throw non-Axios errors
        throw pollError;
      }
    }
    // If loop finishes without success
    throw new Error(
      `Export operation for ${operationDescription} timed out after 5 minutes.`
    );
  }

  // Fallback for unexpected status codes
  throw new Error(
    `Unexpected initial response status for ${operationDescription}: ${response.status}`
  );
}

async function handleExportSuccess(
  pollingResult: IPollingStatusResponse,
  operationDescription: string
): Promise<void> {
  const terraformConfig = pollingResult.properties?.configuration;
  const importBlock = pollingResult.properties?.import;
  // Ensure skippedResources and errors are arrays for consistent processing
  const skippedResources = Array.isArray(
    pollingResult.properties?.skippedResources
  )
    ? pollingResult.properties.skippedResources
    : [];
  const errors = Array.isArray(pollingResult.properties?.errors)
    ? pollingResult.properties.errors
    : [];

  if (!terraformConfig) {
    vscode.window.showWarningMessage(
      `Export for ${operationDescription} completed, but the response did not contain Terraform configuration.`
    );
    console.warn(
      "Export Success Response (missing configuration):",
      pollingResult
    );
    return;
  }

  let commentBlock = `# Terraform Export Details for: ${operationDescription}\n`;
  commentBlock += `# Operation ID: ${pollingResult.id || "N/A"}\n`;
  commentBlock += `# Operation Name: ${pollingResult.name || "N/A"}\n`;
  commentBlock += `# Start Time: ${pollingResult.startTime || "N/A"}\n`;
  commentBlock += `# End Time: ${pollingResult.endTime || "N/A"}\n`;

  if (skippedResources.length > 0) {
    commentBlock += `# Skipped Resources: ${JSON.stringify(
      skippedResources
    )}\n`;
  } else {
    commentBlock += `# Skipped Resources: None\n`;
  }

  if (errors.length > 0) {
    commentBlock += `# Errors Encountered (non-fatal or informational): ${JSON.stringify(
      errors
    )}\n`;
  } else {
    commentBlock += `# Errors Encountered: None\n`;
  }

  if (importBlock) {
    commentBlock += `#\n# Associated Import Block:\n`;
    commentBlock += importBlock
      .split("\n")
      .map((line) => `# ${line}`)
      .join("\n");
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

    vscode.window.showInformationMessage(
      `Terraform export for ${operationDescription} complete. Snippet opened in a new tab.`
    );

    // Optionally show warnings if resources were skipped or non-fatal errors occurred
    if (skippedResources.length > 0) {
      vscode.window.showWarningMessage(
        `Some resources were skipped during the export for ${operationDescription}. See comments in the generated file.`
      );
    }
    // Note: 'errors' here are from the 'properties' block, typically non-fatal if status is 'Succeeded'.
    // Fatal errors would have thrown an exception earlier.
    if (errors.length > 0) {
      vscode.window.showWarningMessage(
        `Some non-fatal issues or informational messages were reported during the export for ${operationDescription}. See comments in the generated file.`
      );
    }
  } catch (error) {
    const typedError = error as Error;
    console.error(
      `Failed to open exported snippet for ${operationDescription}:`,
      typedError
    );
    vscode.window.showErrorMessage(
      `Failed to open snippet for ${operationDescription} in a new tab: ${typedError.message}. It has been copied to your clipboard instead.`
    );
    await vscode.env.clipboard.writeText(fullSnippet);
  }
}

function handleExportError(error: any, operationDescription: string): void {
  console.error(`Terraform Export Error (${operationDescription}):`, error);
  let userMessage = `Failed to export ${operationDescription}.`;
  let detailedMessage = error instanceof Error ? error.message : String(error); // Default to error.message

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    userMessage = `Network or API error during export for ${operationDescription}.`;
    detailedMessage = `Request to ${
      axiosError.config?.url || "Azure API"
    } failed`;
    if (axiosError.response) {
      detailedMessage += ` with status ${axiosError.response.status}.`;
      const responseData = axiosError.response.data;
      const azureError = responseData?.error?.message || responseData?.Message;
      let specificDetails = "";
      // Check for Azure's structured error details within properties.errors as well
      if (
        responseData?.properties?.errors &&
        Array.isArray(responseData.properties.errors) &&
        responseData.properties.errors.length > 0
      ) {
        specificDetails = responseData.properties.errors
          .map(
            (e: any) =>
              `${e.code || "Error"}: ${e.message || "Details not provided"}`
          )
          .join("; ");
      } else if (azureError) {
        specificDetails = azureError;
      }

      if (specificDetails) {
        detailedMessage += ` Azure Error: ${specificDetails}`;
      } else if (
        typeof responseData === "string" &&
        responseData.length < 200 &&
        responseData.length > 0
      ) {
        detailedMessage += ` Details: ${responseData}`;
      } else {
        detailedMessage += ` Check the extension's output channel or console log for full response details.`;
        console.error("Full Axios Error Response Data:", responseData);
      }
    } else if (axiosError.request) {
      detailedMessage += `. No response received. Check network or Azure service status.`;
    } else {
      detailedMessage += `. Error setting up request: ${axiosError.message}`;
    }
  } else if (error instanceof Error) {
    // This will now catch errors thrown from polling logic with more details
    userMessage = `Export process for ${operationDescription} encountered an issue.`;
    // detailedMessage is already set from error.message which should be more specific now
  } else {
    userMessage = `An unexpected issue occurred during export for ${operationDescription}.`;
    detailedMessage = `Check the extension's output channel or console log for details.`;
    console.error("Unexpected Export Error Type:", error);
  }

  vscode.window.showErrorMessage(`${userMessage} ${detailedMessage}`, {
    modal: false,
  });
}

/**
 * Exports a single Azure resource to Terraform.
 */
export async function ExportSingleResource(
  subscription: AzureSubscription,
  resource: GenericResourceExpanded,
  targetProvider: string,
  extensionVersion: string
): Promise<void> {
  const operationType = `resource '${resource.name || "unnamed-resource"}'`;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Exporting Azure resource to Terraform`,
      cancellable: true, // Allow cancellation during polling
    },
    async (progress, token) => {
      try {
        if (!resource.id) {
          throw new Error("Selected resource is missing a valid ID.");
        }

        progress.report({
          message: `Preparing export for ${operationType}...`,
        });

        const requestBody: IExportRequestBody = {
          type: "ExportResource",
          targetProvider: targetProvider,
          resourceIds: [resource.id],
          resourceName: resource.name || "unnamed-resource",
        };

        // Call the function that handles polling
        const finalPollingData = await requestTerraformExportWithPolling(
          subscription,
          requestBody,
          progress,
          token,
          operationType,
          extensionVersion
        );
        // Handle the successful result
        await handleExportSuccess(finalPollingData, operationType);
      } catch (error) {
        // Handle errors from preparation or polling
        handleExportError(error, operationType);
      }
    }
  );
}

/**
 * Exports all resources within a specified Azure resource group to Terraform.
 */
export async function ExportResourceGroup(
  subscription: AzureSubscription,
  resources: GenericResourceExpanded[],
  resourceGroupName: string,
  targetProvider: string,
  extensionVersion: string
): Promise<void> {
  const operationType = `resource group '${resourceGroupName}'`;
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Exporting Azure resource group to Terraform`,
      cancellable: true, // Allow cancellation during polling
    },
    async (progress, token) => {
      try {
        if (!resourceGroupName) {
          throw new Error(
            "Resource group name is required for exporting an entire group."
          );
        }
        if (resources.length === 0) {
          // Report progress instead of just showing info message
          progress.report({
            message: `Resource group '${resourceGroupName}' is empty. Nothing to export.`,
            increment: 100,
          });
          vscode.window.showInformationMessage(
            `Resource group '${resourceGroupName}' is empty. Nothing to export.`
          );
          return;
        }

        progress.report({
          message: `Preparing export for ${resources.length} resources in ${operationType}...`,
        });

        const requestBody: IExportRequestBody = {
          type: "ExportResourceGroup",
          targetProvider: targetProvider,
          resourceGroupName,
        };

        // Call the function that handles polling
        const finalPollingData = await requestTerraformExportWithPolling(
          subscription,
          requestBody,
          progress,
          token,
          operationType,
          extensionVersion
        );
        // Handle the successful result
        await handleExportSuccess(finalPollingData, operationType);
      } catch (error) {
        // Handle errors from preparation or polling
        handleExportError(error, operationType);
      }
    }
  );
}
