(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/app/book/components/StepperDots.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "StepperDots",
    ()=>StepperDots
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
"use client";
;
function StepperDots({ total, current }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center justify-center gap-2",
        "aria-label": `Step ${current + 1} of ${total}`,
        children: Array.from({
            length: total
        }).map((_, index)=>{
            const isActive = index === current;
            return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                "aria-hidden": "true",
                className: [
                    "rounded-full transition-all duration-200",
                    isActive ? "h-2.5 w-12 bg-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.55)]" : "h-2.5 w-2.5 bg-white/20"
                ].join(" ")
            }, index, false, {
                fileName: "[project]/app/book/components/StepperDots.tsx",
                lineNumber: 17,
                columnNumber: 11
            }, this);
        })
    }, void 0, false, {
        fileName: "[project]/app/book/components/StepperDots.tsx",
        lineNumber: 10,
        columnNumber: 5
    }, this);
}
_c = StepperDots;
var _c;
__turbopack_context__.k.register(_c, "StepperDots");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/_lib/chapterflow-brand.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
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
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
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
    const configured = safeUrl(("TURBOPACK compile-time value", "http://localhost:3001") || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.CHAPTERFLOW_SITE_BASE_URL);
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
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/book/components/ChapterFlowMark.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ChapterFlowMark",
    ()=>ChapterFlowMark
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2d$text$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpenText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/book-open-text.js [app-client] (ecmascript) <export default as BookOpenText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$orbit$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Orbit$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/orbit.js [app-client] (ecmascript) <export default as Orbit>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/_lib/chapterflow-brand.ts [app-client] (ecmascript)");
"use client";
;
;
;
function ChapterFlowMark({ compact = false }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex items-center gap-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/30 bg-[radial-gradient(circle_at_30%_25%,rgba(125,211,252,0.32),transparent_52%),linear-gradient(135deg,rgba(8,15,30,0.96),rgba(18,34,54,0.92))] shadow-[0_14px_34px_rgba(14,165,233,0.22)]",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$orbit$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Orbit$3e$__["Orbit"], {
                        className: "absolute h-8 w-8 text-cyan-200/25"
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/ChapterFlowMark.tsx",
                        lineNumber: 14,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2d$text$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpenText$3e$__["BookOpenText"], {
                        className: "relative h-5 w-5 text-cyan-100"
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/ChapterFlowMark.tsx",
                        lineNumber: 15,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/book/components/ChapterFlowMark.tsx",
                lineNumber: 13,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-w-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-[11px] uppercase tracking-[0.34em] text-cyan-200/65",
                        children: "Guided Reading"
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/ChapterFlowMark.tsx",
                        lineNumber: 18,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: compact ? "text-base font-semibold text-slate-50" : "text-xl font-semibold text-slate-50",
                        children: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$_lib$2f$chapterflow$2d$brand$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["CHAPTERFLOW_NAME"]
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/ChapterFlowMark.tsx",
                        lineNumber: 21,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/book/components/ChapterFlowMark.tsx",
                lineNumber: 17,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/book/components/ChapterFlowMark.tsx",
        lineNumber: 12,
        columnNumber: 5
    }, this);
}
_c = ChapterFlowMark;
var _c;
__turbopack_context__.k.register(_c, "ChapterFlowMark");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/book/components/OnboardingShell.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OnboardingShell",
    ()=>OnboardingShell
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-left.js [app-client] (ecmascript) <export default as ArrowLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$StepperDots$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/components/StepperDots.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$ChapterFlowMark$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/components/ChapterFlowMark.tsx [app-client] (ecmascript)");
"use client";
;
;
;
;
;
function OnboardingShell({ step, totalSteps, title, subtitle, children, actions }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
        className: "relative min-h-screen overflow-x-hidden text-slate-100",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none absolute inset-0 -z-20 bg-[#050813]"
            }, void 0, false, {
                fileName: "[project]/app/book/components/OnboardingShell.tsx",
                lineNumber: 28,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(920px_circle_at_10%_-6%,rgba(34,211,238,0.16),transparent_58%),radial-gradient(880px_circle_at_100%_0%,rgba(244,114,182,0.08),transparent_52%)]"
            }, void 0, false, {
                fileName: "[project]/app/book/components/OnboardingShell.tsx",
                lineNumber: 29,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                className: "mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pb-3 pt-6 sm:px-6 sm:pt-8",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$ChapterFlowMark$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["ChapterFlowMark"], {
                        compact: true
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/OnboardingShell.tsx",
                        lineNumber: 32,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                        href: "/",
                        className: "inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/10 hover:text-slate-100",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__["ArrowLeft"], {
                                className: "h-4 w-4"
                            }, void 0, false, {
                                fileName: "[project]/app/book/components/OnboardingShell.tsx",
                                lineNumber: 37,
                                columnNumber: 11
                            }, this),
                            "Back to home"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/book/components/OnboardingShell.tsx",
                        lineNumber: 33,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/book/components/OnboardingShell.tsx",
                lineNumber: 31,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                className: "mx-auto w-full max-w-5xl px-4 pb-14 pt-2 sm:px-6 sm:pb-20",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$StepperDots$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["StepperDots"], {
                        total: totalSteps,
                        current: step
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/OnboardingShell.tsx",
                        lineNumber: 43,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mx-auto mt-7 max-w-3xl text-center",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                className: "text-4xl font-semibold tracking-tight text-slate-50 sm:text-5xl",
                                children: title
                            }, void 0, false, {
                                fileName: "[project]/app/book/components/OnboardingShell.tsx",
                                lineNumber: 46,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-300",
                                children: subtitle
                            }, void 0, false, {
                                fileName: "[project]/app/book/components/OnboardingShell.tsx",
                                lineNumber: 49,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/book/components/OnboardingShell.tsx",
                        lineNumber: 45,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mx-auto mt-8 max-w-5xl",
                        children: children
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/OnboardingShell.tsx",
                        lineNumber: 54,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mx-auto mt-8 max-w-5xl",
                        children: actions
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/OnboardingShell.tsx",
                        lineNumber: 56,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/book/components/OnboardingShell.tsx",
                lineNumber: 42,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/book/components/OnboardingShell.tsx",
        lineNumber: 27,
        columnNumber: 5
    }, this);
}
_c = OnboardingShell;
var _c;
__turbopack_context__.k.register(_c, "OnboardingShell");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/book/data/bookPackages.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE",
    ()=>ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE,
    "ANTIFRAGILE_PACKAGE",
    ()=>ANTIFRAGILE_PACKAGE,
    "ART_OF_WAR_PACKAGE",
    ()=>ART_OF_WAR_PACKAGE,
    "ATOMIC_HABITS_PACKAGE",
    ()=>ATOMIC_HABITS_PACKAGE,
    "ATTACHED_PACKAGE",
    ()=>ATTACHED_PACKAGE,
    "BLUE_OCEAN_STRATEGY_PACKAGE",
    ()=>BLUE_OCEAN_STRATEGY_PACKAGE,
    "BOOK_PACKAGES",
    ()=>BOOK_PACKAGES,
    "BOOK_PACKAGE_PRESENTATION",
    ()=>BOOK_PACKAGE_PRESENTATION,
    "CANT_HURT_ME_PACKAGE",
    ()=>CANT_HURT_ME_PACKAGE,
    "CHARISMA_MYTH_PACKAGE",
    ()=>CHARISMA_MYTH_PACKAGE,
    "COURAGE_TO_BE_DISLIKED_PACKAGE",
    ()=>COURAGE_TO_BE_DISLIKED_PACKAGE,
    "CRUCIAL_CONVERSATIONS_PACKAGE",
    ()=>CRUCIAL_CONVERSATIONS_PACKAGE,
    "DEEP_WORK_PACKAGE",
    ()=>DEEP_WORK_PACKAGE,
    "DIFFICULT_CONVERSATIONS_PACKAGE",
    ()=>DIFFICULT_CONVERSATIONS_PACKAGE,
    "DISCIPLINE_IS_DESTINY_PACKAGE",
    ()=>DISCIPLINE_IS_DESTINY_PACKAGE,
    "DRIVE_PACKAGE",
    ()=>DRIVE_PACKAGE,
    "ESSENTIALISM_PACKAGE",
    ()=>ESSENTIALISM_PACKAGE,
    "EXTREME_OWNERSHIP_PACKAGE",
    ()=>EXTREME_OWNERSHIP_PACKAGE,
    "FRIENDS_AND_INFLUENCE_PACKAGE",
    ()=>FRIENDS_AND_INFLUENCE_PACKAGE,
    "GAMES_PEOPLE_PLAY_PACKAGE",
    ()=>GAMES_PEOPLE_PLAY_PACKAGE,
    "GOOD_STRATEGY_BAD_STRATEGY_PACKAGE",
    ()=>GOOD_STRATEGY_BAD_STRATEGY_PACKAGE,
    "GOOD_TO_GREAT_PACKAGE",
    ()=>GOOD_TO_GREAT_PACKAGE,
    "GRIT_PACKAGE",
    ()=>GRIT_PACKAGE,
    "HARD_THING_ABOUT_HARD_THINGS_PACKAGE",
    ()=>HARD_THING_ABOUT_HARD_THINGS_PACKAGE,
    "HOW_TO_TALK_TO_ANYONE_PACKAGE",
    ()=>HOW_TO_TALK_TO_ANYONE_PACKAGE,
    "INDISTRACTABLE_PACKAGE",
    ()=>INDISTRACTABLE_PACKAGE,
    "INFLUENCE_PACKAGE",
    ()=>INFLUENCE_PACKAGE,
    "LAWS_OF_HUMAN_NATURE_PACKAGE",
    ()=>LAWS_OF_HUMAN_NATURE_PACKAGE,
    "LAWS_OF_POWER_PACKAGE",
    ()=>LAWS_OF_POWER_PACKAGE,
    "LEAN_STARTUP_PACKAGE",
    ()=>LEAN_STARTUP_PACKAGE,
    "LIKE_SWITCH_PACKAGE",
    ()=>LIKE_SWITCH_PACKAGE,
    "MAKE_TIME_PACKAGE",
    ()=>MAKE_TIME_PACKAGE,
    "MANS_SEARCH_FOR_MEANING_PACKAGE",
    ()=>MANS_SEARCH_FOR_MEANING_PACKAGE,
    "MASTERY_PACKAGE",
    ()=>MASTERY_PACKAGE,
    "MEDITATIONS_PACKAGE",
    ()=>MEDITATIONS_PACKAGE,
    "MILLIONAIRE_FASTLANE_PACKAGE",
    ()=>MILLIONAIRE_FASTLANE_PACKAGE,
    "MINDSET_PACKAGE",
    ()=>MINDSET_PACKAGE,
    "NEVER_SPLIT_THE_DIFFERENCE_PACKAGE",
    ()=>NEVER_SPLIT_THE_DIFFERENCE_PACKAGE,
    "OBSTACLE_IS_THE_WAY_PACKAGE",
    ()=>OBSTACLE_IS_THE_WAY_PACKAGE,
    "ONE_THING_PACKAGE",
    ()=>ONE_THING_PACKAGE,
    "PITCH_ANYTHING_PACKAGE",
    ()=>PITCH_ANYTHING_PACKAGE,
    "POWER_OF_HABIT_PACKAGE",
    ()=>POWER_OF_HABIT_PACKAGE,
    "PREDICTABLY_IRRATIONAL_PACKAGE",
    ()=>PREDICTABLY_IRRATIONAL_PACKAGE,
    "PRE_SUASION_PACKAGE",
    ()=>PRE_SUASION_PACKAGE,
    "PSYCHOLOGY_OF_MONEY_PACKAGE",
    ()=>PSYCHOLOGY_OF_MONEY_PACKAGE,
    "RICH_DAD_POOR_DAD_PACKAGE",
    ()=>RICH_DAD_POOR_DAD_PACKAGE,
    "RIGHTEOUS_MIND_PACKAGE",
    ()=>RIGHTEOUS_MIND_PACKAGE,
    "SEVEN_HABITS_PACKAGE",
    ()=>SEVEN_HABITS_PACKAGE,
    "SO_GOOD_THEY_CANT_IGNORE_YOU_PACKAGE",
    ()=>SO_GOOD_THEY_CANT_IGNORE_YOU_PACKAGE,
    "START_WITH_WHY_PACKAGE",
    ()=>START_WITH_WHY_PACKAGE,
    "STRATEGIES_OF_WAR_PACKAGE",
    ()=>STRATEGIES_OF_WAR_PACKAGE,
    "TALK_LIKE_TED_PACKAGE",
    ()=>TALK_LIKE_TED_PACKAGE,
    "THE_PRINCE_PACKAGE",
    ()=>THE_PRINCE_PACKAGE,
    "THINKING_FAST_AND_SLOW_PACKAGE",
    ()=>THINKING_FAST_AND_SLOW_PACKAGE,
    "TINY_HABITS_PACKAGE",
    ()=>TINY_HABITS_PACKAGE,
    "WHAT_EVERY_BODY_IS_SAYING_PACKAGE",
    ()=>WHAT_EVERY_BODY_IS_SAYING_PACKAGE,
    "ZERO_TO_ONE_PACKAGE",
    ()=>ZERO_TO_ONE_PACKAGE,
    "getBookPackageById",
    ()=>getBookPackageById,
    "getBookPackagePresentation",
    ()=>getBookPackagePresentation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$friends$2d$and$2d$influence$2d$student$2d$edition$2e$student$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/friends-and-influence-student-edition.student.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$art$2d$of$2d$war$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/art-of-war.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$prince$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-prince.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$33$2d$strategies$2d$of$2d$war$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/33-strategies-of-war.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$influence$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/influence.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$laws$2d$of$2d$human$2d$nature$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/laws-of-human-nature.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$pre$2d$suasion$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/pre-suasion.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$never$2d$split$2d$the$2d$difference$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/never-split-the-difference.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$games$2d$people$2d$play$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/games-people-play.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$crucial$2d$conversations$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/crucial-conversations.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$difficult$2d$conversations$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/difficult-conversations.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$charisma$2d$myth$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-charisma-myth.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$what$2d$every$2d$body$2d$is$2d$saying$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/what-every-body-is-saying.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$power$2d$of$2d$habit$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-power-of-habit.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$tiny$2d$habits$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/tiny-habits.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$essentialism$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/essentialism.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$deep$2d$work$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/deep-work.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$drive$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/drive.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$mindset$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/mindset.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$grit$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/grit.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$courage$2d$to$2d$be$2d$disliked$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-courage-to-be-disliked.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$attached$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/attached.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$start$2d$with$2d$why$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/start-with-why.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$7$2d$habits$2d$of$2d$highly$2d$effective$2d$people$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-7-habits-of-highly-effective-people.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$millionaire$2d$fastlane$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-millionaire-fastlane.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$rich$2d$dad$2d$poor$2d$dad$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/rich-dad-poor-dad.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$make$2d$time$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/make-time.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$psychology$2d$of$2d$money$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-psychology-of-money.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$thinking$2d$fast$2d$and$2d$slow$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/thinking-fast-and-slow.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$predictably$2d$irrational$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/predictably-irrational.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$almanack$2d$of$2d$naval$2d$ravikant$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-almanack-of-naval-ravikant.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$extreme$2d$ownership$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/extreme-ownership.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$hard$2d$thing$2d$about$2d$hard$2d$things$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-hard-thing-about-hard-things.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$good$2d$to$2d$great$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/good-to-great.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$48$2d$laws$2d$of$2d$power$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-48-laws-of-power.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$atomic$2d$habits$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/atomic-habits.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$one$2d$thing$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-one-thing.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$indistractable$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/indistractable.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$cant$2d$hurt$2d$me$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/cant-hurt-me.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$so$2d$good$2d$they$2d$cant$2d$ignore$2d$you$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/so-good-they-cant-ignore-you.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$talk$2d$like$2d$ted$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/talk-like-ted.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$like$2d$switch$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-like-switch.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$pitch$2d$anything$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/pitch-anything.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$how$2d$to$2d$talk$2d$to$2d$anyone$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/how-to-talk-to-anyone.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$righteous$2d$mind$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-righteous-mind.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$zero$2d$to$2d$one$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/zero-to-one.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$lean$2d$startup$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-lean-startup.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$blue$2d$ocean$2d$strategy$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/blue-ocean-strategy.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$good$2d$strategy$2d$bad$2d$strategy$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/good-strategy-bad-strategy.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$antifragile$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/antifragile.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$mastery$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/mastery.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$obstacle$2d$is$2d$the$2d$way$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/the-obstacle-is-the-way.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$discipline$2d$is$2d$destiny$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/discipline-is-destiny.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$meditations$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/meditations.modern.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$mans$2d$search$2d$for$2d$meaning$2e$modern$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/book-packages/mans-search-for-meaning.modern.json (json)");
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
const FRIENDS_AND_INFLUENCE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$friends$2d$and$2d$influence$2d$student$2d$edition$2e$student$2e$json__$28$json$29$__["default"];
const ART_OF_WAR_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$art$2d$of$2d$war$2e$modern$2e$json__$28$json$29$__["default"];
const THE_PRINCE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$prince$2e$modern$2e$json__$28$json$29$__["default"];
const STRATEGIES_OF_WAR_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$33$2d$strategies$2d$of$2d$war$2e$modern$2e$json__$28$json$29$__["default"];
const INFLUENCE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$influence$2e$modern$2e$json__$28$json$29$__["default"];
const LAWS_OF_HUMAN_NATURE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$laws$2d$of$2d$human$2d$nature$2e$modern$2e$json__$28$json$29$__["default"];
const PRE_SUASION_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$pre$2d$suasion$2e$modern$2e$json__$28$json$29$__["default"];
const NEVER_SPLIT_THE_DIFFERENCE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$never$2d$split$2d$the$2d$difference$2e$modern$2e$json__$28$json$29$__["default"];
const GAMES_PEOPLE_PLAY_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$games$2d$people$2d$play$2e$modern$2e$json__$28$json$29$__["default"];
const CRUCIAL_CONVERSATIONS_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$crucial$2d$conversations$2e$modern$2e$json__$28$json$29$__["default"];
const DIFFICULT_CONVERSATIONS_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$difficult$2d$conversations$2e$modern$2e$json__$28$json$29$__["default"];
const CHARISMA_MYTH_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$charisma$2d$myth$2e$modern$2e$json__$28$json$29$__["default"];
const WHAT_EVERY_BODY_IS_SAYING_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$what$2d$every$2d$body$2d$is$2d$saying$2e$modern$2e$json__$28$json$29$__["default"];
const POWER_OF_HABIT_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$power$2d$of$2d$habit$2e$modern$2e$json__$28$json$29$__["default"];
const TINY_HABITS_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$tiny$2d$habits$2e$modern$2e$json__$28$json$29$__["default"];
const ESSENTIALISM_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$essentialism$2e$modern$2e$json__$28$json$29$__["default"];
const DEEP_WORK_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$deep$2d$work$2e$modern$2e$json__$28$json$29$__["default"];
const DRIVE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$drive$2e$modern$2e$json__$28$json$29$__["default"];
const MINDSET_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$mindset$2e$modern$2e$json__$28$json$29$__["default"];
const GRIT_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$grit$2e$modern$2e$json__$28$json$29$__["default"];
const COURAGE_TO_BE_DISLIKED_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$courage$2d$to$2d$be$2d$disliked$2e$modern$2e$json__$28$json$29$__["default"];
const ATTACHED_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$attached$2e$modern$2e$json__$28$json$29$__["default"];
const START_WITH_WHY_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$start$2d$with$2d$why$2e$modern$2e$json__$28$json$29$__["default"];
const SEVEN_HABITS_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$7$2d$habits$2d$of$2d$highly$2d$effective$2d$people$2e$modern$2e$json__$28$json$29$__["default"];
const MILLIONAIRE_FASTLANE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$millionaire$2d$fastlane$2e$modern$2e$json__$28$json$29$__["default"];
const RICH_DAD_POOR_DAD_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$rich$2d$dad$2d$poor$2d$dad$2e$modern$2e$json__$28$json$29$__["default"];
const MAKE_TIME_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$make$2d$time$2e$modern$2e$json__$28$json$29$__["default"];
const PSYCHOLOGY_OF_MONEY_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$psychology$2d$of$2d$money$2e$modern$2e$json__$28$json$29$__["default"];
const THINKING_FAST_AND_SLOW_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$thinking$2d$fast$2d$and$2d$slow$2e$modern$2e$json__$28$json$29$__["default"];
const PREDICTABLY_IRRATIONAL_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$predictably$2d$irrational$2e$modern$2e$json__$28$json$29$__["default"];
const ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$almanack$2d$of$2d$naval$2d$ravikant$2e$modern$2e$json__$28$json$29$__["default"];
const EXTREME_OWNERSHIP_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$extreme$2d$ownership$2e$modern$2e$json__$28$json$29$__["default"];
const HARD_THING_ABOUT_HARD_THINGS_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$hard$2d$thing$2d$about$2d$hard$2d$things$2e$modern$2e$json__$28$json$29$__["default"];
const GOOD_TO_GREAT_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$good$2d$to$2d$great$2e$modern$2e$json__$28$json$29$__["default"];
const LAWS_OF_POWER_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$48$2d$laws$2d$of$2d$power$2e$modern$2e$json__$28$json$29$__["default"];
const ATOMIC_HABITS_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$atomic$2d$habits$2e$modern$2e$json__$28$json$29$__["default"];
const ONE_THING_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$one$2d$thing$2e$modern$2e$json__$28$json$29$__["default"];
const INDISTRACTABLE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$indistractable$2e$modern$2e$json__$28$json$29$__["default"];
const CANT_HURT_ME_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$cant$2d$hurt$2d$me$2e$modern$2e$json__$28$json$29$__["default"];
const SO_GOOD_THEY_CANT_IGNORE_YOU_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$so$2d$good$2d$they$2d$cant$2d$ignore$2d$you$2e$modern$2e$json__$28$json$29$__["default"];
const TALK_LIKE_TED_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$talk$2d$like$2d$ted$2e$modern$2e$json__$28$json$29$__["default"];
const LIKE_SWITCH_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$like$2d$switch$2e$modern$2e$json__$28$json$29$__["default"];
const PITCH_ANYTHING_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$pitch$2d$anything$2e$modern$2e$json__$28$json$29$__["default"];
const HOW_TO_TALK_TO_ANYONE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$how$2d$to$2d$talk$2d$to$2d$anyone$2e$modern$2e$json__$28$json$29$__["default"];
const RIGHTEOUS_MIND_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$righteous$2d$mind$2e$modern$2e$json__$28$json$29$__["default"];
const ZERO_TO_ONE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$zero$2d$to$2d$one$2e$modern$2e$json__$28$json$29$__["default"];
const LEAN_STARTUP_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$lean$2d$startup$2e$modern$2e$json__$28$json$29$__["default"];
const BLUE_OCEAN_STRATEGY_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$blue$2d$ocean$2d$strategy$2e$modern$2e$json__$28$json$29$__["default"];
const GOOD_STRATEGY_BAD_STRATEGY_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$good$2d$strategy$2d$bad$2d$strategy$2e$modern$2e$json__$28$json$29$__["default"];
const ANTIFRAGILE_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$antifragile$2e$modern$2e$json__$28$json$29$__["default"];
const MASTERY_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$mastery$2e$modern$2e$json__$28$json$29$__["default"];
const OBSTACLE_IS_THE_WAY_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$the$2d$obstacle$2d$is$2d$the$2d$way$2e$modern$2e$json__$28$json$29$__["default"];
const DISCIPLINE_IS_DESTINY_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$discipline$2d$is$2d$destiny$2e$modern$2e$json__$28$json$29$__["default"];
const MEDITATIONS_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$meditations$2e$modern$2e$json__$28$json$29$__["default"];
const MANS_SEARCH_FOR_MEANING_PACKAGE = __TURBOPACK__imported__module__$5b$project$5d2f$book$2d$packages$2f$mans$2d$search$2d$for$2d$meaning$2e$modern$2e$json__$28$json$29$__["default"];
const BOOK_PACKAGES = [
    FRIENDS_AND_INFLUENCE_PACKAGE,
    ART_OF_WAR_PACKAGE,
    THE_PRINCE_PACKAGE,
    STRATEGIES_OF_WAR_PACKAGE,
    INFLUENCE_PACKAGE,
    LAWS_OF_HUMAN_NATURE_PACKAGE,
    PRE_SUASION_PACKAGE,
    NEVER_SPLIT_THE_DIFFERENCE_PACKAGE,
    GAMES_PEOPLE_PLAY_PACKAGE,
    CRUCIAL_CONVERSATIONS_PACKAGE,
    DIFFICULT_CONVERSATIONS_PACKAGE,
    CHARISMA_MYTH_PACKAGE,
    WHAT_EVERY_BODY_IS_SAYING_PACKAGE,
    POWER_OF_HABIT_PACKAGE,
    TINY_HABITS_PACKAGE,
    ESSENTIALISM_PACKAGE,
    DEEP_WORK_PACKAGE,
    DRIVE_PACKAGE,
    MINDSET_PACKAGE,
    GRIT_PACKAGE,
    COURAGE_TO_BE_DISLIKED_PACKAGE,
    ATTACHED_PACKAGE,
    START_WITH_WHY_PACKAGE,
    SEVEN_HABITS_PACKAGE,
    MILLIONAIRE_FASTLANE_PACKAGE,
    RICH_DAD_POOR_DAD_PACKAGE,
    MAKE_TIME_PACKAGE,
    PSYCHOLOGY_OF_MONEY_PACKAGE,
    THINKING_FAST_AND_SLOW_PACKAGE,
    PREDICTABLY_IRRATIONAL_PACKAGE,
    ALMANACK_OF_NAVAL_RAVIKANT_PACKAGE,
    EXTREME_OWNERSHIP_PACKAGE,
    HARD_THING_ABOUT_HARD_THINGS_PACKAGE,
    GOOD_TO_GREAT_PACKAGE,
    LAWS_OF_POWER_PACKAGE,
    ATOMIC_HABITS_PACKAGE,
    ONE_THING_PACKAGE,
    INDISTRACTABLE_PACKAGE,
    CANT_HURT_ME_PACKAGE,
    SO_GOOD_THEY_CANT_IGNORE_YOU_PACKAGE,
    TALK_LIKE_TED_PACKAGE,
    LIKE_SWITCH_PACKAGE,
    PITCH_ANYTHING_PACKAGE,
    HOW_TO_TALK_TO_ANYONE_PACKAGE,
    RIGHTEOUS_MIND_PACKAGE,
    ZERO_TO_ONE_PACKAGE,
    LEAN_STARTUP_PACKAGE,
    BLUE_OCEAN_STRATEGY_PACKAGE,
    GOOD_STRATEGY_BAD_STRATEGY_PACKAGE,
    ANTIFRAGILE_PACKAGE,
    MASTERY_PACKAGE,
    OBSTACLE_IS_THE_WAY_PACKAGE,
    DISCIPLINE_IS_DESTINY_PACKAGE,
    MEDITATIONS_PACKAGE,
    MANS_SEARCH_FOR_MEANING_PACKAGE
];
const BOOK_PACKAGE_PRESENTATION = {
    "friends-and-influence-student-edition": {
        icon: "🤝",
        coverImage: "/book-covers/friends-and-influence-student-edition.svg",
        difficulty: "Medium",
        synopsis: "A classic communication guide focused on first impressions, attentive listening, better questions, respectful disagreement, and the habits that make relationships stronger over time.",
        pages: 304
    },
    "art-of-war": {
        icon: "🐉",
        coverImage: "/book-covers/art-of-war.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of strategy, incentives, leadership, legitimacy, coalition management, and ethical tradeoffs for students and early career builders.",
        pages: 288
    },
    "the-prince": {
        icon: "👑",
        coverImage: "/book-covers/the-prince.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of leadership, legitimacy, incentives, reputation, and ethical tradeoffs in governance for students and early career builders.",
        pages: 272
    },
    "33-strategies-of-war": {
        icon: "🛡️",
        coverImage: "/book-covers/33-strategies-of-war.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of conflict, leverage, reputation, timing, coalition building, and strategic discipline for students and early career builders.",
        pages: 336
    },
    influence: {
        icon: "🧠",
        coverImage: "/book-covers/influence.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of persuasion, reciprocity, consistency, social proof, authority, scarcity, and ethical influence for students and early career builders.",
        pages: 336
    },
    "laws-of-human-nature": {
        icon: "🫀",
        coverImage: "/book-covers/laws-of-human-nature.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of self awareness, group dynamics, hidden motives, insecurity, ambition, and leadership for students and early career builders.",
        pages: 624
    },
    "pre-suasion": {
        icon: "🎯",
        coverImage: "/book-covers/pre-suasion.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of attention, framing, timing, readiness, unity, and ethical persuasion for students and early career builders.",
        pages: 432
    },
    "never-split-the-difference": {
        icon: "🗣️",
        coverImage: "/book-covers/never-split-the-difference.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of negotiation, tactical empathy, calibrated questions, commitment, and leverage for students and early career builders.",
        pages: 320
    },
    "games-people-play": {
        icon: "♟️",
        coverImage: "/book-covers/games-people-play.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of transactional analysis, repeated social scripts, hidden payoffs, and autonomy for students and early career builders.",
        pages: 272
    },
    "crucial-conversations": {
        icon: "💬",
        coverImage: "/book-covers/crucial-conversations.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of dialogue, shared meaning, safety, accountability, and high stakes communication for students and early career builders.",
        pages: 336
    },
    "difficult-conversations": {
        icon: "🧩",
        coverImage: "/book-covers/difficult-conversations.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of hard conversations, contribution, feelings, identity, and learning under pressure for students and early career builders.",
        pages: 400
    },
    "the-charisma-myth": {
        icon: "✨",
        coverImage: "/book-covers/the-charisma-myth.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of presence, power, warmth, composure, social perception, and ethical influence for students and early career builders.",
        pages: 320
    },
    "what-every-body-is-saying": {
        icon: "👁️",
        coverImage: "/book-covers/what-every-body-is-saying.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of body language, nonverbal signals, observation, baseline, context, and ethical interpretation for students and early career builders.",
        pages: 304
    },
    "the-power-of-habit": {
        icon: "🔁",
        coverImage: "/book-covers/the-power-of-habit.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of cue, routine, reward, craving, willpower, keystone habits, and behavioral design for students and early career builders.",
        pages: 384
    },
    "tiny-habits": {
        icon: "🌱",
        coverImage: "/book-covers/tiny-habits.svg",
        difficulty: "Easy",
        synopsis: "A modern reading of behavior design, prompts, tiny actions, celebration, scaling, and compassionate habit change for students and early career builders.",
        pages: 320
    },
    essentialism: {
        icon: "🎯",
        coverImage: "/book-covers/essentialism.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of focus, priorities, tradeoffs, boundaries, editing, and disciplined selection for students and early career builders.",
        pages: 272
    },
    "deep-work": {
        icon: "🌊",
        coverImage: "/book-covers/deep-work.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of concentration, cognitive depth, digital discipline, shallow work reduction, and focused value creation for students and early career builders.",
        pages: 304
    },
    drive: {
        icon: "⚙️",
        coverImage: "/book-covers/drive.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of motivation, autonomy, mastery, purpose, and how incentives shape performance for students and early career builders.",
        pages: 256
    },
    mindset: {
        icon: "🌱",
        coverImage: "/book-covers/mindset.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of fixed and growth mindsets, learning, effort, feedback, resilience, and the beliefs that shape development across school, work, and relationships.",
        pages: 320
    },
    grit: {
        icon: "🏔️",
        coverImage: "/book-covers/grit.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of perseverance, passion, deliberate practice, purpose, hope, and the long term habits that make difficult goals achievable.",
        pages: 352
    },
    "the-courage-to-be-disliked": {
        icon: "🕊️",
        coverImage: "/book-covers/the-courage-to-be-disliked.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of Adlerian psychology, freedom, boundaries, contribution, courage, and the social choices that shape a meaningful life.",
        pages: 288
    },
    attached: {
        icon: "🧷",
        coverImage: "/book-covers/attached.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of attachment styles, dating patterns, secure communication, conflict, and the relational habits that make love steadier and healthier.",
        pages: 304
    },
    "start-with-why": {
        icon: "🎯",
        coverImage: "/book-covers/start-with-why.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of purpose, trust, leadership, strategy, communication, and how clear belief creates stronger alignment and followership.",
        pages: 256
    },
    "the-7-habits-of-highly-effective-people": {
        icon: "🧭",
        coverImage: "/book-covers/the-7-habits-of-highly-effective-people.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of principles, priorities, trust, proactivity, interdependence, and the habits that turn character into lasting effectiveness.",
        pages: 432
    },
    "the-millionaire-fastlane": {
        icon: "🏎️",
        coverImage: "/book-covers/the-millionaire-fastlane.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of leverage, control, value creation, entrepreneurship, and the systems that can accelerate financial freedom faster than conventional scripts.",
        pages: 352
    },
    "rich-dad-poor-dad": {
        icon: "💼",
        coverImage: "/book-covers/rich-dad-poor-dad.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of financial literacy, assets, cash flow, ownership, money habits, and the mindset shifts that can improve long term financial freedom.",
        pages: 336
    },
    "make-time": {
        icon: "⏳",
        coverImage: "/book-covers/make-time.svg",
        difficulty: "Easy",
        synopsis: "A modern reading of daily highlights, distraction defense, energy design, reflection, and practical attention management for students and early career builders.",
        pages: 304
    },
    "the-psychology-of-money": {
        icon: "💸",
        coverImage: "/book-covers/the-psychology-of-money.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of money behavior, risk, patience, enough, visible status, and financial resilience for students and early career builders.",
        pages: 256
    },
    "thinking-fast-and-slow": {
        icon: "🧠",
        coverImage: "/book-covers/thinking-fast-and-slow.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of judgment, bias, intuition, framing, risk, prediction, and the limits of confidence for students and early career builders.",
        pages: 512
    },
    "predictably-irrational": {
        icon: "🎲",
        coverImage: "/book-covers/predictably-irrational.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of behavioral economics, anchoring, pricing, self control, honesty, social norms, and choice design for students and early career builders.",
        pages: 384
    },
    "the-almanack-of-naval-ravikant": {
        icon: "📘",
        coverImage: "/book-covers/the-almanack-of-naval-ravikant.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of wealth, leverage, judgment, happiness, freedom, and practical philosophy for students and early career builders.",
        pages: 242
    },
    "extreme-ownership": {
        icon: "🪖",
        coverImage: "/book-covers/extreme-ownership.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of accountability, leadership, team clarity, execution, discipline, and calm decision making under pressure for students and early career builders.",
        pages: 320
    },
    "the-hard-thing-about-hard-things": {
        icon: "🧱",
        coverImage: "/book-covers/the-hard-thing-about-hard-things.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of startup leadership, crisis management, truth telling, painful decisions, and management under pressure for students and early career builders.",
        pages: 304
    },
    "good-to-great": {
        icon: "📈",
        coverImage: "/book-covers/good-to-great.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of disciplined leadership, people choices, brutal facts, strategic focus, and momentum building for students and early career builders.",
        pages: 320
    },
    "the-48-laws-of-power": {
        icon: "♜",
        coverImage: "/book-covers/the-48-laws-of-power.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of power, timing, reputation, influence, and strategic awareness for students and early career builders.",
        pages: 480
    },
    "atomic-habits": {
        icon: "⚛️",
        coverImage: "/book-covers/atomic-habits.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of habit loops, identity based change, environment design, and compounding improvement for students and early career builders.",
        pages: 320
    },
    "the-one-thing": {
        icon: "🎯",
        coverImage: "/book-covers/the-one-thing.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of focus, leverage, time blocking, tradeoffs, and extraordinary results through strategic simplicity for students and early career builders.",
        pages: 240
    },
    indistractable: {
        icon: "🧭",
        coverImage: "/book-covers/indistractable.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of attention control, distraction design, timeboxing, precommitment, and value aligned focus for students and early career builders.",
        pages: 304
    },
    "cant-hurt-me": {
        icon: "💪",
        coverImage: "/book-covers/cant-hurt-me.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of self discipline, accountability, resilience, pain tolerance, and deliberate mental toughness for students and early career builders.",
        pages: 364
    },
    "so-good-they-cant-ignore-you": {
        icon: "🛠️",
        coverImage: "/book-covers/so-good-they-cant-ignore-you.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of career capital, craftsmanship, autonomy, mission, and skill first career strategy for students and early career builders.",
        pages: 288
    },
    "talk-like-ted": {
        icon: "🎤",
        coverImage: "/book-covers/talk-like-ted.svg",
        difficulty: "Easy",
        synopsis: "A modern reading of storytelling, memorable speaking, audience attention, and authentic presentation design for students and early career builders.",
        pages: 288
    },
    "the-like-switch": {
        icon: "🤝",
        coverImage: "/book-covers/the-like-switch.svg",
        difficulty: "Easy",
        synopsis: "A modern reading of rapport, likability, social signals, trust building, and conversational skill for students and early career builders.",
        pages: 288
    },
    "pitch-anything": {
        icon: "📣",
        coverImage: "/book-covers/pitch-anything.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of frame control, status, persuasion structure, and high stakes pitching for students and early career builders.",
        pages: 240
    },
    "how-to-talk-to-anyone": {
        icon: "🗨️",
        coverImage: "/book-covers/how-to-talk-to-anyone.svg",
        difficulty: "Easy",
        synopsis: "A modern reading of first impressions, rapport, conversational ease, networking, and relationship building for students and early career builders.",
        pages: 368
    },
    "the-righteous-mind": {
        icon: "⚖️",
        coverImage: "/book-covers/the-righteous-mind.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of moral psychology, intuition, reasoning, polarization, group identity, and ethical disagreement for students and early career builders.",
        pages: 528
    },
    "zero-to-one": {
        icon: "🚀",
        coverImage: "/book-covers/zero-to-one.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of startup strategy, innovation, monopoly, distribution, contrarian thinking, and durable value creation for students and early career builders.",
        pages: 224
    },
    "the-lean-startup": {
        icon: "🧪",
        coverImage: "/book-covers/the-lean-startup.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of startup experiments, validated learning, pivots, metrics, feedback loops, and innovation management for students and early career builders.",
        pages: 336
    },
    "blue-ocean-strategy": {
        icon: "🌊",
        coverImage: "/book-covers/blue-ocean-strategy.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of market creation, strategy canvas thinking, differentiation, noncustomers, sequencing, and execution alignment for students and early career builders.",
        pages: 320
    },
    "good-strategy-bad-strategy": {
        icon: "♞",
        coverImage: "/book-covers/good-strategy-bad-strategy.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of diagnosis, leverage, coherent action, strategic focus, and the difference between real strategy and empty ambition for students and early career builders.",
        pages: 336
    },
    antifragile: {
        icon: "🦂",
        coverImage: "/book-covers/antifragile.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of fragility, optionality, nonlinear risk, skin in the game, and how systems can gain from stress and variability.",
        pages: 544
    },
    mastery: {
        icon: "🎻",
        coverImage: "/book-covers/mastery.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of apprenticeship, deliberate practice, mentorship, social intelligence, creativity, and the long path to deep skill.",
        pages: 352
    },
    "the-obstacle-is-the-way": {
        icon: "🪨",
        coverImage: "/book-covers/the-obstacle-is-the-way.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of stoic resilience, disciplined perception, purposeful action, and steady will under pressure for students and early career builders.",
        pages: 224
    },
    "discipline-is-destiny": {
        icon: "🛡️",
        coverImage: "/book-covers/discipline-is-destiny.svg",
        difficulty: "Medium",
        synopsis: "A modern reading of self control, temperance, routines, boundaries, endurance, and character shaped through disciplined daily practice.",
        pages: 352
    },
    meditations: {
        icon: "🏛️",
        coverImage: "/book-covers/meditations.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of stoic self command, mortality, duty, perspective, and ethical conduct under pressure.",
        pages: 304
    },
    "mans-search-for-meaning": {
        icon: "🕯️",
        coverImage: "/book-covers/mans-search-for-meaning.svg",
        difficulty: "Hard",
        synopsis: "A modern reading of suffering, responsibility, purpose, logotherapy, and the search for meaning under constraint.",
        pages: 200
    }
};
function getBookPackageById(bookId) {
    return BOOK_PACKAGES.find((pkg)=>pkg.book.bookId === bookId);
}
function getBookPackagePresentation(bookId) {
    return BOOK_PACKAGE_PRESENTATION[bookId] ?? {
        icon: "📘",
        coverImage: `/book-covers/${bookId}.svg`,
        difficulty: "Medium",
        synopsis: "A focused, chapter-based learning experience with examples, quizzes, and measurable progress."
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/book/data/booksCatalog.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BOOKS_CATALOG",
    ()=>BOOKS_CATALOG,
    "getBookById",
    ()=>getBookById,
    "getBookCoverCandidates",
    ()=>getBookCoverCandidates,
    "getBookSynopsis",
    ()=>getBookSynopsis
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$bookPackages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/data/bookPackages.ts [app-client] (ecmascript)");
;
function totalReadingMinutes(chapters) {
    return chapters.reduce((sum, chapter)=>sum + Math.max(chapter.readingTimeMinutes, 1), 0);
}
const BOOKS_CATALOG = __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$bookPackages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BOOK_PACKAGES"].map(_c = (pkg)=>{
    const presentation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$bookPackages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBookPackagePresentation"])(pkg.book.bookId);
    return {
        id: pkg.book.bookId,
        icon: presentation.icon,
        coverImage: presentation.coverImage,
        title: pkg.book.title,
        author: pkg.book.author,
        category: pkg.book.categories[0] ?? "General",
        difficulty: presentation.difficulty,
        estimatedMinutes: totalReadingMinutes(pkg.chapters)
    };
});
_c1 = BOOKS_CATALOG;
function getBookById(bookId) {
    return BOOKS_CATALOG.find((book)=>book.id === bookId);
}
function getBookCoverCandidates(book) {
    if (book.coverImage) return [
        book.coverImage
    ];
    return [
        `/book-covers/${book.id}.svg`,
        `/book-covers/${book.id}.png`,
        `/book-covers/${book.id}.jpg`,
        `/book-covers/${book.id}.jpeg`,
        `/book-covers/${book.id}.webp`,
        `/book-covers/${book.id}.avif`
    ];
}
function getBookSynopsis(bookId) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$bookPackages$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBookPackagePresentation"])(bookId).synopsis;
}
var _c, _c1;
__turbopack_context__.k.register(_c, "BOOKS_CATALOG$BOOK_PACKAGES.map");
__turbopack_context__.k.register(_c1, "BOOKS_CATALOG");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/book/components/BookCover.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BookCover",
    ()=>BookCover
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/image.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$booksCatalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/data/booksCatalog.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function BookCover({ bookId, title, icon, coverImage, className, imageClassName, fallbackClassName, sizes = "120px" }) {
    _s();
    const candidates = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "BookCover.useMemo[candidates]": ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$booksCatalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getBookCoverCandidates"])({
                id: bookId,
                coverImage
            })
    }["BookCover.useMemo[candidates]"], [
        bookId,
        coverImage
    ]);
    const [activeIndex, setActiveIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(0);
    const src = candidates[activeIndex];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: [
            "relative overflow-hidden",
            className
        ].filter(Boolean).join(" "),
        "aria-hidden": "true",
        children: [
            src ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$image$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                src: src,
                alt: `${title} cover`,
                fill: true,
                sizes: sizes,
                className: [
                    "object-contain bg-white",
                    imageClassName
                ].filter(Boolean).join(" "),
                onError: ()=>{
                    setActiveIndex((prev)=>{
                        if (prev + 1 >= candidates.length) {
                            return candidates.length;
                        }
                        return prev + 1;
                    });
                },
                unoptimized: true
            }, src, false, {
                fileName: "[project]/app/book/components/BookCover.tsx",
                lineNumber: 46,
                columnNumber: 9
            }, this) : null,
            !src || activeIndex >= candidates.length ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: [
                    "absolute inset-0 flex items-center justify-center",
                    fallbackClassName
                ].filter(Boolean).join(" "),
                children: icon
            }, void 0, false, {
                fileName: "[project]/app/book/components/BookCover.tsx",
                lineNumber: 71,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/app/book/components/BookCover.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
_s(BookCover, "UAsCGESRx0JVaVxFtFxeRoD4Nhc=");
_c = BookCover;
var _c;
__turbopack_context__.k.register(_c, "BookCover");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/book/components/BookCard.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BookCard",
    ()=>BookCard
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/circle-check.js [app-client] (ecmascript) <export default as CheckCircle2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2d$3$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock3$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/clock-3.js [app-client] (ecmascript) <export default as Clock3>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$BookCover$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/components/BookCover.tsx [app-client] (ecmascript)");
"use client";
;
;
;
const difficultyStyles = {
    Easy: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    Medium: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    Hard: "border-rose-400/30 bg-rose-400/10 text-rose-300"
};
function estimatedTimeLabel(minutes) {
    const hours = minutes / 60;
    if (hours >= 1) {
        const rounded = Math.round(hours * 10) / 10;
        return `~${rounded} hours`;
    }
    return `~${minutes} min`;
}
function BookCard({ book, selected, disabled = false, onSelect }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: onSelect,
        disabled: disabled,
        "aria-pressed": selected,
        "aria-label": `Select ${book.title} by ${book.author}`,
        className: [
            "group relative w-full overflow-hidden rounded-3xl border p-5 text-left transition duration-200 sm:p-6",
            "bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50",
            selected ? "border-sky-400/55 bg-[linear-gradient(180deg,rgba(14,116,144,0.22),rgba(8,47,73,0.22))] shadow-[0_0_0_1px_rgba(56,189,248,0.4),0_18px_45px_rgba(2,132,199,0.22)]" : "border-white/10 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_20px_45px_rgba(2,6,23,0.45)]",
            disabled && !selected ? "cursor-not-allowed opacity-45" : ""
        ].join(" "),
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$BookCover$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BookCover"], {
                bookId: book.id,
                title: book.title,
                icon: book.icon,
                coverImage: book.coverImage,
                className: "h-14 w-12 rounded-xl border border-white/15 bg-white/6",
                fallbackClassName: "text-3xl",
                sizes: "48px"
            }, void 0, false, {
                fileName: "[project]/app/book/components/BookCard.tsx",
                lineNumber: 52,
                columnNumber: 7
            }, this),
            selected ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "absolute right-4 top-4 text-sky-300",
                "aria-hidden": "true",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$circle$2d$check$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__CheckCircle2$3e$__["CheckCircle2"], {
                    className: "h-6 w-6"
                }, void 0, false, {
                    fileName: "[project]/app/book/components/BookCard.tsx",
                    lineNumber: 64,
                    columnNumber: 11
                }, this)
            }, void 0, false, {
                fileName: "[project]/app/book/components/BookCard.tsx",
                lineNumber: 63,
                columnNumber: 9
            }, this) : null,
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                className: "mt-6 text-2xl font-semibold tracking-tight text-slate-100",
                children: book.title
            }, void 0, false, {
                fileName: "[project]/app/book/components/BookCard.tsx",
                lineNumber: 68,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "mt-1 text-lg text-slate-300",
                children: book.author
            }, void 0, false, {
                fileName: "[project]/app/book/components/BookCard.tsx",
                lineNumber: 71,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-5 flex flex-wrap items-center gap-2.5 text-sm",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded-xl border border-white/35 bg-white/5 px-3 py-1 text-slate-200",
                        children: book.category
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/BookCard.tsx",
                        lineNumber: 74,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: [
                            "rounded-xl border px-3 py-1 font-medium",
                            difficultyStyles[book.difficulty]
                        ].join(" "),
                        children: book.difficulty
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/BookCard.tsx",
                        lineNumber: 77,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "inline-flex items-center gap-1.5 text-slate-400",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clock$2d$3$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clock3$3e$__["Clock3"], {
                                className: "h-3.5 w-3.5"
                            }, void 0, false, {
                                fileName: "[project]/app/book/components/BookCard.tsx",
                                lineNumber: 86,
                                columnNumber: 11
                            }, this),
                            estimatedTimeLabel(book.estimatedMinutes)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/book/components/BookCard.tsx",
                        lineNumber: 85,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/book/components/BookCard.tsx",
                lineNumber: 73,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/book/components/BookCard.tsx",
        lineNumber: 36,
        columnNumber: 5
    }, this);
}
_c = BookCard;
var _c;
__turbopack_context__.k.register(_c, "BookCard");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/book/components/GoalPicker.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GoalPicker",
    ()=>GoalPicker,
    "formatMinutesLabel",
    ()=>formatMinutesLabel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
"use client";
;
const quickPickOptions = [
    10,
    15,
    20,
    30,
    45,
    60,
    90,
    120,
    180,
    240
];
function clampGoal(goal) {
    return Math.min(240, Math.max(10, goal));
}
function formatMinutesLabel(minutes) {
    if (minutes < 60) return `${minutes} min`;
    if (minutes % 60 === 0) return `${minutes / 60}h`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
}
function GoalPicker({ value, onChange }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))] px-4 py-5 sm:px-6 sm:py-6",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-3 sm:grid-cols-5",
                children: quickPickOptions.map((option)=>{
                    const selected = option === value;
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>onChange(option),
                        className: [
                            "rounded-2xl border px-3 py-4 text-center transition duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50",
                            selected ? "border-amber-300/60 bg-amber-300/20 text-amber-100 shadow-[0_0_0_1px_rgba(251,191,36,0.3)]" : "border-white/25 bg-white/5 text-slate-200 hover:border-white/45"
                        ].join(" "),
                        "aria-pressed": selected,
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                            className: "block text-2xl font-semibold leading-none",
                            children: formatMinutesLabel(option)
                        }, void 0, false, {
                            fileName: "[project]/app/book/components/GoalPicker.tsx",
                            lineNumber: 42,
                            columnNumber: 15
                        }, this)
                    }, option, false, {
                        fileName: "[project]/app/book/components/GoalPicker.tsx",
                        lineNumber: 29,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/app/book/components/GoalPicker.tsx",
                lineNumber: 25,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "mt-6 space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center justify-between text-sm text-slate-300",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Custom goal"
                            }, void 0, false, {
                                fileName: "[project]/app/book/components/GoalPicker.tsx",
                                lineNumber: 52,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    formatMinutesLabel(value),
                                    " / day"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/components/GoalPicker.tsx",
                                lineNumber: 53,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/book/components/GoalPicker.tsx",
                        lineNumber: 51,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "range",
                        min: 10,
                        max: 240,
                        step: 5,
                        value: value,
                        onChange: (event)=>onChange(clampGoal(Number(event.target.value))),
                        className: "w-full accent-amber-400"
                    }, void 0, false, {
                        fileName: "[project]/app/book/components/GoalPicker.tsx",
                        lineNumber: 56,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "number",
                                min: 10,
                                max: 240,
                                step: 5,
                                value: value,
                                onChange: (event)=>onChange(clampGoal(Number(event.target.value || 0))),
                                className: "w-28 rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/45"
                            }, void 0, false, {
                                fileName: "[project]/app/book/components/GoalPicker.tsx",
                                lineNumber: 67,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "text-sm text-slate-400",
                                children: "minutes per day"
                            }, void 0, false, {
                                fileName: "[project]/app/book/components/GoalPicker.tsx",
                                lineNumber: 76,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/book/components/GoalPicker.tsx",
                        lineNumber: 66,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/book/components/GoalPicker.tsx",
                lineNumber: 50,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/book/components/GoalPicker.tsx",
        lineNumber: 24,
        columnNumber: 5
    }, this);
}
_c = GoalPicker;
var _c;
__turbopack_context__.k.register(_c, "GoalPicker");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/book/hooks/useOnboardingState.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useOnboardingState",
    ()=>useOnboardingState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$booksCatalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/data/booksCatalog.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
const MAX_STEPS = 5;
const MAX_BOOK_SELECTION = Math.max(1, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$booksCatalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BOOKS_CATALOG"].length);
const STORAGE_KEY = "book-accelerator:onboarding:v2";
const AVAILABLE_BOOK_IDS = new Set(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$booksCatalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BOOKS_CATALOG"].map((book)=>book.id));
const defaultState = {
    currentStep: 0,
    setupComplete: false,
    completedAt: null,
    name: "",
    pronoun: "Prefer not to say",
    selectedBookIds: [],
    dailyGoalMinutes: 20,
    reminderTime: "20:00",
    learningStyle: "balanced",
    quizIntensity: "standard",
    streakMode: true,
    motivationStyle: "gentle"
};
function clampStep(step) {
    return Math.min(Math.max(step, 0), MAX_STEPS - 1);
}
function clampGoal(goal) {
    return Math.min(Math.max(goal, 10), 240);
}
function parseStoredState(value) {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        return {
            ...defaultState,
            ...parsed,
            currentStep: clampStep(Number(parsed.currentStep ?? defaultState.currentStep)),
            dailyGoalMinutes: clampGoal(Number(parsed.dailyGoalMinutes ?? defaultState.dailyGoalMinutes)),
            selectedBookIds: Array.isArray(parsed.selectedBookIds) ? parsed.selectedBookIds.filter((bookId)=>typeof bookId === "string" && AVAILABLE_BOOK_IDS.has(bookId)).slice(0, MAX_BOOK_SELECTION) : []
        };
    } catch  {
        return null;
    }
}
function useOnboardingState() {
    _s();
    const [state, setState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(defaultState);
    const [hydrated, setHydrated] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(false);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOnboardingState.useEffect": ()=>{
            const stored = parseStoredState(window.localStorage.getItem(STORAGE_KEY));
            if (stored) setState(stored);
            setHydrated(true);
        }
    }["useOnboardingState.useEffect"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOnboardingState.useEffect": ()=>{
            if (!hydrated) return;
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
    }["useOnboardingState.useEffect"], [
        hydrated,
        state
    ]);
    const setCurrentStep = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[setCurrentStep]": (step)=>{
            setState({
                "useOnboardingState.useCallback[setCurrentStep]": (prev)=>({
                        ...prev,
                        currentStep: clampStep(step)
                    })
            }["useOnboardingState.useCallback[setCurrentStep]"]);
        }
    }["useOnboardingState.useCallback[setCurrentStep]"], []);
    const goNextStep = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[goNextStep]": ()=>{
            setState({
                "useOnboardingState.useCallback[goNextStep]": (prev)=>({
                        ...prev,
                        currentStep: clampStep(prev.currentStep + 1)
                    })
            }["useOnboardingState.useCallback[goNextStep]"]);
        }
    }["useOnboardingState.useCallback[goNextStep]"], []);
    const goPreviousStep = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[goPreviousStep]": ()=>{
            setState({
                "useOnboardingState.useCallback[goPreviousStep]": (prev)=>({
                        ...prev,
                        currentStep: clampStep(prev.currentStep - 1)
                    })
            }["useOnboardingState.useCallback[goPreviousStep]"]);
        }
    }["useOnboardingState.useCallback[goPreviousStep]"], []);
    const setName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[setName]": (name)=>{
            setState({
                "useOnboardingState.useCallback[setName]": (prev)=>({
                        ...prev,
                        name
                    })
            }["useOnboardingState.useCallback[setName]"]);
        }
    }["useOnboardingState.useCallback[setName]"], []);
    const setPronoun = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[setPronoun]": (pronoun)=>{
            setState({
                "useOnboardingState.useCallback[setPronoun]": (prev)=>({
                        ...prev,
                        pronoun
                    })
            }["useOnboardingState.useCallback[setPronoun]"]);
        }
    }["useOnboardingState.useCallback[setPronoun]"], []);
    const toggleBookSelection = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[toggleBookSelection]": (bookId)=>{
            setState({
                "useOnboardingState.useCallback[toggleBookSelection]": (prev)=>{
                    const selected = prev.selectedBookIds;
                    if (selected.includes(bookId)) {
                        return {
                            ...prev,
                            selectedBookIds: selected.filter({
                                "useOnboardingState.useCallback[toggleBookSelection]": (id)=>id !== bookId
                            }["useOnboardingState.useCallback[toggleBookSelection]"])
                        };
                    }
                    if (selected.length >= MAX_BOOK_SELECTION) {
                        return prev;
                    }
                    return {
                        ...prev,
                        selectedBookIds: [
                            ...selected,
                            bookId
                        ]
                    };
                }
            }["useOnboardingState.useCallback[toggleBookSelection]"]);
        }
    }["useOnboardingState.useCallback[toggleBookSelection]"], []);
    const setDailyGoalMinutes = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[setDailyGoalMinutes]": (minutes)=>{
            setState({
                "useOnboardingState.useCallback[setDailyGoalMinutes]": (prev)=>({
                        ...prev,
                        dailyGoalMinutes: clampGoal(minutes)
                    })
            }["useOnboardingState.useCallback[setDailyGoalMinutes]"]);
        }
    }["useOnboardingState.useCallback[setDailyGoalMinutes]"], []);
    const setReminderTime = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[setReminderTime]": (time)=>{
            setState({
                "useOnboardingState.useCallback[setReminderTime]": (prev)=>({
                        ...prev,
                        reminderTime: time
                    })
            }["useOnboardingState.useCallback[setReminderTime]"]);
        }
    }["useOnboardingState.useCallback[setReminderTime]"], []);
    const setLearningStyle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[setLearningStyle]": (learningStyle)=>{
            setState({
                "useOnboardingState.useCallback[setLearningStyle]": (prev)=>({
                        ...prev,
                        learningStyle
                    })
            }["useOnboardingState.useCallback[setLearningStyle]"]);
        }
    }["useOnboardingState.useCallback[setLearningStyle]"], []);
    const setQuizIntensity = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[setQuizIntensity]": (quizIntensity)=>{
            setState({
                "useOnboardingState.useCallback[setQuizIntensity]": (prev)=>({
                        ...prev,
                        quizIntensity
                    })
            }["useOnboardingState.useCallback[setQuizIntensity]"]);
        }
    }["useOnboardingState.useCallback[setQuizIntensity]"], []);
    const setStreakMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[setStreakMode]": (streakMode)=>{
            setState({
                "useOnboardingState.useCallback[setStreakMode]": (prev)=>({
                        ...prev,
                        streakMode
                    })
            }["useOnboardingState.useCallback[setStreakMode]"]);
        }
    }["useOnboardingState.useCallback[setStreakMode]"], []);
    const setMotivationStyle = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[setMotivationStyle]": (motivationStyle)=>{
            setState({
                "useOnboardingState.useCallback[setMotivationStyle]": (prev)=>({
                        ...prev,
                        motivationStyle
                    })
            }["useOnboardingState.useCallback[setMotivationStyle]"]);
        }
    }["useOnboardingState.useCallback[setMotivationStyle]"], []);
    const completeSetup = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[completeSetup]": ()=>{
            setState({
                "useOnboardingState.useCallback[completeSetup]": (prev)=>({
                        ...prev,
                        setupComplete: true,
                        completedAt: new Date().toISOString()
                    })
            }["useOnboardingState.useCallback[completeSetup]"]);
        }
    }["useOnboardingState.useCallback[completeSetup]"], []);
    const resetSetup = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOnboardingState.useCallback[resetSetup]": ()=>{
            setState(defaultState);
            window.localStorage.removeItem(STORAGE_KEY);
        }
    }["useOnboardingState.useCallback[resetSetup]"], []);
    const selectionsRemaining = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "useOnboardingState.useMemo[selectionsRemaining]": ()=>Math.max(0, MAX_BOOK_SELECTION - state.selectedBookIds.length)
    }["useOnboardingState.useMemo[selectionsRemaining]"], [
        state.selectedBookIds.length
    ]);
    return {
        state,
        hydrated,
        selectionsRemaining,
        setCurrentStep,
        goNextStep,
        goPreviousStep,
        setName,
        setPronoun,
        toggleBookSelection,
        setDailyGoalMinutes,
        setReminderTime,
        setLearningStyle,
        setQuizIntensity,
        setStreakMode,
        setMotivationStyle,
        completeSetup,
        resetSetup
    };
}
_s(useOnboardingState, "lgq+hDvVYaE4B5QBPaozjm7xV5g=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/book/BookOnboardingClient.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "BookOnboardingClient",
    ()=>BookOnboardingClient
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/components/AnimatePresence/index.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/framer-motion/dist/es/render/components/motion/proxy.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-left.js [app-client] (ecmascript) <export default as ArrowLeft>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/arrow-right.js [app-client] (ecmascript) <export default as ArrowRight>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$badge$2d$question$2d$mark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BadgeHelp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/badge-question-mark.js [app-client] (ecmascript) <export default as BadgeHelp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/book-open.js [app-client] (ecmascript) <export default as BookOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.js [app-client] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lightbulb$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lightbulb$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/lightbulb.js [app-client] (ecmascript) <export default as Lightbulb>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/sparkles.js [app-client] (ecmascript) <export default as Sparkles>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trophy.js [app-client] (ecmascript) <export default as Trophy>");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$OnboardingShell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/components/OnboardingShell.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$BookCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/components/BookCard.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$GoalPicker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/components/GoalPicker.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$booksCatalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/data/booksCatalog.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$hooks$2f$useOnboardingState$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/app/book/hooks/useOnboardingState.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
const TOTAL_STEPS = 5;
const MAX_BOOKS = 1;
const pronounOptions = [
    "Prefer not to say",
    "She / Her",
    "He / Him",
    "They / Them"
];
const learningStyleOptions = [
    {
        value: "concise",
        label: "Concise"
    },
    {
        value: "balanced",
        label: "Balanced"
    },
    {
        value: "deep",
        label: "Deep"
    }
];
const quizIntensityOptions = [
    {
        value: "easy",
        label: "Easy"
    },
    {
        value: "standard",
        label: "Standard"
    },
    {
        value: "challenging",
        label: "Challenging"
    }
];
const motivationStyleOptions = [
    {
        value: "gentle",
        label: "Gentle"
    },
    {
        value: "direct",
        label: "Direct"
    },
    {
        value: "competitive",
        label: "Competitive"
    }
];
const stepContent = [
    {
        title: "ChapterFlow",
        subtitle: "Read with more clarity, more momentum, and more retention through guided chapter sessions built for depth."
    },
    {
        title: "Let's personalize this",
        subtitle: "Tell us your name so we can tailor your first reading path."
    },
    {
        title: "Pick your first book",
        subtitle: "Choose your starting book. You can add more titles later as the library grows."
    },
    {
        title: "Set your daily goal",
        subtitle: "We'll help you stay consistent. You can adjust this later."
    },
    {
        title: "One last personalization step",
        subtitle: "Optional preferences help us tune reminders, summaries, and quiz style to fit you."
    }
];
function estimateSessions(goalMinutes) {
    return Math.max(1, Math.ceil(300 / Math.max(goalMinutes, 10)));
}
function SegmentedOption({ label, value, selected, onSelect }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        type: "button",
        onClick: ()=>onSelect(value),
        "aria-pressed": selected,
        className: [
            "rounded-xl border px-3 py-2 text-sm transition duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50",
            selected ? "border-sky-300/55 bg-sky-400/20 text-sky-100" : "border-white/20 bg-white/5 text-slate-200 hover:border-white/35"
        ].join(" "),
        children: label
    }, void 0, false, {
        fileName: "[project]/app/book/BookOnboardingClient.tsx",
        lineNumber: 106,
        columnNumber: 5
    }, this);
}
_c = SegmentedOption;
function HowItWorksRow({ icon, title, description }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
        className: "flex items-start gap-3 rounded-2xl border border-white/10 bg-white/3 p-3.5",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300/25 bg-sky-500/15 text-sky-200",
                children: icon
            }, void 0, false, {
                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                lineNumber: 134,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "min-w-0",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-lg font-semibold text-slate-100",
                        children: title
                    }, void 0, false, {
                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                        lineNumber: 138,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "mt-1 text-sm text-slate-300",
                        children: description
                    }, void 0, false, {
                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                        lineNumber: 139,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                lineNumber: 137,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/book/BookOnboardingClient.tsx",
        lineNumber: 133,
        columnNumber: 5
    }, this);
}
_c1 = HowItWorksRow;
function BookOnboardingClient() {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { state, hydrated, goNextStep, goPreviousStep, setName, setPronoun, toggleBookSelection, setDailyGoalMinutes, setReminderTime, setLearningStyle, setQuizIntensity, setStreakMode, setMotivationStyle, completeSetup } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$hooks$2f$useOnboardingState$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useOnboardingState"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "BookOnboardingClient.useEffect": ()=>{
            if (!hydrated) return;
            if (state.setupComplete) {
                router.replace("/book/workspace");
            }
        }
    }["BookOnboardingClient.useEffect"], [
        hydrated,
        router,
        state.setupComplete
    ]);
    const step = state.currentStep;
    const selectedCount = state.selectedBookIds.length;
    const selectedBooksSet = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMemo"])({
        "BookOnboardingClient.useMemo[selectedBooksSet]": ()=>new Set(state.selectedBookIds)
    }["BookOnboardingClient.useMemo[selectedBooksSet]"], [
        state.selectedBookIds
    ]);
    const limitReached = selectedCount >= MAX_BOOKS;
    const canContinue = (()=>{
        if (step === 1) return state.name.trim().length > 0;
        if (step === 2) return selectedCount === MAX_BOOKS;
        return true;
    })();
    const handleContinue = ()=>{
        if (!canContinue) return;
        if (step === TOTAL_STEPS - 1) {
            completeSetup();
            router.push("/book/workspace");
            return;
        }
        goNextStep();
    };
    const subtitle = stepContent[step]?.subtitle ?? "";
    const title = stepContent[step]?.title ?? "";
    const actions = step === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "mx-auto flex max-w-sm justify-center",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
            type: "button",
            onClick: handleContinue,
            className: "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-sky-500 to-cyan-400 px-5 py-3.5 text-lg font-semibold text-white shadow-[0_10px_30px_rgba(14,165,233,0.38)] transition hover:brightness-105 active:translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/55",
            children: [
                "Get Started",
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__["ArrowRight"], {
                    className: "h-5 w-5"
                }, void 0, false, {
                    fileName: "[project]/app/book/BookOnboardingClient.tsx",
                    lineNumber: 207,
                    columnNumber: 11
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/app/book/BookOnboardingClient.tsx",
            lineNumber: 201,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/book/BookOnboardingClient.tsx",
        lineNumber: 200,
        columnNumber: 7
    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "flex flex-col gap-3 sm:flex-row",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: goPreviousStep,
                className: "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/35 bg-white/5 px-4 py-3 text-lg font-semibold text-slate-200 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:w-40",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$left$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowLeft$3e$__["ArrowLeft"], {
                        className: "h-5 w-5"
                    }, void 0, false, {
                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                        lineNumber: 217,
                        columnNumber: 11
                    }, this),
                    "Back"
                ]
            }, void 0, true, {
                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                lineNumber: 212,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: handleContinue,
                disabled: !canContinue,
                className: [
                    "inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-lg font-semibold transition focus-visible:outline-none focus-visible:ring-2",
                    step === TOTAL_STEPS - 1 ? "bg-linear-to-r from-amber-400 to-yellow-300 text-slate-900 shadow-[0_12px_28px_rgba(250,204,21,0.38)] focus-visible:ring-amber-300/60" : "bg-linear-to-r from-sky-500 to-cyan-400 text-white shadow-[0_12px_28px_rgba(14,165,233,0.35)] focus-visible:ring-sky-300/60",
                    canContinue ? "hover:brightness-105 active:translate-y-0.5" : "cursor-not-allowed opacity-45"
                ].join(" "),
                children: [
                    step === TOTAL_STEPS - 1 ? "Finish Setup" : "Continue",
                    step === TOTAL_STEPS - 1 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$sparkles$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Sparkles$3e$__["Sparkles"], {
                        className: "h-5 w-5"
                    }, void 0, false, {
                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                        lineNumber: 236,
                        columnNumber: 13
                    }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$arrow$2d$right$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ArrowRight$3e$__["ArrowRight"], {
                        className: "h-5 w-5"
                    }, void 0, false, {
                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                        lineNumber: 238,
                        columnNumber: 13
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                lineNumber: 220,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/book/BookOnboardingClient.tsx",
        lineNumber: 211,
        columnNumber: 7
    }, this);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$OnboardingShell$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OnboardingShell"], {
        step: step,
        totalSteps: TOTAL_STEPS,
        title: title,
        subtitle: subtitle,
        actions: actions,
        children: !hydrated ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "rounded-3xl border border-white/10 bg-white/3 p-8 text-center text-slate-300",
            children: "Loading your onboarding setup..."
        }, void 0, false, {
            fileName: "[project]/app/book/BookOnboardingClient.tsx",
            lineNumber: 253,
            columnNumber: 9
        }, this) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$components$2f$AnimatePresence$2f$index$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["AnimatePresence"], {
            mode: "wait",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$framer$2d$motion$2f$dist$2f$es$2f$render$2f$components$2f$motion$2f$proxy$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["motion"].div, {
                initial: {
                    opacity: 0,
                    y: 12
                },
                animate: {
                    opacity: 1,
                    y: 0
                },
                exit: {
                    opacity: 0,
                    y: -10
                },
                transition: {
                    duration: 0.2,
                    ease: "easeOut"
                },
                children: [
                    step === 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mx-auto max-w-4xl space-y-5",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mx-auto inline-flex h-24 w-24 items-center justify-center rounded-[28px] border border-sky-300/35 bg-linear-to-b from-sky-400/30 to-cyan-500/25 text-sky-100 shadow-[0_0_35px_rgba(56,189,248,0.28)]",
                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__["BookOpen"], {
                                    className: "h-10 w-10"
                                }, void 0, false, {
                                    fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                    lineNumber: 268,
                                    columnNumber: 19
                                }, this)
                            }, void 0, false, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 267,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.04))] p-5 sm:p-7",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-center text-xs font-semibold uppercase tracking-[0.26em] text-slate-400",
                                        children: "How it works"
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 272,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                        className: "mt-4 space-y-3",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(HowItWorksRow, {
                                                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"], {
                                                    className: "h-5 w-5"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                    lineNumber: 277,
                                                    columnNumber: 29
                                                }, void 0),
                                                title: "Read a chapter summary",
                                                description: "5–10 focused bullet points. Adjust depth to your preference."
                                            }, void 0, false, {
                                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                lineNumber: 276,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(HowItWorksRow, {
                                                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$lightbulb$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Lightbulb$3e$__["Lightbulb"], {
                                                    className: "h-5 w-5"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                    lineNumber: 282,
                                                    columnNumber: 29
                                                }, void 0),
                                                title: "See real-world examples",
                                                description: "2–4 practical scenarios that connect ideas to daily decisions."
                                            }, void 0, false, {
                                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                lineNumber: 281,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(HowItWorksRow, {
                                                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$badge$2d$question$2d$mark$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BadgeHelp$3e$__["BadgeHelp"], {
                                                    className: "h-5 w-5"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                    lineNumber: 287,
                                                    columnNumber: 29
                                                }, void 0),
                                                title: "Pass the quiz to unlock the next chapter",
                                                description: "80% score required. Missed it? Review and retry."
                                            }, void 0, false, {
                                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                lineNumber: 286,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(HowItWorksRow, {
                                                icon: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trophy$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Trophy$3e$__["Trophy"], {
                                                    className: "h-5 w-5"
                                                }, void 0, false, {
                                                    fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                    lineNumber: 292,
                                                    columnNumber: 29
                                                }, void 0),
                                                title: "Finish the book and earn a badge",
                                                description: "Build momentum with a reading streak that actually sticks."
                                            }, void 0, false, {
                                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                lineNumber: 291,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 275,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 271,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                        lineNumber: 266,
                        columnNumber: 15
                    }, this) : null,
                    step === 1 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mx-auto max-w-3xl space-y-4 rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 sm:p-7",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                className: "block",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "mb-2 block text-sm font-medium text-slate-300",
                                        children: "What should we call you?"
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 304,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "text",
                                        autoFocus: true,
                                        value: state.name,
                                        onChange: (event)=>setName(event.target.value),
                                        placeholder: "Enter your name",
                                        className: "w-full rounded-2xl border border-white/20 bg-white/6 px-4 py-3 text-lg text-slate-100 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 307,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 303,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mb-2 text-sm font-medium text-slate-300",
                                        children: "Preferred pronoun (optional)"
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 318,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap gap-2",
                                        children: pronounOptions.map((pronoun)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SegmentedOption, {
                                                label: pronoun,
                                                value: pronoun,
                                                selected: state.pronoun === pronoun,
                                                onSelect: setPronoun
                                            }, pronoun, false, {
                                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                lineNumber: 323,
                                                columnNumber: 23
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 321,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 317,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "rounded-2xl border border-sky-300/25 bg-sky-500/10 px-4 py-3 text-sky-100",
                                children: [
                                    "Nice to meet you,",
                                    " ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold",
                                        children: state.name.trim() || "there"
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 336,
                                        columnNumber: 19
                                    }, this),
                                    ". Let's set up your first book."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 334,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                        lineNumber: 302,
                        columnNumber: 15
                    }, this) : null,
                    step === 2 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-slate-300",
                                        children: [
                                            selectedCount,
                                            "/",
                                            MAX_BOOKS,
                                            " selected"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 347,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm text-slate-400",
                                        children: "Start with this book and unlock the rest of the experience chapter by chapter."
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 350,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 346,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "grid grid-cols-1 gap-4 md:grid-cols-2",
                                children: __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$data$2f$booksCatalog$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BOOKS_CATALOG"].map((book)=>{
                                    const selected = selectedBooksSet.has(book.id);
                                    const disabled = !selected && limitReached;
                                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$BookCard$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["BookCard"], {
                                        book: book,
                                        selected: selected,
                                        disabled: disabled,
                                        onSelect: ()=>toggleBookSelection(book.id)
                                    }, book.id, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 360,
                                        columnNumber: 23
                                    }, this);
                                })
                            }, void 0, false, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 355,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                        lineNumber: 345,
                        columnNumber: 15
                    }, this) : null,
                    step === 3 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mx-auto max-w-4xl space-y-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$GoalPicker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GoalPicker"], {
                                value: state.dailyGoalMinutes,
                                onChange: setDailyGoalMinutes
                            }, void 0, false, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 375,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "text-center text-lg text-slate-300",
                                children: [
                                    "At",
                                    " ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold text-amber-200",
                                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$components$2f$GoalPicker$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["formatMinutesLabel"])(state.dailyGoalMinutes)
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 378,
                                        columnNumber: 19
                                    }, this),
                                    " ",
                                    "per day, you'll finish a typical book in about",
                                    " ",
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "font-semibold text-slate-100",
                                        children: [
                                            estimateSessions(state.dailyGoalMinutes),
                                            " sessions"
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 382,
                                        columnNumber: 19
                                    }, this),
                                    "."
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 376,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                        lineNumber: 374,
                        columnNumber: 15
                    }, this) : null,
                    step === 4 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mx-auto max-w-4xl space-y-4 rounded-[30px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] p-5 sm:p-7",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                        className: "mb-2 block text-sm font-medium text-slate-300",
                                        children: "When should we remind you?"
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 393,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                        type: "time",
                                        value: state.reminderTime,
                                        onChange: (event)=>setReminderTime(event.target.value),
                                        className: "w-44 rounded-xl border border-white/20 bg-white/6 px-3 py-2 text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/50"
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 396,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 392,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mb-2 text-sm font-medium text-slate-300",
                                        children: "Summaries style"
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 405,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap gap-2",
                                        children: learningStyleOptions.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SegmentedOption, {
                                                label: option.label,
                                                value: option.value,
                                                selected: state.learningStyle === option.value,
                                                onSelect: setLearningStyle
                                            }, option.value, false, {
                                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                lineNumber: 410,
                                                columnNumber: 23
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 408,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 404,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mb-2 text-sm font-medium text-slate-300",
                                        children: "Quiz difficulty"
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 422,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap gap-2",
                                        children: quizIntensityOptions.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SegmentedOption, {
                                                label: option.label,
                                                value: option.value,
                                                selected: state.quizIntensity === option.value,
                                                onSelect: setQuizIntensity
                                            }, option.value, false, {
                                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                lineNumber: 427,
                                                columnNumber: 23
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 425,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 421,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between rounded-2xl border border-white/10 bg-white/3 px-4 py-3",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm font-medium text-slate-200",
                                                children: "Track streaks"
                                            }, void 0, false, {
                                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                lineNumber: 440,
                                                columnNumber: 21
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-sm text-slate-400",
                                                children: "Keep a visible streak for consistent daily progress."
                                            }, void 0, false, {
                                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                lineNumber: 441,
                                                columnNumber: 21
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 439,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                        type: "button",
                                        onClick: ()=>setStreakMode(!state.streakMode),
                                        "aria-pressed": state.streakMode,
                                        className: [
                                            "relative inline-flex h-7 w-12 items-center rounded-full transition",
                                            state.streakMode ? "bg-sky-500" : "bg-white/25"
                                        ].join(" "),
                                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                            className: [
                                                "inline-block h-5 w-5 transform rounded-full bg-white transition",
                                                state.streakMode ? "translate-x-6" : "translate-x-1"
                                            ].join(" ")
                                        }, void 0, false, {
                                            fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                            lineNumber: 454,
                                            columnNumber: 21
                                        }, this)
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 445,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 438,
                                columnNumber: 17
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "mb-2 text-sm font-medium text-slate-300",
                                        children: "Motivation style"
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 464,
                                        columnNumber: 19
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "flex flex-wrap gap-2",
                                        children: motivationStyleOptions.map((option)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(SegmentedOption, {
                                                label: option.label,
                                                value: option.value,
                                                selected: state.motivationStyle === option.value,
                                                onSelect: setMotivationStyle
                                            }, option.value, false, {
                                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                                lineNumber: 467,
                                                columnNumber: 23
                                            }, this))
                                    }, void 0, false, {
                                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                        lineNumber: 465,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                                lineNumber: 463,
                                columnNumber: 17
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/book/BookOnboardingClient.tsx",
                        lineNumber: 391,
                        columnNumber: 15
                    }, this) : null
                ]
            }, step, true, {
                fileName: "[project]/app/book/BookOnboardingClient.tsx",
                lineNumber: 258,
                columnNumber: 11
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/book/BookOnboardingClient.tsx",
            lineNumber: 257,
            columnNumber: 9
        }, this)
    }, void 0, false, {
        fileName: "[project]/app/book/BookOnboardingClient.tsx",
        lineNumber: 245,
        columnNumber: 5
    }, this);
}
_s(BookOnboardingClient, "xaJq7X4C1xxvZXIWb8IVOX+JIoM=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$app$2f$book$2f$hooks$2f$useOnboardingState$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useOnboardingState"]
    ];
});
_c2 = BookOnboardingClient;
var _c, _c1, _c2;
__turbopack_context__.k.register(_c, "SegmentedOption");
__turbopack_context__.k.register(_c1, "HowItWorksRow");
__turbopack_context__.k.register(_c2, "BookOnboardingClient");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=app_15c3539f._.js.map