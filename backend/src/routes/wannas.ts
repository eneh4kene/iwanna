import { Router } from 'express';
import { wannaController } from '../controllers/wannaController';
import { authenticateToken } from '../middleware/authenticate';

const router = Router();

/**
 * Wanna routes (all require authentication)
 */

// Get autocomplete suggestions
router.get('/suggestions', authenticateToken, wannaController.getSuggestions.bind(wannaController));

// Get user's active wannas
router.get('/active', authenticateToken, wannaController.getActive.bind(wannaController));

// Create new wanna
router.post('/', authenticateToken, wannaController.create.bind(wannaController));

// Cancel wanna
router.delete('/:id', authenticateToken, wannaController.cancel.bind(wannaController));

export default router;
