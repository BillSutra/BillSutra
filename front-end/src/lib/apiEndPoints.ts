import Env from "./env";

const BASE_URL = Env.BACKEND_URL.replace(/\/$/, "");

export { BASE_URL };
export const API_URL = `${BASE_URL}/api`;
export const LOGIN_URL = API_URL + "/auth/login";

export const BASE_URL1 = API_URL;
export const REGISTER_URL = `${BASE_URL1}/auth/register`;
export const check_credential = `${BASE_URL1}/auth/logincheck`;
export const WORKER_LOGIN_URL = `${BASE_URL1}/auth/worker/login`;
export const forgetPassword = `${BASE_URL1}/auth/forgot-password`;
export const resetPassword = `${BASE_URL1}/auth/reset-password`;
export const createClash = `${BASE_URL1}/clash`;
export const clashItems = `${BASE_URL1}/clash/items`;
