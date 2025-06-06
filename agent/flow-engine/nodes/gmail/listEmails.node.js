/**
 * @typedef {import('../../types/flow-types.jsdoc.js').NodeDefinition} NodeDefinition
 * @typedef {import('../../types/flow-types.jsdoc.js').InputDefinition} InputDefinition
 * @typedef {import('../../types/flow-types.jsdoc.js').OutputDefinition} OutputDefinition
 * @typedef {import('../../types/flow-types.jsdoc.js').EdgeDefinition} EdgeDefinition
 */

import { google } from 'googleapis';

// Helper function to refresh the access token.
// In a larger system, this might be part of a shared GoogleAuth utility.
async function refreshAccessToken(accountDetails, stateManager, accountStatePath) {
    const { refreshToken, clientId, clientSecret } = accountDetails;

    if (!refreshToken) {
        // console.warn(`[refreshAccessToken] No refresh token found for account at ${accountStatePath}. Cannot refresh.`);
        return { success: false, error: "No refresh token available. Re-authentication required.", critical: true };
    }
    if (!clientId || !clientSecret) {
        // console.warn(`[refreshAccessToken] Client ID or Client Secret missing for account at ${accountStatePath}. Cannot refresh.`);
        return { success: false, error: "Client ID or Client Secret missing. Check connection setup.", critical: true };
    }

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    try {
        // console.log(`[refreshAccessToken] Attempting to refresh access token for ${accountStatePath}`);
        const { token: newAccessToken, res } = await oauth2Client.getAccessToken();

        if (!newAccessToken) {
            const errorMessage = "Failed to obtain new access token during refresh. Response was empty.";
            // console.error(`[refreshAccessToken] ${errorMessage}`, res);
            return { success: false, error: errorMessage, details: res?.data, critical: true };
        }

        const newExpiryDate = oauth2Client.credentials.expiry_date;

        // Update the state with the new token and expiry
        const updatedAccountDetails = {
            ...accountDetails,
            accessToken: newAccessToken,
            tokenExpiryTime: newExpiryDate,
            lastRefreshed: Date.now()
        };
        stateManager.set(accountStatePath, updatedAccountDetails);
        // console.log(`[refreshAccessToken] Access token refreshed successfully for ${accountStatePath}. New expiry: ${new Date(newExpiryDate).toISOString()}`);
        return { success: true, newAccessToken, newExpiryTime: newExpiryDate };

    } catch (error) {
        const errorMessage = `Error refreshing access token: ${error.message}`;
        // console.error(`[refreshAccessToken] ${errorMessage}`, error.response?.data || error);
        // If refresh fails, often the refresh token is invalid, requiring full re-auth
        if (error.response?.data?.error === 'invalid_grant') {
             stateManager.set(`${accountStatePath}.auth_status`, 'refresh_failed_invalid_grant');
        }
        return { success: false, error: errorMessage, details: error.response?.data, critical: true };
    }
}


/** @type {NodeDefinition} */
export default {
    id: "google.gmail.listEmails",
    version: "1.1.0", // Version incremented for refresh token logic
    name: "List Gmail Emails (with Token Refresh)",
    description: "Lists emails from a connected Gmail account matching specified criteria. Automatically attempts to refresh the access token if expired, using a stored refresh token. Expects OAuth2 token details (including refresh_token, client_id, client_secret) to be available in state via `accountStatePath`.",
    categories: ["Google", "Gmail", "Communication", "Productivity"],
    tags: ["gmail", "email", "list", "search", "google api", "oauth2", "automation"],
    inputs: [
        {
            name: "accountStatePath",
            type: "string",
            description: "Path in the state where Gmail account connection details (e.g., { accessToken, refreshToken, clientId, clientSecret, tokenExpiryTime, userId }) are stored. Example: 'google.connections.myGmailAccount'.",
            required: true,
            example: "google.connections.primaryGmail"
        },
        {
            name: "query",
            type: "string",
            description: "Gmail search query string. Examples: 'from:boss@example.com', 'subject:urgent report', 'is:unread has:attachment'.",
            required: false,
            example: "is:important after:2023/01/01 before:2023/01/31"
        },
        {
            name: "labelIds",
            type: "array",
            itemType: "string",
            description: "Array of label IDs to filter emails by (e.g., 'INBOX', 'UNREAD', 'STARRED', or custom label IDs). Emails must match all specified label IDs.",
            required: false,
            example: ["INBOX", "IMPORTANT"]
        },
        {
            name: "maxResults",
            type: "number",
            description: "Maximum number of emails to return per page.",
            required: false,
            defaultValue: 100,
            example: 50
        },
        {
            name: "pageToken",
            type: "string",
            description: "Token to retrieve a specific page of results, obtained from a previous 'List Gmail Emails' call.",
            required: false,
            example: "CiAKGhVmc..."
        },
        {
            name: "includeSpamTrash",
            type: "boolean",
            description: "Whether to include messages from SPAM and TRASH in the results. Defaults to false.",
            required: false,
            defaultValue: false,
            example: true
        },
        {
            name: "userId",
            type: "string",
            description: "The user's email address or the special value 'me' to indicate the authenticated user. If not provided, tries to use `userId` from `accountStatePath` or defaults to 'me'.",
            required: false,
            defaultValue: "me",
            example: "user@example.com"
        }
    ],
    outputs: [
        {
            name: "emails",
            type: "array",
            description: "An array of email message resources (objects with id, threadId, snippet, etc.) matching the criteria.",
            example: [{ id: "msg123", threadId: "thread456", snippet: "Hello world snippet..." }]
        },
        {
            name: "nextPageToken",
            type: "string",
            description: "A token that can be used in a subsequent call to retrieve the next page of results. Null if no more pages.",
            example: "RANDOM_PAGE_TOKEN_XYZ"
        },
        {
            name: "resultSizeEstimate",
            type: "number",
            description: "The estimated total number of results matching the query (can be inaccurate for complex queries).",
            example: 127
        }
    ],
    edges: [
        { name: "success", description: "Emails listed successfully." },
        { name: "no_results", description: "No emails found matching the specified criteria." },
        { name: "auth_error", description: "Authentication failed. Access token might be invalid/expired and refresh failed, or initial credentials missing/invalid. Re-authentication may be required." },
        { name: "api_error", description: "An error occurred while calling the Gmail API (e.g., rate limits, server errors, invalid query)." },
        { name: "config_error", description: "Configuration error, e.g., account details or required credentials (client_id, client_secret, refresh_token) not found in state." }
    ],
    implementation: async function(params) {
        const nodeStateKeyPrefix = `${this.self.id}.${params.accountStatePath || 'default'}`;
        // console.log(`[${this.self.id}] Starting execution for flow ${this.flowInstanceId}.`);

        let currentAccessToken;
        let accountDetails;

        try {
            const accountStatePath = params.accountStatePath;
            if (!accountStatePath) {
                const errorDetails = "Parameter 'accountStatePath' is required to fetch Gmail account details from state.";
                this.state.set(`${nodeStateKeyPrefix}.lastError`, { timestamp: Date.now(), error: errorDetails, params });
                return { config_error: () => ({ error: "Configuration Error", details: errorDetails }) };
            }

            accountDetails = this.state.get(accountStatePath);
            if (!accountDetails || typeof accountDetails !== 'object') {
                const errorDetails = `Account details not found or invalid at state path: '${accountStatePath}'. Ensure a 'Gmail Connect' node has run successfully and stored all required tokens (accessToken, refreshToken, clientId, clientSecret).`;
                this.state.set(`${nodeStateKeyPrefix}.lastError`, { timestamp: Date.now(), error: errorDetails, params });
                return { config_error: () => ({ error: "Configuration Error", details: errorDetails }) };
            }

            currentAccessToken = accountDetails.accessToken;
            const tokenExpiryTime = accountDetails.tokenExpiryTime;

            // Check if token is missing or likely expired (give 5 min buffer)
            if (!currentAccessToken || (tokenExpiryTime && tokenExpiryTime <= Date.now() + (5 * 60 * 1000))) {
                // console.log(`[${this.self.id}] Access token missing or expired for ${accountStatePath}. Attempting refresh.`);
                const refreshResult = await refreshAccessToken(accountDetails, this.state, accountStatePath);
                if (refreshResult.success) {
                    currentAccessToken = refreshResult.newAccessToken;
                    accountDetails.accessToken = currentAccessToken; // update local copy
                    accountDetails.tokenExpiryTime = refreshResult.newExpiryTime;
                } else {
                    this.state.set(`${nodeStateKeyPrefix}.lastError`, { timestamp: Date.now(), error: `Token refresh failed: ${refreshResult.error}`, details: refreshResult.details, params });
                    this.state.set(`${accountStatePath}.auth_status`, 'refresh_failed');
                    return { auth_error: () => ({ error: "Authentication Error", details: `Failed to refresh access token: ${refreshResult.error}`, diagnostic: refreshResult.details }) };
                }
            }

            if (!currentAccessToken) { // Should not happen if refresh logic is correct, but as a safeguard
                const errorDetails = `Access token not available for '${accountStatePath}' even after attempting refresh.`;
                this.state.set(`${nodeStateKeyPrefix}.lastError`, { timestamp: Date.now(), error: errorDetails, params });
                return { auth_error: () => ({ error: "Authentication Error", details: errorDetails }) };
            }

            const oauth2Client = new google.auth.OAuth2(accountDetails.clientId, accountDetails.clientSecret);
            oauth2Client.setCredentials({ access_token: currentAccessToken, refresh_token: accountDetails.refreshToken }); // Set refresh token too, as googleapis might use it implicitly in some cases or for future operations by the client

            const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

            const requestParams = {
                userId: params.userId || accountDetails.userId || "me",
                q: params.query,
                labelIds: params.labelIds,
                maxResults: params.maxResults || 100,
                pageToken: params.pageToken,
                includeSpamTrash: params.includeSpamTrash || false,
            };
            // Remove undefined params to avoid API errors for optional fields
            Object.keys(requestParams).forEach(key => requestParams[key] === undefined && delete requestParams[key]);

            this.state.set(`${nodeStateKeyPrefix}.lastRunParams`, { timestamp: Date.now(), params: requestParams });

            let response;
            try {
                response = await gmail.users.messages.list(requestParams);
            } catch (apiError) {
                 // console.error(`[${this.self.id}] Gmail API call failed for ${accountStatePath}:`, apiError.message, apiError.response?.data);
                if (apiError.code === 401 || (apiError.response?.status === 401)) { // Token likely expired or revoked mid-flight
                   // console.log(`[${this.self.id}] Received 401 from Gmail API for ${accountStatePath}. Attempting refresh again.`);
                    this.state.set(`${accountStatePath}.auth_status`, 'token_expired_on_api_call');
                    const refreshResult = await refreshAccessToken(accountDetails, this.state, accountStatePath);
                    if (refreshResult.success) {
                        oauth2Client.setCredentials({ access_token: refreshResult.newAccessToken, refresh_token: accountDetails.refreshToken });
                        accountDetails.accessToken = refreshResult.newAccessToken; // update local copy
                        accountDetails.tokenExpiryTime = refreshResult.newExpiryTime;

                       // console.log(`[${this.self.id}] Retrying Gmail API call after successful refresh for ${accountStatePath}.`);
                        response = await gmail.users.messages.list(requestParams); // Retry the request
                    } else {
                        this.state.set(`${nodeStateKeyPrefix}.lastError`, { timestamp: Date.now(), error: `Token refresh failed after API 401: ${refreshResult.error}`, details: refreshResult.details, params });
                         this.state.set(`${accountStatePath}.auth_status`, 'refresh_failed_after_401');
                        return { auth_error: () => ({ error: "Authentication Error", details: `Failed to refresh access token after API 401: ${refreshResult.error}`, diagnostic: refreshResult.details }) };
                    }
                } else {
                    // Other API errors (e.g., 400 for bad query, 403 for permissions, 5xx for server issues)
                    const errorDetails = `Gmail API error (${apiError.code || apiError.response?.status}): ${apiError.message}`;
                    this.state.set(`${nodeStateKeyPrefix}.lastError`, { timestamp: Date.now(), error: errorDetails, apiResponse: apiError.response?.data, params });
                    return { api_error: () => ({ error: "Gmail API Error", details: apiError.message, code: apiError.code || apiError.response?.status, response: apiError.response?.data }) };
                }
            }

            const emails = response.data.messages || [];
            const nextPageToken = response.data.nextPageToken || null;
            const resultSizeEstimate = response.data.resultSizeEstimate || 0;

            const resultPayload = {
                emails,
                nextPageToken,
                resultSizeEstimate
            };
            this.state.set(`${nodeStateKeyPrefix}.lastResults`, { timestamp: Date.now(), results: resultPayload, params });
            this.state.set(`${accountStatePath}.auth_status`, 'success');

            if (emails.length === 0 && !nextPageToken) { // Check nextPageToken too, as an empty page can exist
                // console.log(`[${this.self.id}] No emails found for the given criteria for ${accountStatePath}.`);
                return { no_results: () => resultPayload };
            }

           // console.log(`[${this.self.id}] Successfully listed ${emails.length} emails for ${accountStatePath}. Next page: ${!!nextPageToken}. Estimated total: ${resultSizeEstimate}`);
            return { success: () => resultPayload };

        } catch (error) {
            // Catchall for unexpected errors within the node logic itself
           // console.error(`[${this.self.id}] Unexpected error during execution in flow ${this.flowInstanceId} for ${params.accountStatePath}:`, error);
            this.state.set(`${nodeStateKeyPrefix}.lastError`, { timestamp: Date.now(), error: error.message, stack: error.stack, params });
            return { api_error: () => ({ error: "Unexpected Node Error", details: error.message, stack: error.stack }) }; // Or a more generic 'runtime_error'
        }
    },
    aiPromptHints: {
        toolName: "google_gmail_list_emails_auto_refresh",
        summary: "Searches and lists emails from a connected Gmail account. It automatically handles access token expiry by using a refresh token stored in the application's state. Requires prior authentication (e.g., via a 'Gmail Connect' node) that stores `accessToken`, `refreshToken`, `clientId`, and `clientSecret` in state.",
        useCase: "Use this for automated workflows that need to regularly access Gmail, such as daily email summaries, processing new emails based on rules, or finding specific information. Ensures continued operation even if access tokens expire between runs.",
        expectedInputFormat: "Requires `accountStatePath` (string) pointing to Gmail auth details in state (must include `accessToken`, `refreshToken`, `clientId`, `clientSecret`). Optional: `query` (string), `labelIds` (array), `maxResults` (number), `pageToken` (string), `includeSpamTrash` (boolean), `userId` (string, defaults to 'me').",
        outputDescription: "On 'success', returns an object with `emails` (array of message resources), `nextPageToken` (string or null), `resultSizeEstimate` (number). Other edges: 'no_results', 'auth_error' (if token refresh fails or initial creds are bad), 'api_error' (for Gmail API issues), 'config_error' (for setup problems)."
    }
};