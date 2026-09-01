/**
 * Nutrition runs inside the Spotter suite, so it reuses the app's single
 * Firebase instance instead of initialising its own (one app per page).
 */
export { db, auth, functions, storage } from '../firebase';
