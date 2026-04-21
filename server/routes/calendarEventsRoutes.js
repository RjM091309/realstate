import { Router } from 'express';
import { requireAuth } from '../middlewares/authMiddleware.js';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from '../controllers/calendarEventsController.js';

const router = Router();
router.use(requireAuth);

router.get('/', listCalendarEvents);
router.post('/', createCalendarEvent);
router.patch('/:id', updateCalendarEvent);
router.delete('/:id', deleteCalendarEvent);

export { router as calendarEventsRouter };

