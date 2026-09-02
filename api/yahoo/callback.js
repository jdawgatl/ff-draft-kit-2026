// Vercel/Netlify serverless function: OAuth2 redirect landing page for the
// standalone web app's Yahoo login popup. Yahoo redirects here with
// ?code=..., and this page immediately postMessages the code back to the
// window that opened it, then closes itself.
//
// Deploy target: /api/yahoo/callback (Vercel) — see netlify.toml for the
// equivalent Netlify Functions redirect if you deploy there instead.
export default function handler(req, res) {
  const { code, error } = req.query;
  const payload = JSON.stringify({ source: 'yahoo-oauth', code: code || null, error: error || null });

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`<!doctype html>
<html><body style="font-family:system-ui;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
<p>${error ? 'Authorization failed — you can close this window.' : 'Connected! Closing…'}</p>
<script>
  if (window.opener) {
    window.opener.postMessage(${payload}, window.location.origin);
  }
  window.close();
</script>
</body></html>`);
}
