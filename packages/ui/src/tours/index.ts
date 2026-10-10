// The tour texts (`tours.ts`) are not exported here: they load when the Tutorials page or a tour
// opens, through `loadTours`.
export {
  tours,
  TourState,
  TOURS_KEY,
  type TourRun,
  type TourSnapshot,
  type TourStorage,
} from './tour-state';
export { placePopup, GAP, type Box, type Placed, type Size } from './placement';
export {
  tourBlocker,
  tourLength,
  type TourBlocker,
  type TourGoTo,
  type TourWhere,
} from './start';
export type { Placement, Step, Tour, TourPage } from './tours';

/** The tour texts, fetched on first use. */
export const loadTours = () => import('./tours');
