const MAX_RETRIES = 2;
const REQUEST_TIMEOUT_MS = 20_000;
const RETRY_DELAY_MS = 2_000;

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const fetchWithRetry = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(input, { ...init, signal: controller.signal });
      clearTimeout(timeout);
      if (response.status < 500 || response.status > 599 || attempt >= MAX_RETRIES) return response;
    } catch (error) {
      clearTimeout(timeout);
      if ((!timedOut && !(error instanceof TypeError)) || attempt >= MAX_RETRIES) throw error;
    }

    await delay(RETRY_DELAY_MS);
  }
};