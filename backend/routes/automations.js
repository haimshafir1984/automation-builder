const express = require('express');
const { body } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validation');
const { executeSteps } = require('../services/executors');

const router = express.Router();

// Execute a one-off automation (from last plan + filled fields)
router.post('/execute',
  validate([
    body('text').optional().isString(),
    body('steps').isArray({ min: 1 })
  ]),
  asyncHandler(async (req, res) => {
    const { steps } = req.body;
    const out = await executeSteps(steps);
    if (!out.ok) return res.status(400).json(out);
    res.json(out);
  })
);

module.exports = router;
