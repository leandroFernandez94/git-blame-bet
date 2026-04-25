/**
 * Check if a URL points to an Azure DevOps repository.
 *
 * Matches both URL formats:
 * - `dev.azure.com` (modern)
 * - `*.visualstudio.com` (legacy)
 *
 * This is the single source of truth used by both frontend and backend
 * to detect ADO URLs, keeping detection logic in sync.
 */
export function isAzureDevOpsUrl(url: string): boolean {
  return /dev\.azure\.com/.test(url) || /\.visualstudio\.com/.test(url);
}
