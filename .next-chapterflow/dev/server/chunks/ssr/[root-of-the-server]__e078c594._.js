module.exports = [
"[project]/app/favicon.ico.mjs { IMAGE => \"[project]/app/favicon.ico (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/favicon.ico.mjs { IMAGE => \"[project]/app/favicon.ico (static in ecmascript, tag client)\" } [app-rsc] (structured image object, ecmascript)"));
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[project]/app/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/app/book/layout.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/book/layout.tsx [app-rsc] (ecmascript)"));
}),
"[project]/app/app/api/_lib/server-env.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getServerEnv",
    ()=>getServerEnv,
    "mustServerEnv",
    ()=>mustServerEnv
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-rsc] (ecmascript)");
;
const REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1";
const SSM_PREFIX = (process.env.SSM_PARAMETER_PREFIX || "").trim();
let ssmClientPromise = null;
const resolvedValueCache = new Map();
const missingCache = new Set();
async function getSsmClient() {
    if (ssmClientPromise) return ssmClientPromise;
    ssmClientPromise = (async ()=>{
        const mod = await __turbopack_context__.A("[project]/node_modules/aws-sdk/lib/aws.js [app-rsc] (ecmascript, async loader)");
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
"[project]/app/app/_lib/dev-auth-bypass.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/app/app/api/_lib/auth.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AuthError",
    ()=>AuthError,
    "requireUser",
    ()=>requireUser
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwt/verify.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwks$2f$remote$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/jose/dist/webapi/jwks/remote.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/_lib/server-env.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/_lib/dev-auth-bypass.ts [app-rsc] (ecmascript)");
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
        const region = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["mustServerEnv"])("COGNITO_REGION");
        const userPoolId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["mustServerEnv"])("COGNITO_USER_POOL_ID");
        const clientId = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$server$2d$env$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["mustServerEnv"])("COGNITO_CLIENT_ID");
        const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;
        const jwks = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwks$2f$remote$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["createRemoteJWKSet"])(new URL(`${issuer}/.well-known/jwks.json`));
        return {
            issuer,
            jwks,
            clientId
        };
    })();
    return cachedAuthConfigPromise;
}
async function requireUser() {
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isDevAuthBypassEnabled"])()) {
        return {
            sub: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEV_BYPASS_USER"].sub,
            email: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["DEV_BYPASS_USER"].email
        };
    }
    const token = (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["cookies"])()).get(COOKIE_NAME)?.value;
    if (!token) throw new AuthError("UNAUTHENTICATED");
    const { issuer, jwks, clientId } = await getAuthConfig();
    let payload;
    try {
        ({ payload } = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$jose$2f$dist$2f$webapi$2f$jwt$2f$verify$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jwtVerify"])(token, jwks, {
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
"[project]/app/_lib/require-dashboard-access.ts [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "requireDashboardAccess",
    ()=>requireDashboardAccess
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/headers.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$api$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/next/dist/api/navigation.react-server.js [app-rsc] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/components/navigation.react-server.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/api/_lib/auth.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/app/_lib/dev-auth-bypass.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/_lib/chapterflow-brand.ts [app-rsc] (ecmascript)");
;
;
;
;
;
;
let warnedLocalBypass = false;
async function requireDashboardAccess() {
    if (("TURBOPACK compile-time value", "development") !== "production" && ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$_lib$2f$dev$2d$auth$2d$bypass$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isDevAuthBypassEnabled"])() || !process.env.COGNITO_REGION || !process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID)) {
        if (!warnedLocalBypass) {
            warnedLocalBypass = true;
            console.warn("dashboard_access_dev_bypass: allowing local access because DEV_AUTH_BYPASS is enabled or Cognito env vars are missing in dev.");
        }
        return;
    }
    try {
        await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$app$2f$api$2f$_lib$2f$auth$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireUser"])();
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "UNAUTHENTICATED" || message === "INVALID_TOKEN") {
            const h = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$headers$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["headers"])();
            const host = h.get("x-forwarded-host") || h.get("host");
            const proto = h.get("x-forwarded-proto") || (("TURBOPACK compile-time falsy", 0) ? "TURBOPACK unreachable" : "http");
            const currentOrigin = host ? `${proto}://${host}` : "";
            const returnTo = currentOrigin ? `${currentOrigin}` : "";
            if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isChapterFlowSiteHost"])(host) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isChapterFlowAppHost"])(host) || (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["isChapterFlowAuthHost"])(host)) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(`${(0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["buildChapterFlowAuthHref"])("/auth/login")}?returnTo=${encodeURIComponent(`${returnTo}/book`)}`);
            }
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$components$2f$navigation$2e$react$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["redirect"])(`/auth/login?returnTo=${encodeURIComponent(`${returnTo}/app`)}`);
        }
        throw error;
    }
}
}),
"[project]/app/book/BookOnboardingClient.tsx [app-rsc] (client reference proxy) <module evaluation>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BookOnboardingClient",
    ()=>BookOnboardingClient
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const BookOnboardingClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call BookOnboardingClient() from the server but BookOnboardingClient is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/book/BookOnboardingClient.tsx <module evaluation>", "BookOnboardingClient");
}),
"[project]/app/book/BookOnboardingClient.tsx [app-rsc] (client reference proxy)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BookOnboardingClient",
    ()=>BookOnboardingClient
]);
// This file is generated by next-core EcmascriptClientReferenceModule.
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-server-dom-turbopack-server.js [app-rsc] (ecmascript)");
;
const BookOnboardingClient = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$server$2d$dom$2d$turbopack$2d$server$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["registerClientReference"])(function() {
    throw new Error("Attempted to call BookOnboardingClient() from the server but BookOnboardingClient is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.");
}, "[project]/app/book/BookOnboardingClient.tsx", "BookOnboardingClient");
}),
"[project]/app/book/BookOnboardingClient.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$BookOnboardingClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__$3c$module__evaluation$3e$__ = __turbopack_context__.i("[project]/app/book/BookOnboardingClient.tsx [app-rsc] (client reference proxy) <module evaluation>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$BookOnboardingClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__ = __turbopack_context__.i("[project]/app/book/BookOnboardingClient.tsx [app-rsc] (client reference proxy)");
;
__turbopack_context__.n(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$BookOnboardingClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$client__reference__proxy$29$__);
}),
"[project]/app/book/page.tsx [app-rsc] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>BookOnboardingPage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/server/route-modules/app-page/vendored/rsc/react-jsx-dev-runtime.js [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$require$2d$dashboard$2d$access$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/_lib/require-dashboard-access.ts [app-rsc] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$BookOnboardingClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/BookOnboardingClient.tsx [app-rsc] (ecmascript)");
;
;
;
async function BookOnboardingPage() {
    await (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$require$2d$dashboard$2d$access$2e$ts__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["requireDashboardAccess"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$rsc$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$BookOnboardingClient$2e$tsx__$5b$app$2d$rsc$5d$__$28$ecmascript$29$__["BookOnboardingClient"], {}, void 0, false, {
        fileName: "[project]/app/book/page.tsx",
        lineNumber: 6,
        columnNumber: 10
    }, this);
}
}),
"[project]/app/book/page.tsx [app-rsc] (ecmascript, Next.js Server Component)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/app/book/page.tsx [app-rsc] (ecmascript)"));
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__e078c594._.js.map