import {
  GenericResourceExpanded,
  ResourceGroup,
  ResourceManagementClient,
} from "@azure/arm-resources";
import { AccessToken, TokenCredential } from "@azure/core-auth";
import {
  AzureSubscription,
  VSCodeAzureSubscriptionProvider,
} from "@microsoft/vscode-azext-azureauth";
import * as vscode from "vscode";

let currentSubscription: AzureSubscription | undefined;

export async function selectSubscription(
  forceRefresh = false
): Promise<AzureSubscription | undefined> {
  const provider = new VSCodeAzureSubscriptionProvider();

  // If a subscription was previously selected and we don't want to force a new selection,
  // return it early (but only if the provider still reports signed-in).
  if (!forceRefresh && currentSubscription) {
    try {
      const isSignedIn = await provider.isSignedIn();
      if (isSignedIn) {
        return currentSubscription;
      } else {
        // Clear cached subscription if sign-in state changed
        currentSubscription = undefined;
      }
    } catch (err) {
      // Ignore errors and continue with the full selection flow
    }
  }

  let newlySelectedSubscription: AzureSubscription | undefined;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Azure Sign-in & Subscription Selection",
      cancellable: false,
    },
    async (progress) => {
      progress.report({ message: "Checking Azure sign-in status..." });
      let isSignedIn = await provider.isSignedIn();
      if (!isSignedIn) {
        progress.report({ message: "Attempting Azure sign-in..." });
        try {
          await provider.signIn();
          isSignedIn = await provider.isSignedIn();
          if (!isSignedIn) {
            vscode.window.showErrorMessage(
              "Azure sign-in failed or was cancelled."
            );
            return;
          }
          progress.report({
            message: "Sign-in successful. Fetching subscriptions...",
          });
        } catch (error) {
          vscode.window.showErrorMessage(
            `Azure sign-in error: ${error.message || error}`
          );
          return;
        }
        progress.report({ message: "Fetching subscriptions..." });
      } else {
        progress.report({
          message: "Already signed in. Fetching subscriptions...",
        });
      }

      let subscriptions: AzureSubscription[] | undefined;
      try {
        subscriptions = await provider.getSubscriptions(false);
      } catch (error) {
        vscode.window.showErrorMessage(
          `Error fetching subscriptions: ${error.message || error}`
        );
        return;
      }

      if (!subscriptions || subscriptions.length === 0) {
        vscode.window.showErrorMessage(
          "No Azure subscriptions found for this account."
        );
        return;
      }

      progress.report({ message: "Waiting for subscription selection..." });

      const subPicks: Array<
        vscode.QuickPickItem & {
          subscription: AzureSubscription | null;
          isSignOut: boolean;
        }
      > = subscriptions.map((sub) => ({
        label: `$(azure) ${sub.name}`,
        description: sub.subscriptionId,
        detail: `$(key) Tenant: ${sub.tenantId} (${sub.environment.name})`,
        subscription: sub,
        isSignOut: false,
      }));

      subPicks.unshift({
        label: "$(sign-out) Sign into another account",
        description: "",
        subscription: null,
        isSignOut: true,
      });

      const selectedSubPick = await vscode.window.showQuickPick(subPicks, {
        placeHolder: "Select the Azure subscription",
        matchOnDescription: true,
        matchOnDetail: true,
        ignoreFocusOut: true,
      });

      if (!selectedSubPick) {
        vscode.window.showWarningMessage("Subscription selection cancelled.");
        return;
      }

      if (selectedSubPick.isSignOut) {
        vscode.window.showInformationMessage("Signing out of Azure account...");
        currentSubscription = undefined;
        await selectSubscription();
        return;
      }

      newlySelectedSubscription = selectedSubPick.subscription;
    }
  );

  if (newlySelectedSubscription) {
    currentSubscription = newlySelectedSubscription;
    vscode.window.showInformationMessage(
      `Using Tenant: ${currentSubscription.tenantId}, Subscription: ${currentSubscription.subscriptionId}`
    );
    return currentSubscription;
  } else {
    return undefined;
  }
}

export async function listAzureResourcesGrouped(
  credential: TokenCredential,
  subscriptionId: string
): Promise<Map<string, GenericResourceExpanded[]>> {
  const groupedResources = new Map<string, GenericResourceExpanded[]>();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Listing Azure Resources",
      cancellable: false, // Listing isn't easily cancellable mid-flight
    },
    async (progress) => {
      try {
        const resourceClient = new ResourceManagementClient(
          credential,
          subscriptionId
        );

        // 1. List all resource groups
        progress.report({ message: "Fetching resource groups..." });
        const resourceGroups: ResourceGroup[] = [];
        for await (const page of resourceClient.resourceGroups
          .list()
          .byPage()) {
          resourceGroups.push(...page);
        }

        if (resourceGroups.length === 0) {
          progress.report({
            message: "No resource groups found in the selected subscription.",
            increment: 100,
          });
          return;
        }

        // 2. For each group, list resources within it
        const totalGroups = resourceGroups.length;
        let groupsProcessed = 0;
        progress.report({
          message: `Found ${totalGroups} resource groups. Fetching resources...`,
        });

        const promises = resourceGroups.map(async (group) => {
          if (group.name) {
            try {
              const resourcesInGroup: GenericResourceExpanded[] = [];
              for await (const page of resourceClient.resources
                .listByResourceGroup(group.name)
                .byPage()) {
                resourcesInGroup.push(...page);
              }
              // Use a temporary map to avoid race conditions on the shared map
              if (resourcesInGroup.length > 0) {
                return { groupName: group.name, resources: resourcesInGroup };
              }
            } catch (listError) {
              console.error(
                `Error listing resources in group ${group.name}:`,
                listError
              );
              vscode.window.showWarningMessage(
                `Could not list resources in group '${group.name}'. Error: ${listError.message}. See console for details.`
              );
            }
          }
          return null;
        });

        // Process results concurrently
        const results = await Promise.all(promises);

        // Populate the final map and update progress
        results.forEach((result) => {
          if (result) {
            groupedResources.set(result.groupName, result.resources);
          }
          groupsProcessed++;
          const progressPercentage = (groupsProcessed / totalGroups) * 100;
          // Update progress less frequently to avoid flickering
          if (groupsProcessed % 5 === 0 || groupsProcessed === totalGroups) {
            progress.report({
              message: `Processing resource groups (${groupsProcessed}/${totalGroups})...`,
              increment: progressPercentage,
            });
          }
        });

        progress.report({
          message: "Finished listing resources.",
          increment: 100,
        });
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to list Azure resources by group: ${error.message}`
        );
        console.error("Resource Group Listing Error:", error);
      }
    }
  );

  return groupedResources;
}

export async function getAccessTokenFromSubscription(
  subscription: AzureSubscription,
  scope: string
): Promise<AccessToken | undefined> {
  if (!subscription) {
    vscode.window.showErrorMessage(
      "Cannot get access token: No Azure subscription provided."
    );
    return undefined;
  }
  try {
    // Use the credential from the specific subscription object
    return await subscription.credential.getToken(scope);
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to get access token for subscription '${subscription.name}': ${error.message}`
    );
    console.error("Access Token Error:", error);
    return undefined;
  }
}
