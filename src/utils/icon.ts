export function getIconForResourceType(resourceType?: string): string {
  if (!resourceType) {
    return "$(symbol-misc)";
  } // Default icon

  const typeLower = resourceType.toLowerCase();

  if (typeLower.includes("virtualmachines")) {
    return "$(vm)";
  }
  if (typeLower.includes("storageaccounts")) {
    return "$(database)";
  }
  if (typeLower.includes("networkinterfaces")) {
    return "$(plug)";
  }
  if (typeLower.includes("virtualnetworks")) {
    return "$(circuit-board)";
  }
  if (typeLower.includes("publicipaddresses")) {
    return "$(globe)";
  }
  if (typeLower.includes("sql/servers")) {
    return "$(server-process)";
  }
  if (typeLower.includes("keyvaults")) {
    return "$(key)";
  }
  if (typeLower.includes("appservice/plans")) {
    return "$(server-environment)";
  }
  if (typeLower.includes("web/sites")) {
    return "$(browser)";
  }

  return "$(symbol-misc)"; // Default for unmapped types
}
