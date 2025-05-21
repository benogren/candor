// ./src/lib/fetchWithRetry.ts
export async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add a short delay before retries
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        console.log(`Retry attempt ${attempt + 1} for ${url}`);
      }
      
      const response = await fetch(url, options);
      
      // If we get auth errors, wait and retry
      if (response.status === 401 || response.status === 403) {
        console.log('Authentication issue detected, retrying...');
        continue;
      }
      
      // For any successful response, return it immediately
      if (response.ok) {
        return response;
      }
      
      // For timeout errors (504), wait longer and retry
      if (response.status === 504) {
        console.log('Gateway timeout, retrying...');
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        continue;
      }
      
      // For other errors, throw to be caught by the retry loop
      throw new Error(`Request failed with status ${response.status}`);
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError || new Error('Failed after maximum retries');
}