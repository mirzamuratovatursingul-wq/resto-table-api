const router = require('express').Router();
const auth = require('../controllers/auth.controller');
const authLimiter = require('../middlewares/rateLimit');

// Ochiq endpointlar: POST /api/auth/register | login | refresh | logout
// login va register tezlik chegarasi bilan (production da)
router.post('/register', authLimiter, auth.signUp);
router.post('/login', authLimiter, auth.login);
router.post('/refresh', auth.refresh);
router.post('/logout', auth.logout);

module.exports = router;
