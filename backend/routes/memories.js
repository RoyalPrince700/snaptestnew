const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  listMemories,
  createMemory,
  updateMemory,
  deleteMemory,
  getMemoryStats
} = require('../controllers/memoryController');

// All memory routes require authentication
router.use(protect);

router.get('/', listMemories);
router.post('/', createMemory);
router.put('/:id', updateMemory);
router.delete('/:id', deleteMemory);
router.get('/stats', getMemoryStats);

module.exports = router;


