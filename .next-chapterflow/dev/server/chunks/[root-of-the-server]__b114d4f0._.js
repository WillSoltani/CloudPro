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
"[project]/app/_lib/chapterflow-brand.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CHAPTERFLOW_NAME",
    ()=>CHAPTERFLOW_NAME,
    "CHAPTERFLOW_TAGLINE",
    ()=>CHAPTERFLOW_TAGLINE,
    "buildChapterFlowAppHref",
    ()=>buildChapterFlowAppHref,
    "buildChapterFlowAuthHref",
    ()=>buildChapterFlowAuthHref,
    "buildChapterFlowSiteHref",
    ()=>buildChapterFlowSiteHref,
    "getChapterFlowAppUrl",
    ()=>getChapterFlowAppUrl,
    "getChapterFlowAuthUrl",
    ()=>getChapterFlowAuthUrl,
    "getChapterFlowSiteUrl",
    ()=>getChapterFlowSiteUrl,
    "isChapterFlowAppHost",
    ()=>isChapterFlowAppHost,
    "isChapterFlowAuthHost",
    ()=>isChapterFlowAuthHost,
    "isChapterFlowSiteHost",
    ()=>isChapterFlowSiteHost,
    "isLocalHost",
    ()=>isLocalHost
]);
const DEFAULT_CHAPTERFLOW_SITE_URL = "https://siliconx.ca";
const DEFAULT_CHAPTERFLOW_APP_URL = "https://chapterflow.siliconx.ca";
const DEFAULT_CHAPTERFLOW_AUTH_URL = "https://auth.siliconx.ca";
const DEFAULT_CHAPTERFLOW_DEV_URL = "http://localhost:3001";
const LOCAL_CHAPTERFLOW_HOSTS = new Set([
    "localhost:3001",
    "127.0.0.1:3001",
    "[::1]:3001",
    "::1:3001"
]);
const CHAPTERFLOW_NAME = "ChapterFlow";
const CHAPTERFLOW_TAGLINE = "Guided reading for people who want depth, momentum, and real retention.";
function normalizeUrl(value) {
    return value.trim().replace(/\/+$/, "");
}
function safeUrl(value) {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
        return normalizeUrl(trimmed);
    } catch  {
        return null;
    }
}
function getChapterFlowAppUrl() {
    const configured = safeUrl(("TURBOPACK compile-time value", "http://localhost:3001"));
    if (configured) return configured;
    return ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : DEFAULT_CHAPTERFLOW_DEV_URL;
}
function getChapterFlowSiteUrl() {
    const configured = safeUrl(("TURBOPACK compile-time value", "http://localhost:3001") || process.env.CHAPTERFLOW_SITE_BASE_URL);
    if (configured) return configured;
    return ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : DEFAULT_CHAPTERFLOW_DEV_URL;
}
function getChapterFlowAuthUrl() {
    const configured = safeUrl(("TURBOPACK compile-time value", "http://localhost:3001"));
    if (configured) return configured;
    return ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : DEFAULT_CHAPTERFLOW_DEV_URL;
}
function hostFromUrl(value) {
    return new URL(value).host.toLowerCase();
}
function normalizeHost(value) {
    return String(value ?? "").trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}
function isLocalHost(host) {
    const normalized = normalizeHost(host);
    return normalized.startsWith("localhost") || normalized.startsWith("127.0.0.1") || normalized.startsWith("[::1]") || normalized.startsWith("::1");
}
function isChapterFlowAppHost(host) {
    const normalized = normalizeHost(host);
    if (!normalized) return false;
    if (LOCAL_CHAPTERFLOW_HOSTS.has(normalized)) return true;
    return normalized === hostFromUrl(getChapterFlowAppUrl());
}
function isChapterFlowSiteHost(host) {
    const normalized = normalizeHost(host);
    if (!normalized) return false;
    if (LOCAL_CHAPTERFLOW_HOSTS.has(normalized)) return true;
    return normalized === hostFromUrl(getChapterFlowSiteUrl());
}
function isChapterFlowAuthHost(host) {
    const normalized = normalizeHost(host);
    if (!normalized) return false;
    if (LOCAL_CHAPTERFLOW_HOSTS.has(normalized)) return false;
    return normalized === hostFromUrl(getChapterFlowAuthUrl());
}
function buildChapterFlowSiteHref(path = "/") {
    return `${getChapterFlowSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
function buildChapterFlowAppHref(path = "/") {
    return `${getChapterFlowAppUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
function buildChapterFlowAuthHref(path = "/") {
    return `${getChapterFlowAuthUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
}),
"[project]/app/auth/_lib/cognito-domain.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "resolveCognitoDomain",
    ()=>resolveCognitoDomain
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/_lib/server-env.ts [app-route] (ecmascript)");
;
function ensureHttpsUrl(input) {
    const trimmed = input.trim();
    if (!trimmed) throw new Error("Missing env var: COGNITO_DOMAIN");
    const withScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    return parsed.toString().replace(/\/+$/, "");
}
async function resolveCognitoDomain() {
    const customDomain = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getServerEnv"])("COGNITO_CUSTOM_DOMAIN");
    if (customDomain) return ensureHttpsUrl(customDomain);
    const domain = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])("COGNITO_DOMAIN");
    return ensureHttpsUrl(domain);
}
}),
"[project]/app/auth/_lib/auth-cookie.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAuthCookieBase",
    ()=>getAuthCookieBase,
    "getAuthCookieDomain",
    ()=>getAuthCookieDomain
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
;
function normalizeCookieDomain(value) {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return undefined;
    return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}
function getAuthCookieDomain() {
    return normalizeCookieDomain(process.env.AUTH_COOKIE_DOMAIN || process.env.CHAPTERFLOW_COOKIE_DOMAIN);
}
function getAuthCookieBase() {
    const secure = ("TURBOPACK compile-time value", "development") === "production";
    const domain = ("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : undefined;
    return {
        httpOnly: true,
        sameSite: "lax",
        secure,
        path: "/",
        ...("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : {}
    };
}
}),
"[project]/app/auth/_lib/return-to.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "sanitizeReturnTo",
    ()=>sanitizeReturnTo
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/_lib/chapterflow-brand.ts [app-route] (ecmascript)");
;
;
function normalizeUrl(value) {
    return value.trim().replace(/\/+$/, "");
}
function normalizeOrigin(value) {
    return new URL(value).origin;
}
function allowedOrigins() {
    const origins = new Set();
    const configured = [
        process.env.APP_BASE_URL,
        ("TURBOPACK compile-time value", "http://localhost:3001"),
        ("TURBOPACK compile-time value", "http://localhost:3001"),
        process.env.CHAPTERFLOW_APP_BASE_URL,
        ("TURBOPACK compile-time value", "http://localhost:3001"),
        process.env.CHAPTERFLOW_AUTH_BASE_URL
    ];
    for (const value of configured){
        if (!value) continue;
        try {
            origins.add(normalizeOrigin(value));
        } catch  {
            continue;
        }
    }
    origins.add(normalizeOrigin((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getChapterFlowAppUrl"])()));
    origins.add(normalizeOrigin((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getChapterFlowAuthUrl"])()));
    return origins;
}
function sanitizeReturnTo(value, fallback) {
    const raw = String(value ?? "").trim();
    if (!raw) return fallback;
    if (raw.startsWith("/")) {
        return raw;
    }
    try {
        const target = new URL(raw);
        if (!allowedOrigins().has(target.origin)) {
            return fallback;
        }
        return normalizeUrl(target.toString());
    } catch  {
        return fallback;
    }
}
}),
"[project]/app/auth/login/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GET",
    ()=>GET
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/_lib/server-env.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/_lib/chapterflow-brand.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$auth$2f$_lib$2f$cognito$2d$domain$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/auth/_lib/cognito-domain.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$auth$2f$_lib$2f$auth$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/auth/_lib/auth-cookie.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$auth$2f$_lib$2f$return$2d$to$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/auth/_lib/return-to.ts [app-route] (ecmascript)");
;
;
;
;
;
;
function base64UrlEncode(bytes) {
    let str = "";
    for (const b of bytes)str += String.fromCharCode(b);
    const b64 = Buffer.from(str, "binary").toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function randomBase64Url(byteLength) {
    const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
    return base64UrlEncode(bytes);
}
async function sha256Base64Url(input) {
    const data = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", data);
    return base64UrlEncode(new Uint8Array(digest));
}
async function GET(req) {
    const domain = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$auth$2f$_lib$2f$cognito$2d$domain$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveCognitoDomain"])();
    const clientId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])("COGNITO_CLIENT_ID");
    const redirectUri = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mustServerEnv"])("COGNITO_REDIRECT_URI");
    if (!domain || !clientId || !redirectUri) {
        return new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"]("Missing server env vars", {
            status: 500
        });
    }
    const state = crypto.randomUUID();
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const defaultReturnTo = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isChapterFlowAppHost"])(host) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isChapterFlowAuthHost"])(host) ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildChapterFlowAppHref"])("/book") : "/app";
    const returnTo = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$auth$2f$_lib$2f$return$2d$to$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["sanitizeReturnTo"])(req.nextUrl.searchParams.get("returnTo"), defaultReturnTo);
    // PKCE: verifier stored in an httpOnly cookie so JS can't steal them
    const codeVerifier = randomBase64Url(32);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    const url = `${domain}/oauth2/authorize` + `?response_type=code` + `&client_id=${encodeURIComponent(clientId)}` + `&redirect_uri=${encodeURIComponent(redirectUri)}` + `&scope=${encodeURIComponent("openid email profile")}` + `&state=${encodeURIComponent(state)}` + `&code_challenge=${encodeURIComponent(codeChallenge)}` + `&code_challenge_method=S256`;
    const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].redirect(url);
    const cookieBase = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$auth$2f$_lib$2f$auth$2d$cookie$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAuthCookieBase"])();
    res.cookies.set("oauth_state", state, {
        ...cookieBase,
        maxAge: 10 * 60
    });
    res.cookies.set("pkce_verifier", codeVerifier, {
        ...cookieBase,
        maxAge: 10 * 60
    });
    res.cookies.set("post_auth_redirect", returnTo, {
        ...cookieBase,
        maxAge: 10 * 60
    });
    return res;
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__b114d4f0._.js.map