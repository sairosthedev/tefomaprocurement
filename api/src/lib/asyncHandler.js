'use strict';

/**
 * Wraps an async route/middleware so any rejected promise is forwarded
 * to Express's error pipeline. Removes the need for `try/catch` in every
 * controller and guarantees errors hit the central handler.
 *
 * @example
 *   router.get('/things', asyncHandler(async (req, res) => {
 *     const things = await Thing.find();
 *     res.json({ success: true, data: things });
 *   }));
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
