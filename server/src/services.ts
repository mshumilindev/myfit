import type { Router } from 'express';
import { workoutsRouter } from './workouts.js';
import { gymsRouter } from './gyms.js';

/**
 * Реєстр сервісів платформи. Новий продукт = новий запис тут:
 * його роутери монтуються під /api/<id>/...
 */
export interface ServiceModule {
  id: string;
  title: string;
  routers: Router[];
}

export const services: ServiceModule[] = [
  {
    id: 'tracker',
    title: 'Тренування',
    routers: [workoutsRouter, gymsRouter],
  },
  // { id: 'nutrition', title: 'Харчування', routers: [nutritionRouter] },
  // { id: 'body', title: 'AI-оцінка тіла', routers: [bodyRouter] },
];
