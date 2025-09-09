const express = require('express');
const { asyncHandler } = require('../middleware/errorHandler');
const { getOAuthClient, getMe, getAuthUrl, handleOAuthCallback } = require('../services/google-api');

const router = express.Router();

router.get('/me', asyncHandler(async (req, res) => {
  const me = await getMe();
  if (!me) return res.json({ ok: false });
  res.json({ ok: true, emailAddress: me.emailAddress });
}));

router.get('/oauth/url', asyncHandler(async (_req, res) => {
  const url = await getAuthUrl();
  res.json({ ok: true, url });
}));

router.get('/oauth/callback', asyncHandler(async (req, res) => {
  await handleOAuthCallback(req);
  res.send('<script>window.close && window.close();</script> התחברות הושלמה, אפשר לסגור חלון זה.');
}));

module.exports = router;
