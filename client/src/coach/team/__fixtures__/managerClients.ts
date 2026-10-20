import type { ManagerClientRow } from '../managerClients';

const OLENA = { trainerId: 'trainer-olena', trainerName: 'Olena Kovalenko' };
const ANDRIY = { trainerId: 'trainer-andriy', trainerName: 'Andriy Petrenko' };

/** The team of boards D29 / P15: 14 clients of two trainers, three whose app has not delegated the keys yet. Ids match the schedule fixtures (c1..c14). */
export const MANAGER_CLIENTS: readonly ManagerClientRow[] = [
  { clientId: 'c1', name: 'Oleh Bondar', ready: true, ...OLENA },
  { clientId: 'c2', name: 'Andriy Lysenko', ready: false, ...ANDRIY },
  { clientId: 'c3', name: 'Bohdan Palamar', ready: true, ...OLENA },
  { clientId: 'c4', name: 'Sofiia Hnatiuk', ready: true, ...ANDRIY },
  { clientId: 'c5', name: 'Taras Rudenko', ready: false, ...OLENA },
  { clientId: 'c6', name: 'Denys Koval', ready: true, ...ANDRIY },
  { clientId: 'c7', name: 'Maria Tkach', ready: false, ...OLENA },
  { clientId: 'c8', name: 'Viktoriia Danylchuk', ready: true, ...ANDRIY },
  { clientId: 'c9', name: 'Kateryna Lishchyna', ready: true, ...OLENA },
  { clientId: 'c10', name: 'Ivan Shevchuk', ready: true, ...ANDRIY },
  { clientId: 'c11', name: 'Nadiia Moroz', ready: true, ...OLENA },
  { clientId: 'c12', name: 'Pavlo Kravets', ready: true, ...OLENA },
  { clientId: 'c13', name: 'Yulia Bondarenko', ready: true, ...OLENA },
  { clientId: 'c14', name: 'Roman Hrytsenko', ready: true, ...ANDRIY },
];
