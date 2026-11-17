/**
 * Auth API used by the app: the backend's /auth routes (./auth.http). Tests swap this module for a fake
 * (src/test/setup.ts); the app itself always talks to the server.
 */
export { fetchMe, login, logout, signup } from './auth.http'
