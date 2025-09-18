"use strict";

import * as vscode from "vscode";
import * as cp from "child_process";
import type { AzureSubscription } from "@microsoft/vscode-azext-azureauth";
import { getAccessTokenFromSubscription } from "./auth";
import { PreflightPath } from "./preflightPath";
import {
  PreflightSummary,
  createPreflightLogParser,
} from "./preflightLogParser";

// Run aztfpreflight with JSON output and parse results
export async function runPreflightValidation(
  subscription: AzureSubscription,
  context: vscode.ExtensionContext,
  cwd: string,
  planInputPath: string
): Promise<PreflightSummary | undefined> {
  const accessToken = await getAccessTokenFromSubscription(
    subscription,
    "https://management.azure.com/.default"
  );
  if (!accessToken) {
    vscode.window.showErrorMessage(
      "Failed to acquire Azure access token for the selected subscription."
    );
    return undefined;
  }

  // Resolve binary using the same strategy as ServerPath
  const pfPath = new PreflightPath(context);
  const executable = await pfPath.resolvedPathToBinary();

  const args = ["-i", planInputPath, "-j"]; // Add -j for JSON output

  const env = {
    ...process.env,
    AZURE_ACCESS_TOKEN: accessToken.token,
    ARM_SUBSCRIPTION_ID: subscription.subscriptionId,
  };

  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Running Preflight Validation",
      cancellable: true,
    },
    async (progress, token) => {
      return new Promise<PreflightSummary | undefined>((resolve, reject) => {
        const parser = createPreflightLogParser();

        progress.report({ increment: 0, message: "Starting validation..." });

        const child = cp.spawn(executable, args, {
          cwd,
          env,
          stdio: ["pipe", "pipe", "pipe"],
        });

        const outputChannel = vscode.window.createOutputChannel(
          "Terraform: Preflight"
        );

        // Handle cancellation
        token.onCancellationRequested(() => {
          child.kill();
          reject(new Error("Preflight validation was cancelled"));
        });

        let lastResourceCount = 0;

        child.stdout?.on("data", (data: Buffer) => {
          const chunk = data.toString();
          outputChannel.append(chunk);

          // Parse each line as it comes in
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.trim()) {
              parser.parseLine(line);
            }
          }

          // Update progress based on parsed resources
          const currentSummary = parser.getSummary();
          const currentResourceCount = currentSummary.totalResources;

          if (currentResourceCount > lastResourceCount) {
            lastResourceCount = currentResourceCount;
            progress.report({
              increment: 10,
              message: `Analyzing resources... (${currentResourceCount} processed)`,
            });
          }
        });

        child.stderr?.on("data", (data: Buffer) => {
          const chunk = data.toString();
          outputChannel.append(`STDERR: ${chunk}`);

          // Also try to parse stderr for JSON logs (some aztfpreflight output goes to stderr)
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.trim()) {
              parser.parseLine(line);
            }
          }
        });

        child.on("close", (code) => {
          progress.report({
            increment: 90,
            message: "Finalizing validation...",
          });

          const summary = parser.getSummary();

          // Show summary in output channel
          outputChannel.appendLine("\n=== Preflight Validation Summary ===");
          outputChannel.appendLine(
            `Total resources analyzed: ${summary.totalResources}`
          );
          outputChannel.appendLine(
            `Resources validated successfully: ${summary.successfulResources}`
          );
          outputChannel.appendLine(
            `Resources failed to extract request body: ${summary.failedResources}`
          );
          outputChannel.appendLine(
            `Validation errors encountered: ${summary.errors.length}`
          );

          if (summary.errors.length > 0) {
            outputChannel.appendLine(
              `\nErrors found: ${summary.errors.length}`
            );
            summary.errors.forEach((error, index) => {
              outputChannel.appendLine(`\nError ${index + 1}:`);
              outputChannel.appendLine(`  Message: ${error.message}`);
            });
          }

          progress.report({ increment: 100, message: "Validation complete" });

          if (code === 0) {
            // Determine message type and content
            const hasErrors = summary.errors.length > 0;
            const hasFailedExtractions = summary.failedResources > 0;

            if (!hasErrors && !hasFailedExtractions) {
              // Complete success
              vscode.window
                .showInformationMessage(
                  `Preflight validation successful! ${summary.successfulResources} resources validated.`,
                  "Show Output"
                )
                .then((choice) => {
                  if (choice === "Show Output") {
                    outputChannel.show();
                  }
                });
            } else {
              // Build warning message
              let message = `Preflight validation completed: ${summary.successfulResources} resources validated successfully`;
              const issues = [];

              if (hasErrors) {
                issues.push(`${summary.errors.length} validation error(s)`);
              }

              if (hasFailedExtractions) {
                issues.push(
                  `${summary.failedResources} failed resource extraction(s)`
                );
              }

              if (issues.length > 0) {
                message += `, ${issues.join(" and ")}.`;
              }

              if (hasErrors) {
                message += ` See output for all error details.`;
              }

              vscode.window
                .showWarningMessage(message, "Show Output")
                .then((choice) => {
                  if (choice === "Show Output") {
                    outputChannel.show();
                  }
                });
            }
            resolve(summary);
          } else {
            vscode.window
              .showErrorMessage(
                `Preflight validation failed with exit code ${code}. Check the output for details.`,
                "Show Output"
              )
              .then((choice) => {
                if (choice === "Show Output") {
                  outputChannel.show();
                }
              });
            reject(
              new Error(`Preflight validation failed with exit code ${code}`)
            );
          }
        });

        child.on("error", (error) => {
          outputChannel.appendLine(`\nExecution error: ${error.message}`);
          vscode.window
            .showErrorMessage(
              `Failed to execute preflight validation: ${error.message}`,
              "Show Output"
            )
            .then((choice) => {
              if (choice === "Show Output") {
                outputChannel.show();
              }
            });
          reject(error);
        });
      });
    }
  );
}
