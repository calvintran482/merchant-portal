import { getSession } from './_lib/session.js';
import { validate } from './_lib/codes.js';

export default async function handler(req, res) {
  // Only allow POST method
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }

  try {
    // Check authentication
    const session = getSession(req);
    if (!session || !session.cashierId) {
      res.status(401).json({ ok: false, error: 'Unauthorized' });
      return;
    }

    // Parse request body
    const body = req.body;
    const { code } = typeof body === 'string' ? JSON.parse(body) : body;

    // Validate input
    if (!code) {
      res.status(400).json({ ok: false, valid: false, reason: 'No code provided' });
      return;
    }

    // Stateless validation
    const result = validate(code);

    if (!result.exists) {
      res.json({ ok: true, valid: false, reason: 'Invalid code' });
      return;
    }

    if (result.redeemed) {
      res.json({
        ok: true,
        valid: false,
        status: 'redeemed',
        reason: 'Code already redeemed'
      });
      return;
    }

    // Valid and not redeemed
    res.json({ ok: true, valid: true, status: 'active' });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ ok: false, error: 'Internal Server Error' });
  }
}
