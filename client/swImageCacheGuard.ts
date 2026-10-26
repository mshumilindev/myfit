/**
 * Workbox plugin for the service worker's picture cache (SPO-358). Firebase Hosting rewrites a missing file to
 * index.html with status 200, so without this the HTML would be saved under the picture's URL and every card using
 * it stayed an empty box until the cache was cleared. Only a real `image/*` answer may be stored.
 * Workbox inlines this function into sw.js: keep it self-contained (no imports, no outer variables).
 */
export const imageCacheGuard = {
  cacheWillUpdate: async ({ response }: { response: Response }): Promise<Response | null> =>
    response && /^image\//i.test(response.headers.get('content-type') || '') ? response : null,
};
