// Netlify Functions equivalent of api/yahoo/callback.js (Vercel).
// See that file for the full explanation of what this does.
exports.handler = async (event) => {
  const { code, error } = event.queryStringParameters || {};
  const payload = JSON.stringify({ source: 'yahoo-oauth', code: code || null, error: error || null });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html' },
    body: `<!doctype html>
<html><body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<p>${error ? 'Authorization failed — you can close this window.' : 'Connected! Closing…'}</p>
<script>
  if (window.opener) {
    window.opener.postMessage(${payload}, window.location.origin);
  }
  window.close();
</script>
</body></html>`,
  };
};
