// Main Background Entry Point for Firefox MV3
// Ensures deterministic loading order via importScripts

try {
  importScripts(
    '../integrations/notebooklm/rpc.js',
    '../integrations/notebooklm/tokens.js',
    '../integrations/notebooklm/parse.js',
    '../integrations/notebooklm/client.js',
    '../ingestion/pipeline.js',
    './router.js'
  );
  console.log('ConduitLM Background Initialized (Deterministic)');
} catch (e) {
  console.error('Failed to load background scripts:', e);
}
