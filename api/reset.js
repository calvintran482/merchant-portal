import { getSession, setSession } from './_lib/session.js';
import { resetStats } from './_lib/stats.js';
import { resetRedemptions } from './_lib/codes.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    const session = getSession(req);
    if (!session || !session.cashierId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    const ok1 = resetStats();
    const ok2 = resetRedemptions();

    // Clear session count too
    setSession(res, { ...session, processedCount: 0 });

    res.json({ ok: ok1 && ok2 });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
}
