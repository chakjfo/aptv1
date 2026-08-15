module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const gasUrl = process.env.GAS_WEB_APP_URL;
  if (!gasUrl) {
    return res.status(500).json({ ok: false, error: 'Missing GAS_WEB_APP_URL environment variable.' });
  }
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(gasUrl)) {
    return res.status(500).json({
      ok: false,
      error: 'GAS_WEB_APP_URL must be the Google Apps Script Web App /exec URL.'
    });
  }

  try {
    const upstream = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req.body || {})
    });

    const text = await upstream.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (_) {
      const preview = text.replace(/\s+/g, ' ').slice(0, 120);
      return res.status(502).json({
        ok: false,
        error: `Apps Script returned HTML instead of JSON. Check that GAS_WEB_APP_URL is the deployed Web App /exec URL and access is set to Anyone. Response started with: ${preview}`
      });
    }

    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error.message || 'Apps Script backend request failed.'
    });
  }
};
