module.exports = [
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/lib/incremental-cache/tags-manifest.external.js [external] (next/dist/server/lib/incremental-cache/tags-manifest.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/lib/incremental-cache/tags-manifest.external.js", () => require("next/dist/server/lib/incremental-cache/tags-manifest.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/node:async_hooks [external] (node:async_hooks, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:async_hooks", () => require("node:async_hooks"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/app/app/_lib/dev-auth-bypass.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/app/_lib/chapterflow-brand.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
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
    "getChapterFlowDeploymentMode",
    ()=>getChapterFlowDeploymentMode,
    "getChapterFlowLaunchHref",
    ()=>getChapterFlowLaunchHref,
    "getChapterFlowSiteUrl",
    ()=>getChapterFlowSiteUrl,
    "isChapterFlowAppHost",
    ()=>isChapterFlowAppHost,
    "isChapterFlowAuthHost",
    ()=>isChapterFlowAuthHost,
    "isChapterFlowSiteHost",
    ()=>isChapterFlowSiteHost,
    "isLocalHost",
    ()=>isLocalHost,
    "usesDedicatedChapterFlowHosts",
    ()=>usesDedicatedChapterFlowHosts
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
function getChapterFlowDeploymentMode() {
    const mode = String(process.env.CHAPTERFLOW_DEPLOYMENT_MODE ?? "").trim().toLowerCase();
    return mode === "standalone" ? "standalone" : "embedded";
}
function usesDedicatedChapterFlowHosts() {
    return getChapterFlowDeploymentMode() === "standalone";
}
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
    if (!usesDedicatedChapterFlowHosts()) return false;
    return normalized === hostFromUrl(getChapterFlowAppUrl());
}
function isChapterFlowSiteHost(host) {
    const normalized = normalizeHost(host);
    if (!normalized) return false;
    if (LOCAL_CHAPTERFLOW_HOSTS.has(normalized)) return true;
    if (!usesDedicatedChapterFlowHosts()) return false;
    return normalized === hostFromUrl(getChapterFlowSiteUrl());
}
function isChapterFlowAuthHost(host) {
    const normalized = normalizeHost(host);
    if (!normalized) return false;
    if (LOCAL_CHAPTERFLOW_HOSTS.has(normalized)) return false;
    if (!usesDedicatedChapterFlowHosts()) return false;
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
function getChapterFlowLaunchHref() {
    return usesDedicatedChapterFlowHosts() ? buildChapterFlowSiteHref("/") : "/book";
}
}),
"[project]/proxy.ts [middleware] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "config",
    ()=>config,
    "proxy",
    ()=>proxy
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwt/verify.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwks$2f$remote$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwks/remote.js [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/_lib/dev-auth-bypass.ts [middleware] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/_lib/chapterflow-brand.ts [middleware] (ecmascript)");
;
;
;
;
let cachedProxyAuthConfig = null;
let missingProxyConfigWarned = false;
function getProxyAuthConfig() {
    if (cachedProxyAuthConfig) return cachedProxyAuthConfig;
    const region = process.env.COGNITO_REGION;
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID || null;
    if (!region || !userPoolId) {
        return null;
    }
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
    const jwks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwks$2f$remote$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["createRemoteJWKSet"])(new URL(`${issuer}/.well-known/jwks.json`));
    cachedProxyAuthConfig = {
        issuer,
        jwks,
        clientId
    };
    return cachedProxyAuthConfig;
}
async function isValidToken(token, config) {
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["jwtVerify"])(token, config.jwks, {
            issuer: config.issuer,
            audience: config.clientId ?? undefined
        });
        return true;
    } catch  {
        return false;
    }
}
async function proxy(req) {
    const { pathname } = req.nextUrl;
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    const isChapterFlowSurface = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isChapterFlowSiteHost"])(host) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isChapterFlowAppHost"])(host) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isChapterFlowAuthHost"])(host);
    if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isLocalHost"])(host)) {
        if (pathname.startsWith("/auth") && isChapterFlowSurface && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isChapterFlowAuthHost"])(host)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL(`${(0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["buildChapterFlowAuthHref"])(pathname)}${req.nextUrl.search}`));
        }
        if (pathname.startsWith("/book") && !(0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isChapterFlowAppHost"])(host)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL(`${(0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["buildChapterFlowAppHref"])(pathname)}${req.nextUrl.search}`));
        }
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isChapterFlowAppHost"])(host) && (pathname.startsWith("/app") || pathname.startsWith("/dashboard"))) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["buildChapterFlowAppHref"])("/book")));
        }
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isChapterFlowAuthHost"])(host) && (pathname.startsWith("/app") || pathname.startsWith("/dashboard"))) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["buildChapterFlowAuthHref"])("/")));
        }
        if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isChapterFlowSiteHost"])(host) && (pathname.startsWith("/app") || pathname.startsWith("/dashboard"))) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(new URL((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["buildChapterFlowAuthHref"])("/")));
        }
    }
    const protectedSurface = pathname.startsWith("/app") || pathname.startsWith("/book") || pathname.startsWith("/dashboard");
    if (!protectedSurface) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    const isGuestProjectPage = pathname === "/app/projects/guest";
    const isGuestProjectApi = pathname.startsWith("/app/api/projects/guest/");
    if (isGuestProjectPage || isGuestProjectApi) {
        if (isGuestProjectPage && !req.cookies.get("guest_sid")?.value) {
            const url = req.nextUrl.clone();
            url.pathname = "/test";
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(url);
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["isDevAuthBypassEnabled"])()) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    const authConfig = getProxyAuthConfig();
    if (!authConfig) {
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        if (!missingProxyConfigWarned) {
            missingProxyConfigWarned = true;
            console.warn("proxy_auth_config_missing: COGNITO_REGION/COGNITO_USER_POOL_ID not set in runtime env; skipping proxy auth check (dev only)");
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
    }
    const token = req.cookies.get("id_token")?.value;
    if (!token || !await isValidToken(token, authConfig)) {
        const currentTarget = req.nextUrl.clone();
        const loginUrl = isChapterFlowSurface ? new URL((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$middleware$5d$__$28$ecmascript$29$__["buildChapterFlowAuthHref"])("/auth/login")) : new URL("/auth/login", currentTarget.origin);
        loginUrl.searchParams.set("returnTo", currentTarget.toString());
        const res = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].redirect(loginUrl);
        const cookieDomain = process.env.AUTH_COOKIE_DOMAIN || process.env.CHAPTERFLOW_COOKIE_DOMAIN;
        const normalizedCookieDomain = cookieDomain ? cookieDomain.startsWith(".") ? cookieDomain : `.${cookieDomain}` : undefined;
        res.cookies.set("id_token", "", {
            path: "/",
            maxAge: 0,
            ...normalizedCookieDomain ? {
                domain: normalizedCookieDomain
            } : {}
        });
        res.cookies.set("access_token", "", {
            path: "/",
            maxAge: 0,
            ...normalizedCookieDomain ? {
                domain: normalizedCookieDomain
            } : {}
        });
        return res;
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$middleware$5d$__$28$ecmascript$29$__["NextResponse"].next();
}
const config = {
    matcher: [
        "/app/:path*",
        "/book/:path*",
        "/dashboard/:path*"
    ]
};
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__4bec55be._.js.map