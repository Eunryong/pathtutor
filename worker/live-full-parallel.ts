// Local-only live test entrypoint. Never deploy this file.
import worker from './src/index';

export default {
  async fetch(request: Request, env: Parameters<typeof worker.fetch>[1]) {
    const pathname = new URL(request.url).pathname;
    if (request.method === 'GET' && pathname === '/test-config') {
      return Response.json({
        model: 'gemini-3.8-flash',
        mode: 'parallel',
        maxRetries: 1,
      });
    }
    return worker.fetch(request, {
      ...env,
      GEMINI_MODEL: 'gemini-3.8-flash',
      GEMINI_ANALYSIS_MODE: 'parallel',
      GEMINI_MAX_RETRIES: '1',
      GEMINI_INPUT_USD_PER_MILLION_TOKENS: '0.75',
      GEMINI_OUTPUT_USD_PER_MILLION_TOKENS: '3.75',
    });
  },
};
