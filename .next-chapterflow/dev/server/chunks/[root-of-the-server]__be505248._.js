module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/app/app/api/_lib/server-env.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getServerEnv",
    ()=>getServerEnv,
    "mustServerEnv",
    ()=>mustServerEnv
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
;
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const SSM_PREFIX = (process.env.SSM_PARAMETER_PREFIX || "").trim();
let ssmClientPromise = null;
const resolvedValueCache = new Map();
const missingCache = new Set();
async function getSsmClient() {
    if (ssmClientPromise) return ssmClientPromise;
    ssmClientPromise = (async ()=>{
        const mod = await __turbopack_context__.A("[project]/node_modules/aws-sdk/lib/aws.js [app-route] (ecmascript, async loader)");
        return new mod.default.SSM({
            region: REGION
        });
    })();
    return ssmClientPromise;
}
function isMissingParameterError(error) {
    if (typeof error !== "object" || error === null) return false;
    const maybe = error;
    const name = typeof maybe.name === "string" ? maybe.name : "";
    const code = typeof maybe.Code === "string" ? maybe.Code : "";
    const type = typeof maybe.__type === "string" ? maybe.__type : "";
    return name.includes("ParameterNotFound") || code.includes("ParameterNotFound") || type.includes("ParameterNotFound");
}
function uniqueNames(names) {
    const out = [];
    const seen = new Set();
    for (const n of names){
        const value = n.trim();
        if (!value || seen.has(value)) continue;
        seen.add(value);
        out.push(value);
    }
    return out;
}
function candidateParameterNames(key) {
    const lower = key.toLowerCase();
    const explicit = process.env[`SSM_PARAM_${key}`] || process.env[`${key}_SSM_PARAM`] || process.env[`${key}_SSM_PARAMETER`];
    const names = [
        explicit || ""
    ];
    if (SSM_PREFIX) {
        const prefix = SSM_PREFIX.endsWith("/") ? SSM_PREFIX.slice(0, -1) : SSM_PREFIX;
        // Prefer environment-scoped parameters when a prefix is configured.
        names.push(`${prefix}/${key}`);
        names.push(`${prefix}/${lower}`);
    }
    names.push(key);
    names.push(lower);
    names.push(`/${key}`);
    names.push(`/${lower}`);
    return uniqueNames(names);
}
async function loadFromSsm(key) {
    const candidates = candidateParameterNames(key);
    if (candidates.length === 0) return undefined;
    const ssm = await getSsmClient();
    let lastError;
    for (const paramName of candidates){
        try {
            const res = await ssm.getParameter({
                Name: paramName,
                WithDecryption: true
            }).promise();
            const value = res.Parameter?.Value;
            if (value != null && value !== "") {
                return value;
            }
        } catch (error) {
            if (isMissingParameterError(error)) continue;
            lastError = error;
        }
    }
    if (lastError) {
        throw lastError;
    }
    return undefined;
}
async function getServerEnv(name) {
    const fromProcess = process.env[name];
    if (fromProcess) {
        resolvedValueCache.set(name, fromProcess);
        return fromProcess;
    }
    if (resolvedValueCache.has(name)) return resolvedValueCache.get(name);
    if (missingCache.has(name)) return undefined;
    const fromSsm = await loadFromSsm(name);
    if (!fromSsm) {
        missingCache.add(name);
        return undefined;
    }
    process.env[name] = fromSsm;
    resolvedValueCache.set(name, fromSsm);
    return fromSsm;
}
async function mustServerEnv(name) {
    const v = await getServerEnv(name);
    if (!v) throw new Error(`Missing env var: ${name}`);
    return v;
}
}),
"[project]/app/app/_lib/dev-auth-bypass.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEV_BYPASS_USER",
    ()=>DEV_BYPASS_USER,
    "isDevAuthBypassEnabled",
    ()=>isDevAuthBypassEnabled
]);
function isDevAuthBypassEnabled() {
    return ("TURBOPACK compile-time value", "development") !== "production" && process.env.DEV_AUTH_BYPASS === "1";
}
const DEV_BYPASS_USER = {
    sub: "dev-local-user",
    email: "dev@localhost"
};
}),
"[project]/app/app/api/_lib/auth.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthError",
    ()=>AuthError,
    "requireUser",
    ()=>requireUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwt/verify.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwks$2f$remote$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwks/remote.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/_lib/server-env.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/_lib/dev-auth-bypass.ts [app-route] (ecmascript)");
;
;
;
;
;
class AuthError extends Error {
    constructor(message){
        super(message);
        this.name = "AuthError";
    }
}
const COOKIE_NAME = "id_token";
let cachedAuthConfigPromise = null;
async function getAuthConfig() {
    if (cachedAuthConfigPromise) return cachedAuthConfigPromise;
    cachedAuthConfigPromise = (async ()=>{
        const region = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])("COGNITO_REGION");
        const userPoolId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])("COGNITO_USER_POOL_ID");
        const clientId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])("COGNITO_CLIENT_ID");
        const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
        const jwks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwks$2f$remote$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["createRemoteJWKSet"])(new URL(`${issuer}/.well-known/jwks.json`));
        return {
            issuer,
            jwks,
            clientId
        };
    })();
    return cachedAuthConfigPromise;
}
async function requireUser() {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isDevAuthBypassEnabled"])()) {
        return {
            sub: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEV_BYPASS_USER"].sub,
            email: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DEV_BYPASS_USER"].email
        };
    }
    const token = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["cookies"])()).get(COOKIE_NAME)?.value;
    if (!token) throw new AuthError("UNAUTHENTICATED");
    const { issuer, jwks, clientId } = await getAuthConfig();
    let payload;
    try {
        ({ payload } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["jwtVerify"])(token, jwks, {
            issuer,
            audience: clientId
        }));
    } catch  {
        throw new AuthError("INVALID_TOKEN");
    }
    const p = payload;
    const sub = p.sub;
    if (!sub || typeof sub !== "string") throw new AuthError("INVALID_TOKEN");
    const email = typeof p.email === "string" ? p.email : undefined;
    const rawGroups = p["cognito:groups"];
    const groups = Array.isArray(rawGroups) ? rawGroups.filter((v)=>typeof v === "string") : typeof rawGroups === "string" ? [
        rawGroups
    ] : undefined;
    return {
        sub,
        email,
        groups
    };
}
}),
"[project]/app/app/api/book/_lib/errors.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BookApiError",
    ()=>BookApiError,
    "isBookApiError",
    ()=>isBookApiError
]);
class BookApiError extends Error {
    status;
    code;
    details;
    constructor(status, code, message, details){
        super(message);
        this.name = "BookApiError";
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
function isBookApiError(value) {
    return value instanceof BookApiError;
}
}),
"[project]/app/app/api/book/_lib/http.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "bookErr",
    ()=>bookErr,
    "bookOk",
    ()=>bookOk,
    "requireBodyObject",
    ()=>requireBodyObject,
    "requireInteger",
    ()=>requireInteger,
    "requireString",
    ()=>requireString,
    "withBookApiErrors",
    ()=>withBookApiErrors
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/_lib/auth.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/book/_lib/errors.ts [app-route] (ecmascript)");
;
;
;
function requestIdFromHeaders(req) {
    return req.headers.get("x-amzn-trace-id") || crypto.randomUUID();
}
function bookOk(data, init) {
    const resInit = typeof init === "number" ? {
        status: init
    } : init;
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(data, resInit);
}
function bookErr(req, status, code, message, details) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
        error: {
            code,
            message,
            requestId: requestIdFromHeaders(req),
            details
        }
    }, {
        status
    });
}
async function withBookApiErrors(req, fn) {
    try {
        return await fn();
    } catch (error) {
        if (error instanceof __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["AuthError"]) {
            return bookErr(req, 401, "unauthenticated", "Authentication is required.");
        }
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isBookApiError"])(error)) {
            return bookErr(req, error.status, error.code, error.message, error.details);
        }
        console.error("book_api_unhandled_error", {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
        });
        return bookErr(req, 500, "server_error", "An unexpected server error occurred.");
    }
}
function requireBodyObject(reqBody) {
    if (!reqBody || typeof reqBody !== "object" || Array.isArray(reqBody)) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BookApiError"](400, "invalid_json", "Request body must be a JSON object.");
    }
    return reqBody;
}
function requireString(value, field, opts) {
    if (typeof value !== "string") {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BookApiError"](400, "invalid_input", `${field} must be a string.`);
    }
    const trimmed = value.trim();
    const minLength = opts?.minLength ?? 1;
    const maxLength = opts?.maxLength ?? 5000;
    if (trimmed.length < minLength) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BookApiError"](400, "invalid_input", `${field} is required.`);
    }
    if (trimmed.length > maxLength) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BookApiError"](400, "invalid_input", `${field} is too long.`);
    }
    return trimmed;
}
function requireInteger(value, field, opts) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BookApiError"](400, "invalid_input", `${field} must be a number.`);
    }
    const intVal = Math.floor(value);
    if (value !== intVal) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BookApiError"](400, "invalid_input", `${field} must be an integer.`);
    }
    const min = opts?.min ?? Number.MIN_SAFE_INTEGER;
    const max = opts?.max ?? Number.MAX_SAFE_INTEGER;
    if (intVal < min || intVal > max) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BookApiError"](400, "invalid_input", `${field} must be between ${min} and ${max}.`);
    }
    return intVal;
}
}),
"[project]/app/app/api/book/_lib/env.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAppBaseUrl",
    ()=>getAppBaseUrl,
    "getBookAdminGroupName",
    ()=>getBookAdminGroupName,
    "getBookContentBucket",
    ()=>getBookContentBucket,
    "getBookFreeSlotsDefault",
    ()=>getBookFreeSlotsDefault,
    "getBookIngestBucket",
    ()=>getBookIngestBucket,
    "getBookPaywallPriceDisplay",
    ()=>getBookPaywallPriceDisplay,
    "getBookStripePriceId",
    ()=>getBookStripePriceId,
    "getBookStripeSecretKey",
    ()=>getBookStripeSecretKey,
    "getBookStripeWebhookSecret",
    ()=>getBookStripeWebhookSecret,
    "getBookTableName",
    ()=>getBookTableName
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/_lib/server-env.ts [app-route] (ecmascript)");
;
const DEFAULT_ADMIN_GROUP = "admin";
async function getBookTableName() {
    const explicit = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("BOOK_TABLE_NAME");
    if (explicit) return explicit;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])("SECURE_DOC_TABLE");
}
async function getBookIngestBucket() {
    const explicit = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("BOOK_INGEST_BUCKET");
    if (explicit) return explicit;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])("RAW_BUCKET");
}
async function getBookContentBucket() {
    const explicit = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("BOOK_CONTENT_BUCKET");
    if (explicit) return explicit;
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])("OUTPUT_BUCKET");
}
async function getBookAdminGroupName() {
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("BOOK_ADMIN_GROUP") || DEFAULT_ADMIN_GROUP;
}
async function getBookFreeSlotsDefault() {
    const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("BOOK_FREE_SLOTS_DEFAULT");
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed < 0) return 2;
    return Math.floor(parsed);
}
async function getBookStripePriceId() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("BOOK_STRIPE_PRICE_ID");
}
async function getBookStripeSecretKey() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("BOOK_STRIPE_SECRET_KEY");
}
async function getBookStripeWebhookSecret() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("BOOK_STRIPE_WEBHOOK_SECRET");
}
async function getBookPaywallPriceDisplay() {
    return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("BOOK_PAYWALL_PRICE") || "$7.99/month";
}
async function getAppBaseUrl(reqUrl) {
    const url = new URL(reqUrl);
    const chapterFlowExplicit = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("CHAPTERFLOW_APP_BASE_URL") || await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("NEXT_PUBLIC_CHAPTERFLOW_APP_URL");
    if (chapterFlowExplicit) return chapterFlowExplicit.replace(/\/+$/, "");
    return `${url.protocol}//${url.host}`;
}
}),
"[externals]/path [external] (path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("path", () => require("path"));

module.exports = mod;
}),
"[externals]/os [external] (os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("os", () => require("os"));

module.exports = mod;
}),
"[externals]/node:fs/promises [external] (node:fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs/promises", () => require("node:fs/promises"));

module.exports = mod;
}),
"[externals]/crypto [external] (crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("crypto", () => require("crypto"));

module.exports = mod;
}),
"[externals]/stream [external] (stream, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("stream", () => require("stream"));

module.exports = mod;
}),
"[externals]/buffer [external] (buffer, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("buffer", () => require("buffer"));

module.exports = mod;
}),
"[externals]/node:os [external] (node:os, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:os", () => require("node:os"));

module.exports = mod;
}),
"[externals]/node:process [external] (node:process, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:process", () => require("node:process"));

module.exports = mod;
}),
"[externals]/node:path [external] (node:path, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:path", () => require("node:path"));

module.exports = mod;
}),
"[externals]/http [external] (http, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("http", () => require("http"));

module.exports = mod;
}),
"[externals]/https [external] (https, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("https", () => require("https"));

module.exports = mod;
}),
"[externals]/node:fs [external] (node:fs, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:fs", () => require("node:fs"));

module.exports = mod;
}),
"[project]/app/app/api/_lib/aws.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "REGION",
    ()=>REGION,
    "ddbDoc",
    ()=>ddbDoc,
    "getTableName",
    ()=>getTableName,
    "mustEnv",
    ()=>mustEnv,
    "s3",
    ()=>s3,
    "sfn",
    ()=>sfn
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$dynamodb$2f$dist$2d$es$2f$DynamoDBClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/client-dynamodb/dist-es/DynamoDBClient.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/lib-dynamodb/dist-es/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$DynamoDBDocumentClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/lib-dynamodb/dist-es/DynamoDBDocumentClient.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f40$aws$2d$sdk$2f$client$2d$s3__$5b$external$5d$__$2840$aws$2d$sdk$2f$client$2d$s3$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$s3$29$__ = __turbopack_context__.i("[externals]/@aws-sdk/client-s3 [external] (@aws-sdk/client-s3, cjs, [project]/node_modules/@aws-sdk/client-s3)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sfn$2f$dist$2d$es$2f$SFNClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/client-sfn/dist-es/SFNClient.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/_lib/server-env.ts [app-route] (ecmascript)");
;
;
;
;
;
;
async function mustEnv(name) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])(name);
}
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const ddb = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$dynamodb$2f$dist$2d$es$2f$DynamoDBClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["DynamoDBClient"]({
    region: REGION
});
const ddbDoc = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$DynamoDBDocumentClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DynamoDBDocumentClient"].from(ddb, {
    marshallOptions: {
        removeUndefinedValues: true
    }
});
async function getTableName() {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])("SECURE_DOC_TABLE");
}
const s3 = new __TURBOPACK__imported__module__$5b$externals$5d2f40$aws$2d$sdk$2f$client$2d$s3__$5b$external$5d$__$2840$aws$2d$sdk$2f$client$2d$s3$2c$__cjs$2c$__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$s3$29$__["S3Client"]({
    region: REGION
});
const sfn = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$client$2d$sfn$2f$dist$2d$es$2f$SFNClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["SFNClient"]({
    region: REGION
});
}),
"[project]/app/app/api/book/_lib/keys.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "badgeAwardSk",
    ()=>badgeAwardSk,
    "bookMetaSk",
    ()=>bookMetaSk,
    "bookPk",
    ()=>bookPk,
    "bookStateSk",
    ()=>bookStateSk,
    "bookUserPk",
    ()=>bookUserPk,
    "bookVersionSk",
    ()=>bookVersionSk,
    "buildBookJsonKey",
    ()=>buildBookJsonKey,
    "buildChapterKey",
    ()=>buildChapterKey,
    "buildContentPrefix",
    ()=>buildContentPrefix,
    "buildManifestKey",
    ()=>buildManifestKey,
    "buildQuizKey",
    ()=>buildQuizKey,
    "catalogPk",
    ()=>catalogPk,
    "catalogSk",
    ()=>catalogSk,
    "chapterStateSk",
    ()=>chapterStateSk,
    "entitlementSk",
    ()=>entitlementSk,
    "ingestJobPk",
    ()=>ingestJobPk,
    "ingestJobSk",
    ()=>ingestJobSk,
    "nowIso",
    ()=>nowIso,
    "padChapterNumber",
    ()=>padChapterNumber,
    "padVersion",
    ()=>padVersion,
    "profileSk",
    ()=>profileSk,
    "progressSk",
    ()=>progressSk,
    "quizAttemptPk",
    ()=>quizAttemptPk,
    "quizAttemptSk",
    ()=>quizAttemptSk,
    "readingDaySk",
    ()=>readingDaySk,
    "savedBookSk",
    ()=>savedBookSk,
    "settingsSk",
    ()=>settingsSk,
    "stripeCustomerPk",
    ()=>stripeCustomerPk,
    "stripeCustomerSk",
    ()=>stripeCustomerSk,
    "webhookPk",
    ()=>webhookPk,
    "webhookSk",
    ()=>webhookSk
]);
function nowIso() {
    return new Date().toISOString();
}
function padVersion(version) {
    return String(Math.max(1, Math.floor(version))).padStart(6, "0");
}
function padChapterNumber(chapterNumber) {
    return String(Math.max(0, Math.floor(chapterNumber))).padStart(4, "0");
}
function catalogPk() {
    return "BOOKCATALOG";
}
function catalogSk(bookId) {
    return `BOOK#${bookId}`;
}
function bookPk(bookId) {
    return `BOOK#${bookId}`;
}
function bookMetaSk() {
    return "META";
}
function bookVersionSk(version) {
    return `VERSION#${padVersion(version)}`;
}
function ingestJobPk(jobId) {
    return `BOOKINGEST#${jobId}`;
}
function ingestJobSk() {
    return "JOB";
}
function bookUserPk(userId) {
    return `BOOKUSER#${userId}`;
}
function entitlementSk() {
    return "ENTITLEMENT";
}
function progressSk(bookId) {
    return `PROGRESS#${bookId}`;
}
function profileSk() {
    return "PROFILE";
}
function settingsSk() {
    return "SETTINGS";
}
function savedBookSk(bookId) {
    return `SAVED#${bookId}`;
}
function bookStateSk(bookId) {
    return `BOOKSTATE#${bookId}`;
}
function chapterStateSk(bookId, chapterNumber) {
    return `CHAPTERSTATE#${bookId}#${padChapterNumber(chapterNumber)}`;
}
function readingDaySk(dayKey) {
    return `READINGDAY#${dayKey}`;
}
function badgeAwardSk(badgeId) {
    return `BADGE#${badgeId}`;
}
function quizAttemptPk(userId, bookId, chapterNumber) {
    return `QUIZATTEMPT#${userId}#${bookId}#${padChapterNumber(chapterNumber)}`;
}
function quizAttemptSk(timestampIso) {
    return timestampIso;
}
function webhookPk() {
    return "BOOKBILLING#WEBHOOK";
}
function webhookSk(eventId) {
    return `EVENT#${eventId}`;
}
function stripeCustomerPk(customerId) {
    return `BOOKBILLING#CUSTOMER#${customerId}`;
}
function stripeCustomerSk() {
    return "USER";
}
function buildContentPrefix(bookId, version) {
    return `book-content/books/${bookId}/v${padVersion(version)}`;
}
function buildManifestKey(prefix) {
    return `${prefix}/manifest.json`;
}
function buildBookJsonKey(prefix) {
    return `${prefix}/book.json`;
}
function buildChapterKey(prefix, chapterNumber) {
    return `${prefix}/chapters/${padChapterNumber(chapterNumber)}.json`;
}
function buildQuizKey(prefix, chapterNumber) {
    return `${prefix}/quizzes/${padChapterNumber(chapterNumber)}.json`;
}
}),
"[project]/app/app/api/book/_lib/repo.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "addReadingDayActivity",
    ()=>addReadingDayActivity,
    "adminUpdateUserEntitlement",
    ()=>adminUpdateUserEntitlement,
    "attachStripeCustomerToEntitlement",
    ()=>attachStripeCustomerToEntitlement,
    "countRecentQuizAttempts",
    ()=>countRecentQuizAttempts,
    "createBookVersionDraft",
    ()=>createBookVersionDraft,
    "createOrUpdateIngestionJob",
    ()=>createOrUpdateIngestionJob,
    "createProgressIfMissing",
    ()=>createProgressIfMissing,
    "deleteBookVersion",
    ()=>deleteBookVersion,
    "deleteSavedBook",
    ()=>deleteSavedBook,
    "getBookMeta",
    ()=>getBookMeta,
    "getBookVersion",
    ()=>getBookVersion,
    "getCatalogBook",
    ()=>getCatalogBook,
    "getIngestionJob",
    ()=>getIngestionJob,
    "getManifestFromVersion",
    ()=>getManifestFromVersion,
    "getNextVersionNumber",
    ()=>getNextVersionNumber,
    "getUserBookState",
    ()=>getUserBookState,
    "getUserChapterState",
    ()=>getUserChapterState,
    "getUserEntitlement",
    ()=>getUserEntitlement,
    "getUserIdByStripeCustomer",
    ()=>getUserIdByStripeCustomer,
    "getUserProfileItem",
    ()=>getUserProfileItem,
    "getUserProgress",
    ()=>getUserProgress,
    "getUserSettingsItem",
    ()=>getUserSettingsItem,
    "listAllUserBookStates",
    ()=>listAllUserBookStates,
    "listAllUserProgress",
    ()=>listAllUserProgress,
    "listBadgeAwards",
    ()=>listBadgeAwards,
    "listBookVersions",
    ()=>listBookVersions,
    "listPublishedCatalogItems",
    ()=>listPublishedCatalogItems,
    "listReadingDays",
    ()=>listReadingDays,
    "listSavedBooks",
    ()=>listSavedBooks,
    "listUserChapterStates",
    ()=>listUserChapterStates,
    "mapStripeCustomerToUser",
    ()=>mapStripeCustomerToUser,
    "publishBookVersion",
    ()=>publishBookVersion,
    "putBadgeAward",
    ()=>putBadgeAward,
    "putBookManifest",
    ()=>putBookManifest,
    "putSavedBook",
    ()=>putSavedBook,
    "putUserBookState",
    ()=>putUserBookState,
    "putUserChapterState",
    ()=>putUserChapterState,
    "putUserProfileItem",
    ()=>putUserProfileItem,
    "putUserSettingsItem",
    ()=>putUserSettingsItem,
    "readManifest",
    ()=>readManifest,
    "recordStripeWebhookEvent",
    ()=>recordStripeWebhookEvent,
    "reserveBookEntitlement",
    ()=>reserveBookEntitlement,
    "summarizeProgress",
    ()=>summarizeProgress,
    "updateIngestionJob",
    ()=>updateIngestionJob,
    "updateProgressAfterQuizPass",
    ()=>updateProgressAfterQuizPass,
    "updateUserEntitlementFromStripe",
    ()=>updateUserEntitlementFromStripe,
    "upsertBookMetaAndCatalog",
    ()=>upsertBookMetaAndCatalog,
    "upsertUserProgress",
    ()=>upsertUserProgress,
    "writeQuizAttempt",
    ()=>writeQuizAttempt
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/lib-dynamodb/dist-es/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/lib-dynamodb/dist-es/commands/GetCommand.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/lib-dynamodb/dist-es/commands/PutCommand.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/lib-dynamodb/dist-es/commands/QueryCommand.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$UpdateCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/lib-dynamodb/dist-es/commands/UpdateCommand.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$DeleteCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/lib-dynamodb/dist-es/commands/DeleteCommand.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/_lib/aws.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/book/_lib/errors.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/book/_lib/keys.ts [app-route] (ecmascript)");
;
;
;
;
function readNum(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}
function readStr(value) {
    return typeof value === "string" ? value : undefined;
}
function parseStringArray(value) {
    if (Array.isArray(value)) {
        return value.filter((v)=>typeof v === "string");
    }
    if (value instanceof Set) {
        return Array.from(value).filter((v)=>typeof v === "string");
    }
    return [];
}
function parseNumberArray(value) {
    if (Array.isArray(value)) {
        return value.filter((v)=>typeof v === "number" && Number.isFinite(v));
    }
    if (value instanceof Set) {
        return Array.from(value).filter((v)=>typeof v === "number" && Number.isFinite(v));
    }
    return [];
}
function parseRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value;
}
function parseStringRecord(value) {
    return Object.fromEntries(Object.entries(parseRecord(value)).filter(([key, entryValue])=>typeof key === "string" && typeof entryValue === "string"));
}
function parseNumberRecord(value) {
    return Object.fromEntries(Object.entries(parseRecord(value)).filter(([key, entryValue])=>typeof key === "string" && typeof entryValue === "number" && Number.isFinite(entryValue)));
}
function isConditionalCheckFailed(error) {
    if (!error || typeof error !== "object") return false;
    const rec = error;
    return rec.name === "ConditionalCheckFailedException" || rec.__type === "ConditionalCheckFailedException";
}
async function listPublishedCatalogItems(tableName) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["QueryCommand"]({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
            ":pk": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["catalogPk"])(),
            ":prefix": "BOOK#"
        },
        ScanIndexForward: true
    }));
    const out = [];
    for (const item of res.Items ?? []){
        const bookId = readStr(item.bookId);
        const title = readStr(item.title);
        const author = readStr(item.author);
        const latestVersion = readNum(item.latestVersion);
        const status = readStr(item.status);
        if (!bookId || !title || !author || !latestVersion || !status) continue;
        out.push({
            bookId,
            title,
            author,
            categories: parseStringArray(item.categories),
            tags: parseStringArray(item.tags),
            cover: typeof item.cover === "object" && item.cover !== null ? {
                emoji: readStr(item.cover.emoji),
                color: readStr(item.cover.color)
            } : undefined,
            variantFamily: item.variantFamily === "PBC" ? "PBC" : "EMH",
            status: status === "ARCHIVED" ? "ARCHIVED" : status === "DRAFT" ? "DRAFT" : "PUBLISHED",
            latestVersion,
            currentPublishedVersion: readNum(item.currentPublishedVersion),
            updatedAt: readStr(item.updatedAt) || ""
        });
    }
    return out;
}
async function getCatalogBook(tableName, bookId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["catalogPk"])(),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["catalogSk"])(bookId)
        }
    }));
    const item = res.Item;
    if (!item) return null;
    const latestVersion = readNum(item.latestVersion);
    if (!latestVersion) return null;
    return {
        bookId: readStr(item.bookId) || bookId,
        title: readStr(item.title) || "",
        author: readStr(item.author) || "",
        categories: parseStringArray(item.categories),
        tags: parseStringArray(item.tags),
        cover: typeof item.cover === "object" && item.cover !== null ? {
            emoji: readStr(item.cover.emoji),
            color: readStr(item.cover.color)
        } : undefined,
        variantFamily: item.variantFamily === "PBC" ? "PBC" : "EMH",
        status: item.status === "ARCHIVED" ? "ARCHIVED" : item.status === "DRAFT" ? "DRAFT" : "PUBLISHED",
        latestVersion,
        currentPublishedVersion: readNum(item.currentPublishedVersion),
        updatedAt: readStr(item.updatedAt) || ""
    };
}
async function getBookVersion(tableName, bookId, version) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookPk"])(bookId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookVersionSk"])(version)
        }
    }));
    const item = res.Item;
    if (!item) return null;
    const parsedVersion = readNum(item.version);
    if (!parsedVersion) return null;
    return {
        bookId,
        version: parsedVersion,
        packageId: readStr(item.packageId) || "",
        schemaVersion: readStr(item.schemaVersion) || "",
        state: item.state === "PUBLISHED" ? "PUBLISHED" : item.state === "ARCHIVED" ? "ARCHIVED" : "DRAFT",
        contentPrefix: readStr(item.contentPrefix) || "",
        manifestKey: readStr(item.manifestKey) || "",
        createdAt: readStr(item.createdAt) || "",
        createdBy: readStr(item.createdBy) || "",
        publishedAt: readStr(item.publishedAt),
        publishedBy: readStr(item.publishedBy)
    };
}
async function listBookVersions(tableName, bookId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["QueryCommand"]({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
            ":pk": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookPk"])(bookId),
            ":prefix": "VERSION#"
        },
        ScanIndexForward: false
    }));
    const out = [];
    for (const item of res.Items ?? []){
        const version = readNum(item.version);
        if (!version) continue;
        out.push({
            bookId,
            version,
            packageId: readStr(item.packageId) || "",
            schemaVersion: readStr(item.schemaVersion) || "",
            state: item.state === "PUBLISHED" ? "PUBLISHED" : item.state === "ARCHIVED" ? "ARCHIVED" : "DRAFT",
            contentPrefix: readStr(item.contentPrefix) || "",
            manifestKey: readStr(item.manifestKey) || "",
            createdAt: readStr(item.createdAt) || "",
            createdBy: readStr(item.createdBy) || "",
            publishedAt: readStr(item.publishedAt),
            publishedBy: readStr(item.publishedBy)
        });
    }
    return out;
}
async function getNextVersionNumber(tableName, bookId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["QueryCommand"]({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
            ":pk": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookPk"])(bookId),
            ":prefix": "VERSION#"
        },
        ScanIndexForward: false,
        Limit: 1
    }));
    const latest = res.Items?.[0];
    const latestVersion = latest ? readNum(latest.version) : undefined;
    return latestVersion ? latestVersion + 1 : 1;
}
async function createBookVersionDraft(tableName, params) {
    const createdAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
            TableName: tableName,
            Item: {
                PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookPk"])(params.bookId),
                SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookVersionSk"])(params.version),
                entity: "BOOK_VERSION",
                bookId: params.bookId,
                version: params.version,
                packageId: params.packageId,
                schemaVersion: params.schemaVersion,
                state: "DRAFT",
                contentPrefix: params.contentPrefix,
                manifestKey: params.manifestKey,
                createdAt,
                createdBy: params.createdBy,
                updatedAt: createdAt
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        }));
    } catch (error) {
        if (isConditionalCheckFailed(error)) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BookApiError"](409, "version_conflict", "Version already exists. Retry ingestion.");
        }
        throw error;
    }
}
async function upsertBookMetaAndCatalog(tableName, params) {
    const updatedAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookPk"])(params.bookId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookMetaSk"])(),
            entity: "BOOK_META",
            bookId: params.bookId,
            title: params.title,
            author: params.author,
            categories: params.categories,
            tags: params.tags,
            cover: params.cover,
            variantFamily: params.variantFamily,
            latestVersion: params.latestVersion,
            currentPublishedVersion: params.currentPublishedVersion,
            status: params.status,
            updatedAt
        }
    }));
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["catalogPk"])(),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["catalogSk"])(params.bookId),
            entity: "BOOK_CATALOG",
            bookId: params.bookId,
            title: params.title,
            author: params.author,
            categories: params.categories,
            tags: params.tags,
            cover: params.cover,
            variantFamily: params.variantFamily,
            latestVersion: params.latestVersion,
            currentPublishedVersion: params.currentPublishedVersion,
            status: params.status,
            updatedAt
        }
    }));
}
async function publishBookVersion(tableName, bookId, version, publishedBy) {
    const ts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$UpdateCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["UpdateCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookPk"])(bookId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookVersionSk"])(version)
        },
        UpdateExpression: "SET #state = :published, publishedAt = :ts, publishedBy = :by, updatedAt = :ts",
        ExpressionAttributeNames: {
            "#state": "state"
        },
        ExpressionAttributeValues: {
            ":published": "PUBLISHED",
            ":ts": ts,
            ":by": publishedBy
        },
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)"
    }));
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$UpdateCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["UpdateCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookPk"])(bookId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookMetaSk"])()
        },
        UpdateExpression: "SET currentPublishedVersion = :version, latestVersion = if_not_exists(latestVersion, :version), #status = :published, updatedAt = :ts",
        ExpressionAttributeNames: {
            "#status": "status"
        },
        ExpressionAttributeValues: {
            ":version": version,
            ":published": "PUBLISHED",
            ":ts": ts
        },
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)"
    }));
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$UpdateCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["UpdateCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["catalogPk"])(),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["catalogSk"])(bookId)
        },
        UpdateExpression: "SET currentPublishedVersion = :version, latestVersion = if_not_exists(latestVersion, :version), #status = :published, updatedAt = :ts",
        ExpressionAttributeNames: {
            "#status": "status"
        },
        ExpressionAttributeValues: {
            ":version": version,
            ":published": "PUBLISHED",
            ":ts": ts
        },
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)"
    }));
}
async function createOrUpdateIngestionJob(tableName, params) {
    const ts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ingestJobPk"])(params.jobId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ingestJobSk"])(),
            entity: "BOOK_INGEST_JOB",
            jobId: params.jobId,
            createdBy: params.createdBy,
            ingestBucket: params.ingestBucket,
            ingestKey: params.ingestKey,
            bookId: params.bookId,
            status: params.status,
            details: params.details,
            errorReportKey: params.errorReportKey,
            updatedAt: ts,
            createdAt: ts
        }
    }));
}
async function updateIngestionJob(tableName, jobId, params) {
    const ts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$UpdateCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["UpdateCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ingestJobPk"])(jobId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ingestJobSk"])()
        },
        UpdateExpression: "SET #status = :status, details = :details, errorReportKey = :errorReportKey, bookId = :bookId, updatedAt = :updatedAt",
        ExpressionAttributeNames: {
            "#status": "status"
        },
        ExpressionAttributeValues: {
            ":status": params.status,
            ":details": params.details ?? null,
            ":errorReportKey": params.errorReportKey ?? null,
            ":bookId": params.bookId ?? null,
            ":updatedAt": ts
        }
    }));
}
async function getIngestionJob(tableName, jobId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ingestJobPk"])(jobId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ingestJobSk"])()
        }
    }));
    return res.Item ?? null;
}
async function getUserEntitlement(tableName, userId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["entitlementSk"])()
        }
    }));
    const item = res.Item;
    if (!item) return null;
    return {
        userId,
        plan: item.plan === "PRO" ? "PRO" : "FREE",
        proStatus: item.proStatus === "active" || item.proStatus === "past_due" || item.proStatus === "canceled" || item.proStatus === "inactive" ? item.proStatus : undefined,
        freeBookSlots: readNum(item.freeBookSlots) ?? 2,
        unlockedBookIds: parseStringArray(item.unlockedBookIds),
        stripeCustomerId: readStr(item.stripeCustomerId),
        stripeSubscriptionId: readStr(item.stripeSubscriptionId),
        currentPeriodEnd: readStr(item.currentPeriodEnd),
        updatedAt: readStr(item.updatedAt) || ""
    };
}
async function reserveBookEntitlement(tableName, params) {
    const ts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    try {
        const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$UpdateCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["UpdateCommand"]({
            TableName: tableName,
            Key: {
                PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(params.userId),
                SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["entitlementSk"])()
            },
            UpdateExpression: "SET plan = if_not_exists(plan, :freePlan), freeBookSlots = if_not_exists(freeBookSlots, :freeSlots), updatedAt = :updatedAt ADD unlockedBookIds :bookSet",
            ConditionExpression: "plan = :proPlan OR contains(unlockedBookIds, :bookId) OR attribute_not_exists(unlockedBookIds) OR attribute_not_exists(freeBookSlots) OR size(unlockedBookIds) < freeBookSlots",
            ExpressionAttributeValues: {
                ":freePlan": "FREE",
                ":proPlan": "PRO",
                ":freeSlots": params.freeSlotsDefault,
                ":updatedAt": ts,
                ":bookId": params.bookId,
                ":bookSet": new Set([
                    params.bookId
                ])
            },
            ReturnValues: "ALL_NEW"
        }));
        const item = res.Attributes ?? {};
        return {
            userId: params.userId,
            plan: item.plan === "PRO" ? "PRO" : "FREE",
            proStatus: item.proStatus === "active" || item.proStatus === "past_due" || item.proStatus === "canceled" || item.proStatus === "inactive" ? item.proStatus : undefined,
            freeBookSlots: readNum(item.freeBookSlots) ?? params.freeSlotsDefault,
            unlockedBookIds: parseStringArray(item.unlockedBookIds),
            stripeCustomerId: readStr(item.stripeCustomerId),
            stripeSubscriptionId: readStr(item.stripeSubscriptionId),
            currentPeriodEnd: readStr(item.currentPeriodEnd),
            updatedAt: readStr(item.updatedAt) || ts
        };
    } catch (error) {
        if (isConditionalCheckFailed(error)) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BookApiError"](402, "book_limit_reached", "Book limit reached. Upgrade required.");
        }
        throw error;
    }
}
async function upsertUserProgress(tableName, progress) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(progress.userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["progressSk"])(progress.bookId),
            entity: "BOOK_PROGRESS",
            ...progress
        }
    }));
}
async function createProgressIfMissing(tableName, progress) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
            TableName: tableName,
            Item: {
                PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(progress.userId),
                SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["progressSk"])(progress.bookId),
                entity: "BOOK_PROGRESS",
                ...progress
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        }));
    } catch (error) {
        if (isConditionalCheckFailed(error)) return;
        throw error;
    }
}
async function getUserProgress(tableName, userId, bookId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["progressSk"])(bookId)
        }
    }));
    const item = res.Item;
    if (!item) return null;
    return {
        userId,
        bookId,
        pinnedBookVersion: readNum(item.pinnedBookVersion) ?? 1,
        contentPrefix: readStr(item.contentPrefix) || "",
        manifestKey: readStr(item.manifestKey) || "",
        currentChapterNumber: readNum(item.currentChapterNumber) ?? 1,
        unlockedThroughChapterNumber: readNum(item.unlockedThroughChapterNumber) ?? 1,
        completedChapters: parseNumberArray(item.completedChapters),
        bestScoreByChapter: typeof item.bestScoreByChapter === "object" && item.bestScoreByChapter !== null ? item.bestScoreByChapter : {},
        lastOpenedAt: readStr(item.lastOpenedAt),
        lastActiveAt: readStr(item.lastActiveAt),
        streakDays: readNum(item.streakDays),
        preferredVariant: readStr(item.preferredVariant),
        updatedAt: readStr(item.updatedAt) || "",
        createdAt: readStr(item.createdAt) || ""
    };
}
async function listAllUserProgress(tableName, userId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["QueryCommand"]({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
            ":pk": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            ":prefix": "PROGRESS#"
        },
        ScanIndexForward: false
    }));
    const out = [];
    for (const item of res.Items ?? []){
        const bookId = readStr(item.bookId);
        if (!bookId) continue;
        out.push({
            userId,
            bookId,
            pinnedBookVersion: readNum(item.pinnedBookVersion) ?? 1,
            contentPrefix: readStr(item.contentPrefix) || "",
            manifestKey: readStr(item.manifestKey) || "",
            currentChapterNumber: readNum(item.currentChapterNumber) ?? 1,
            unlockedThroughChapterNumber: readNum(item.unlockedThroughChapterNumber) ?? 1,
            completedChapters: parseNumberArray(item.completedChapters),
            bestScoreByChapter: typeof item.bestScoreByChapter === "object" && item.bestScoreByChapter !== null ? item.bestScoreByChapter : {},
            lastOpenedAt: readStr(item.lastOpenedAt),
            lastActiveAt: readStr(item.lastActiveAt),
            streakDays: readNum(item.streakDays),
            preferredVariant: readStr(item.preferredVariant),
            updatedAt: readStr(item.updatedAt) || "",
            createdAt: readStr(item.createdAt) || ""
        });
    }
    return out;
}
async function writeQuizAttempt(tableName, attempt) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["quizAttemptPk"])(attempt.userId, attempt.bookId, attempt.chapterNumber),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["quizAttemptSk"])(attempt.createdAt),
            entity: "BOOK_QUIZ_ATTEMPT",
            ...attempt
        }
    }));
}
async function countRecentQuizAttempts(tableName, userId, bookId, chapterNumber, sinceIso) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["QueryCommand"]({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND SK >= :since",
        ExpressionAttributeValues: {
            ":pk": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["quizAttemptPk"])(userId, bookId, chapterNumber),
            ":since": sinceIso
        },
        Select: "COUNT"
    }));
    return res.Count ?? 0;
}
async function getManifestFromVersion(tableName, bookId, version) {
    const versionItem = await getBookVersion(tableName, bookId, version);
    if (!versionItem) return null;
    return {
        manifestKey: versionItem.manifestKey,
        contentPrefix: versionItem.contentPrefix
    };
}
async function recordStripeWebhookEvent(tableName, eventId, eventType) {
    const ts = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
            TableName: tableName,
            Item: {
                PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["webhookPk"])(),
                SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["webhookSk"])(eventId),
                entity: "BOOK_STRIPE_WEBHOOK_EVENT",
                eventId,
                eventType,
                createdAt: ts
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        }));
        return true;
    } catch (error) {
        if (isConditionalCheckFailed(error)) return false;
        throw error;
    }
}
async function mapStripeCustomerToUser(tableName, customerId, userId) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["stripeCustomerPk"])(customerId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["stripeCustomerSk"])(),
            entity: "BOOK_STRIPE_CUSTOMER_MAP",
            customerId,
            userId,
            updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])()
        }
    }));
}
async function getUserIdByStripeCustomer(tableName, customerId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["stripeCustomerPk"])(customerId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["stripeCustomerSk"])()
        }
    }));
    const userId = readStr(res.Item?.userId);
    return userId || null;
}
async function updateUserEntitlementFromStripe(tableName, params) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$UpdateCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["UpdateCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(params.userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["entitlementSk"])()
        },
        UpdateExpression: "SET #plan = :plan, proStatus = :proStatus, stripeCustomerId = :stripeCustomerId, stripeSubscriptionId = :stripeSubscriptionId, currentPeriodEnd = :periodEnd, updatedAt = :updatedAt, freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots), unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)",
        ExpressionAttributeNames: {
            "#plan": "plan"
        },
        ExpressionAttributeValues: {
            ":plan": params.plan,
            ":proStatus": params.proStatus,
            ":stripeCustomerId": params.stripeCustomerId ?? null,
            ":stripeSubscriptionId": params.stripeSubscriptionId ?? null,
            ":periodEnd": params.currentPeriodEnd ?? null,
            ":updatedAt": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])(),
            ":defaultSlots": 2,
            ":emptySet": new Set()
        }
    }));
}
async function attachStripeCustomerToEntitlement(tableName, userId, customerId) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$UpdateCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["UpdateCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["entitlementSk"])()
        },
        UpdateExpression: "SET stripeCustomerId = :customerId, updatedAt = :updatedAt, #plan = if_not_exists(#plan, :freePlan), freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots), unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)",
        ExpressionAttributeNames: {
            "#plan": "plan"
        },
        ExpressionAttributeValues: {
            ":customerId": customerId,
            ":updatedAt": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])(),
            ":freePlan": "FREE",
            ":defaultSlots": 2,
            ":emptySet": new Set()
        }
    }));
}
async function adminUpdateUserEntitlement(tableName, params) {
    const updatedAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    const segments = [
        "updatedAt = :updatedAt"
    ];
    const values = {
        ":updatedAt": updatedAt,
        ":emptySet": new Set(),
        ":defaultSlots": 2,
        ":defaultPlan": "FREE"
    };
    if (typeof params.freeBookSlots === "number") {
        segments.push("freeBookSlots = :freeBookSlots");
        values[":freeBookSlots"] = Math.max(0, Math.floor(params.freeBookSlots));
    } else {
        segments.push("freeBookSlots = if_not_exists(freeBookSlots, :defaultSlots)");
    }
    if (params.plan) {
        segments.push("#plan = :plan");
        values[":plan"] = params.plan;
    } else {
        segments.push("#plan = if_not_exists(#plan, :defaultPlan)");
    }
    if (params.proStatus) {
        segments.push("proStatus = :proStatus");
        values[":proStatus"] = params.proStatus;
    }
    segments.push("unlockedBookIds = if_not_exists(unlockedBookIds, :emptySet)");
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$UpdateCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["UpdateCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(params.userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["entitlementSk"])()
        },
        UpdateExpression: `SET ${segments.join(", ")}`,
        ExpressionAttributeNames: {
            "#plan": "plan"
        },
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW"
    }));
    const item = res.Attributes ?? {};
    return {
        userId: params.userId,
        plan: item.plan === "PRO" ? "PRO" : "FREE",
        proStatus: item.proStatus === "active" || item.proStatus === "past_due" || item.proStatus === "canceled" || item.proStatus === "inactive" ? item.proStatus : undefined,
        freeBookSlots: readNum(item.freeBookSlots) ?? 2,
        unlockedBookIds: parseStringArray(item.unlockedBookIds),
        stripeCustomerId: readStr(item.stripeCustomerId),
        stripeSubscriptionId: readStr(item.stripeSubscriptionId),
        currentPeriodEnd: readStr(item.currentPeriodEnd),
        updatedAt: readStr(item.updatedAt) || updatedAt
    };
}
async function deleteBookVersion(tableName, bookId, version) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$DeleteCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DeleteCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookPk"])(bookId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookVersionSk"])(version)
        }
    }));
}
async function getBookMeta(tableName, bookId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookPk"])(bookId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookMetaSk"])()
        }
    }));
    return res.Item ?? null;
}
async function updateProgressAfterQuizPass(tableName, params) {
    const progress = await getUserProgress(tableName, params.userId, params.bookId);
    if (!progress) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$errors$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["BookApiError"](404, "progress_not_found", "Progress record not found.");
    }
    const completed = new Set(progress.completedChapters);
    completed.add(params.chapterNumber);
    const bestScoreByChapter = {
        ...progress.bestScoreByChapter,
        [String(params.chapterNumber)]: Math.max(params.scorePercent, progress.bestScoreByChapter[String(params.chapterNumber)] || 0)
    };
    const nextUnlocked = Math.max(progress.unlockedThroughChapterNumber, params.chapterNumber + 1);
    const updatedAt = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    await upsertUserProgress(tableName, {
        ...progress,
        currentChapterNumber: Math.max(progress.currentChapterNumber, params.chapterNumber + 1),
        unlockedThroughChapterNumber: nextUnlocked,
        completedChapters: Array.from(completed).sort((a, b)=>a - b),
        bestScoreByChapter,
        lastActiveAt: updatedAt,
        lastOpenedAt: updatedAt,
        updatedAt
    });
}
async function readManifest(tableName, bookId) {
    const catalog = await getCatalogBook(tableName, bookId);
    if (!catalog?.currentPublishedVersion) return null;
    const version = await getBookVersion(tableName, bookId, catalog.currentPublishedVersion);
    if (!version) return null;
    return {
        version: version.version,
        manifestKey: version.manifestKey,
        contentPrefix: version.contentPrefix
    };
}
function summarizeProgress(entries, ent) {
    const booksStarted = entries.length;
    let booksCompleted = 0;
    let chaptersCompleted = 0;
    const scores = [];
    for (const p of entries){
        chaptersCompleted += p.completedChapters.length;
        if (p.completedChapters.length > 0 && p.currentChapterNumber <= p.completedChapters.length) {
            booksCompleted += 1;
        }
        for (const value of Object.values(p.bestScoreByChapter)){
            if (typeof value === "number" && Number.isFinite(value)) scores.push(value);
        }
    }
    const averageBestScore = scores.length > 0 ? Math.round(scores.reduce((a, b)=>a + b, 0) / scores.length) : 0;
    return {
        booksStarted,
        booksCompleted,
        chaptersCompleted,
        averageBestScore,
        plan: ent?.plan ?? "FREE",
        freeBookSlots: ent?.freeBookSlots ?? 2,
        unlockedBooksCount: ent?.unlockedBookIds.length ?? 0
    };
}
async function getUserProfileItem(tableName, userId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["profileSk"])()
        }
    }));
    const item = res.Item;
    if (!item) return null;
    return {
        userId,
        profile: parseRecord(item.profile),
        createdAt: readStr(item.createdAt) || "",
        updatedAt: readStr(item.updatedAt) || ""
    };
}
async function putUserProfileItem(tableName, params) {
    const now = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    const createdAt = params.createdAt || now;
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(params.userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["profileSk"])(),
            entity: "BOOK_USER_PROFILE",
            userId: params.userId,
            profile: params.profile,
            createdAt,
            updatedAt: now
        }
    }));
    return {
        userId: params.userId,
        profile: params.profile,
        createdAt,
        updatedAt: now
    };
}
async function getUserSettingsItem(tableName, userId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["settingsSk"])()
        }
    }));
    const item = res.Item;
    if (!item) return null;
    return {
        userId,
        settings: parseRecord(item.settings),
        createdAt: readStr(item.createdAt) || "",
        updatedAt: readStr(item.updatedAt) || ""
    };
}
async function putUserSettingsItem(tableName, params) {
    const now = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    const createdAt = params.createdAt || now;
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(params.userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["settingsSk"])(),
            entity: "BOOK_USER_SETTINGS",
            userId: params.userId,
            settings: params.settings,
            createdAt,
            updatedAt: now
        }
    }));
    return {
        userId: params.userId,
        settings: params.settings,
        createdAt,
        updatedAt: now
    };
}
async function listSavedBooks(tableName, userId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["QueryCommand"]({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
            ":pk": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            ":prefix": "SAVED#"
        },
        ScanIndexForward: true
    }));
    const items = (res.Items ?? []).map((item)=>{
        const bookId = readStr(item.bookId);
        if (!bookId) return null;
        return {
            userId,
            bookId,
            savedAt: readStr(item.savedAt) || "",
            updatedAt: readStr(item.updatedAt) || "",
            source: readStr(item.source),
            priority: readNum(item.priority),
            pinned: item.pinned === true
        };
    });
    return items.filter((item)=>item !== null);
}
async function putSavedBook(tableName, params) {
    const existing = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(params.userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["savedBookSk"])(params.bookId)
        }
    }));
    const now = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    const savedAt = readStr(existing.Item?.savedAt) || now;
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(params.userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["savedBookSk"])(params.bookId),
            entity: "BOOK_SAVED_BOOK",
            userId: params.userId,
            bookId: params.bookId,
            savedAt,
            updatedAt: now,
            source: params.source,
            priority: params.priority,
            pinned: params.pinned === true
        }
    }));
    return {
        userId: params.userId,
        bookId: params.bookId,
        savedAt,
        updatedAt: now,
        source: params.source,
        priority: params.priority,
        pinned: params.pinned === true
    };
}
async function deleteSavedBook(tableName, userId, bookId) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$DeleteCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DeleteCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["savedBookSk"])(bookId)
        }
    }));
}
async function getUserBookState(tableName, userId, bookId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookStateSk"])(bookId)
        }
    }));
    const item = res.Item;
    if (!item) return null;
    return {
        userId,
        bookId,
        currentChapterId: readStr(item.currentChapterId) || "",
        completedChapterIds: parseStringArray(item.completedChapterIds),
        unlockedChapterIds: parseStringArray(item.unlockedChapterIds),
        chapterScores: parseNumberRecord(item.chapterScores),
        chapterCompletedAt: parseStringRecord(item.chapterCompletedAt),
        lastReadChapterId: readStr(item.lastReadChapterId) || "",
        lastOpenedAt: readStr(item.lastOpenedAt) || "",
        createdAt: readStr(item.createdAt) || "",
        updatedAt: readStr(item.updatedAt) || ""
    };
}
async function putUserBookState(tableName, state) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(state.userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookStateSk"])(state.bookId),
            entity: "BOOK_USER_BOOK_STATE",
            ...state
        }
    }));
}
async function listAllUserBookStates(tableName, userId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["QueryCommand"]({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
            ":pk": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            ":prefix": "BOOKSTATE#"
        },
        ScanIndexForward: true
    }));
    const items = (res.Items ?? []).map((item)=>{
        const bookId = readStr(item.bookId);
        if (!bookId) return null;
        return {
            userId,
            bookId,
            currentChapterId: readStr(item.currentChapterId) || "",
            completedChapterIds: parseStringArray(item.completedChapterIds),
            unlockedChapterIds: parseStringArray(item.unlockedChapterIds),
            chapterScores: parseNumberRecord(item.chapterScores),
            chapterCompletedAt: parseStringRecord(item.chapterCompletedAt),
            lastReadChapterId: readStr(item.lastReadChapterId) || "",
            lastOpenedAt: readStr(item.lastOpenedAt) || "",
            createdAt: readStr(item.createdAt) || "",
            updatedAt: readStr(item.updatedAt) || ""
        };
    });
    return items.filter((item)=>item !== null);
}
async function getUserChapterState(tableName, userId, bookId, chapterNumber) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$GetCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["GetCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["chapterStateSk"])(bookId, chapterNumber)
        }
    }));
    const item = res.Item;
    if (!item) return null;
    return {
        userId,
        bookId,
        chapterNumber,
        chapterId: readStr(item.chapterId),
        state: parseRecord(item.state),
        createdAt: readStr(item.createdAt) || "",
        updatedAt: readStr(item.updatedAt) || ""
    };
}
async function putUserChapterState(tableName, item) {
    await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
        TableName: tableName,
        Item: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(item.userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["chapterStateSk"])(item.bookId, item.chapterNumber),
            entity: "BOOK_USER_CHAPTER_STATE",
            ...item
        }
    }));
}
async function listUserChapterStates(tableName, userId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["QueryCommand"]({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
            ":pk": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            ":prefix": "CHAPTERSTATE#"
        },
        ScanIndexForward: true
    }));
    const items = (res.Items ?? []).map((item)=>{
        const bookId = readStr(item.bookId);
        const chapterNumber = readNum(item.chapterNumber);
        if (!bookId || !chapterNumber) return null;
        return {
            userId,
            bookId,
            chapterNumber,
            chapterId: readStr(item.chapterId),
            state: parseRecord(item.state),
            createdAt: readStr(item.createdAt) || "",
            updatedAt: readStr(item.updatedAt) || ""
        };
    });
    return items.filter((item)=>item !== null);
}
async function addReadingDayActivity(tableName, params) {
    const safeDelta = Math.max(0, Math.round(params.deltaMs));
    const now = params.occurredAt || (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])();
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$UpdateCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["UpdateCommand"]({
        TableName: tableName,
        Key: {
            PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(params.userId),
            SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readingDaySk"])(params.dayKey)
        },
        UpdateExpression: "SET entity = :entity, userId = :userId, dayKey = :dayKey, updatedAt = :updatedAt, lastActivityAt = :lastActivityAt ADD totalActiveMs :delta",
        ExpressionAttributeValues: {
            ":entity": "BOOK_USER_READING_DAY",
            ":userId": params.userId,
            ":dayKey": params.dayKey,
            ":updatedAt": now,
            ":lastActivityAt": now,
            ":delta": safeDelta
        },
        ReturnValues: "ALL_NEW"
    }));
    const item = res.Attributes ?? {};
    return {
        userId: params.userId,
        dayKey: params.dayKey,
        totalActiveMs: readNum(item.totalActiveMs) ?? safeDelta,
        updatedAt: readStr(item.updatedAt) || now,
        lastActivityAt: readStr(item.lastActivityAt) || now
    };
}
async function listReadingDays(tableName, userId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["QueryCommand"]({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
            ":pk": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            ":prefix": "READINGDAY#"
        },
        ScanIndexForward: true
    }));
    const items = (res.Items ?? []).map((item)=>{
        const dayKey = readStr(item.dayKey);
        if (!dayKey) return null;
        return {
            userId,
            dayKey,
            totalActiveMs: readNum(item.totalActiveMs) ?? 0,
            updatedAt: readStr(item.updatedAt) || "",
            lastActivityAt: readStr(item.lastActivityAt)
        };
    });
    return items.filter((item)=>item !== null);
}
async function listBadgeAwards(tableName, userId) {
    const res = await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$QueryCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["QueryCommand"]({
        TableName: tableName,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
            ":pk": (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(userId),
            ":prefix": "BADGE#"
        },
        ScanIndexForward: true
    }));
    const items = (res.Items ?? []).map((item)=>{
        const badgeId = readStr(item.badgeId);
        if (!badgeId) return null;
        return {
            userId,
            badgeId,
            earnedAt: readStr(item.earnedAt) || "",
            updatedAt: readStr(item.updatedAt) || "",
            tier: readStr(item.tier)
        };
    });
    return items.filter((item)=>item !== null);
}
async function putBadgeAward(tableName, params) {
    try {
        await __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$aws$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ddbDoc"].send(new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$lib$2d$dynamodb$2f$dist$2d$es$2f$commands$2f$PutCommand$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["PutCommand"]({
            TableName: tableName,
            Item: {
                PK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookUserPk"])(params.userId),
                SK: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["badgeAwardSk"])(params.badgeId),
                entity: "BOOK_USER_BADGE_AWARD",
                userId: params.userId,
                badgeId: params.badgeId,
                earnedAt: params.earnedAt,
                updatedAt: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$keys$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["nowIso"])(),
                tier: params.tier
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)"
        }));
    } catch (error) {
        if (isConditionalCheckFailed(error)) return;
        throw error;
    }
}
async function putBookManifest(tableName, params) {
    await createBookVersionDraft(tableName, {
        bookId: params.bookId,
        version: params.version,
        packageId: params.packageId,
        schemaVersion: params.schemaVersion,
        contentPrefix: params.contentPrefix,
        manifestKey: params.manifestKey,
        createdBy: params.createdBy
    });
    await upsertBookMetaAndCatalog(tableName, {
        bookId: params.bookId,
        title: params.manifest.title,
        author: params.manifest.author,
        categories: params.manifest.categories,
        tags: params.manifest.tags,
        variantFamily: params.manifest.variantFamily,
        latestVersion: params.version,
        currentPublishedVersion: params.publishNow ? params.version : undefined,
        status: params.publishNow ? "PUBLISHED" : "DRAFT"
    });
    if (params.publishNow) {
        await publishBookVersion(tableName, params.bookId, params.version, params.createdBy);
    }
}
}),
"[project]/app/app/api/book/me/dashboard/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET,
    "runtime",
    ()=>runtime
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/_lib/auth.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$http$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/book/_lib/http.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/book/_lib/env.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/book/_lib/repo.ts [app-route] (ecmascript)");
;
;
;
;
;
const runtime = "nodejs";
async function GET(req) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$http$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["withBookApiErrors"])(req, async ()=>{
        const user = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$auth$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["requireUser"])();
        const tableName = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getBookTableName"])();
        const [catalog, entitlement, profile, settings, progress, bookStates, chapterStates, saved, readingDays, badgeAwards] = await Promise.all([
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["listPublishedCatalogItems"])(tableName),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getUserEntitlement"])(tableName, user.sub),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getUserProfileItem"])(tableName, user.sub),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getUserSettingsItem"])(tableName, user.sub),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["listAllUserProgress"])(tableName, user.sub),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["listAllUserBookStates"])(tableName, user.sub),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["listUserChapterStates"])(tableName, user.sub),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["listSavedBooks"])(tableName, user.sub),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["listReadingDays"])(tableName, user.sub),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$repo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["listBadgeAwards"])(tableName, user.sub)
        ]);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$book$2f$_lib$2f$http$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["bookOk"])({
            catalog: catalog.filter((item)=>item.status === "PUBLISHED" && !!item.currentPublishedVersion),
            entitlement,
            profile: profile?.profile ?? null,
            settings: settings?.settings ?? null,
            progress,
            bookStates,
            chapterStates,
            saved,
            readingDays,
            badgeAwards
        });
    });
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__be505248._.js.map