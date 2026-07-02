/**
 * Shared TanStack Query configurations for the Omni-Calendar application.
 * Ensures consistent retry logic and error handling across the application.
 */

export const defaultQueryConfig = {
  retry: (failureCount: number, error: any) => {
    // Don't retry on 401 (auth errors), 403 (permission), 404 (not found), 429 (throttled)
    // as these are client-side errors that retrying won't fix.
    if (error?.response?.status === 401 || 
        error?.response?.status === 403 || 
        error?.response?.status === 404 ||
        error?.response?.status === 429) {
      return false;
    }
    // Retry up to 3 times for other errors (e.g. 500, network issues)
    return failureCount < 3;
  },
  // Exponential backoff for retries: 1s, 2s, 4s, capped at 30s
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
};

/**
 * Configuration for critical data that the application cannot function without.
 * Retries more aggressively than the default config.
 */
export const criticalQueryConfig = {
  ...defaultQueryConfig,
  retry: (failureCount: number, error: any) => {
    // Still don't retry 404 or 429 for critical data
    if (error?.response?.status === 404 || error?.response?.status === 429) return false;
    // But allow more attempts (5) for other transient errors
    return failureCount < 5;
  },
};
