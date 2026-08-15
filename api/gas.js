module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed.' });
  }

  const gasUrl = process.env.GAS_WEB_APP_URL;
  if (!gasUrl) {
    return res.status(500).json({ ok: false, error: 'Missing GAS_WEB_APP_URL environment variable.' });
  }

  try {
    const upstream = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(req.body || {})
    });

    const text = await upstream.text();
    const data = JSON.parse(text);
    return res.status(upstream.ok ? 200 : upstream.status).json(data);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: error.message || 'Apps Script backend request failed.'
    });
  }
};
