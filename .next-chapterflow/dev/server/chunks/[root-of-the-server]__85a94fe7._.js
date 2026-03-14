module.exports = [
"[externals]/fs/promises [external] (fs/promises, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("fs/promises", () => require("fs/promises"));

module.exports = mod;
}),
"[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
;
;
;
}),
"[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getSsoSessionData.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSsoSessionData",
    ()=>getSsoSessionData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$types$2f$dist$2d$es$2f$profile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/types/dist-es/profile.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/constants.js [app-route] (ecmascript)");
;
;
const getSsoSessionData = (data)=>Object.entries(data).filter(([key])=>key.startsWith(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$types$2f$dist$2d$es$2f$profile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["IniSectionType"].SSO_SESSION + __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CONFIG_PREFIX_SEPARATOR"])).reduce((acc, [key, value])=>({
            ...acc,
            [key.substring(key.indexOf(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CONFIG_PREFIX_SEPARATOR"]) + 1)]: value
        }), {});
}),
"[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/loadSsoSessionData.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "loadSsoSessionData",
    ()=>loadSsoSessionData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getConfigFilepath$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getConfigFilepath.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSsoSessionData$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getSsoSessionData.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseIni$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/parseIni.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$readFile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/readFile.js [app-route] (ecmascript)");
;
;
;
;
const swallowError = ()=>({});
const loadSsoSessionData = async (init = {})=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$readFile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readFile"])(init.configFilepath ?? (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getConfigFilepath$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getConfigFilepath"])()).then(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseIni$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseIni"]).then(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSsoSessionData$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSsoSessionData"]).catch(swallowError);
}),
"[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/mergeConfigFiles.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "mergeConfigFiles",
    ()=>mergeConfigFiles
]);
const mergeConfigFiles = (...files)=>{
    const merged = {};
    for (const file of files){
        for (const [key, values] of Object.entries(file)){
            if (merged[key] !== undefined) {
                Object.assign(merged[key], values);
            } else {
                merged[key] = values;
            }
        }
    }
    return merged;
};
}),
"[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/parseKnownFiles.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "parseKnownFiles",
    ()=>parseKnownFiles
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$loadSharedConfigFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/loadSharedConfigFiles.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$mergeConfigFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/mergeConfigFiles.js [app-route] (ecmascript)");
;
;
const parseKnownFiles = async (init)=>{
    const parsedFiles = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$loadSharedConfigFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__["loadSharedConfigFiles"])(init);
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$mergeConfigFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["mergeConfigFiles"])(parsedFiles.configFile, parsedFiles.credentialsFile);
};
}),
"[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/isSsoProfile.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isSsoProfile",
    ()=>isSsoProfile
]);
const isSsoProfile = (arg)=>arg && (typeof arg.sso_start_url === "string" || typeof arg.sso_account_id === "string" || typeof arg.sso_session === "string" || typeof arg.sso_region === "string" || typeof arg.sso_role_name === "string");
}),
"[project]/node_modules/@smithy/property-provider/dist-es/TokenProviderError.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TokenProviderError",
    ()=>TokenProviderError
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$ProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/ProviderError.js [app-route] (ecmascript)");
;
class TokenProviderError extends __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$ProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["ProviderError"] {
    name = "TokenProviderError";
    constructor(message, options = true){
        super(message, options);
        Object.setPrototypeOf(this, TokenProviderError.prototype);
    }
}
}),
"[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getSSOTokenFilepath.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSSOTokenFilepath",
    ()=>getSSOTokenFilepath
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/crypto [external] (crypto, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/path [external] (path, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getHomeDir$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getHomeDir.js [app-route] (ecmascript)");
;
;
;
const getSSOTokenFilepath = (id)=>{
    const hasher = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$crypto__$5b$external$5d$__$28$crypto$2c$__cjs$29$__["createHash"])("sha1");
    const cacheName = hasher.update(id).digest("hex");
    return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$path__$5b$external$5d$__$28$path$2c$__cjs$29$__["join"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getHomeDir$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getHomeDir"])(), ".aws", "sso", "cache", `${cacheName}.json`);
};
}),
"[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getSSOTokenFromFile.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSSOTokenFromFile",
    ()=>getSSOTokenFromFile,
    "tokenIntercept",
    ()=>tokenIntercept
]);
var __TURBOPACK__imported__module__$5b$externals$5d2f$fs$2f$promises__$5b$external$5d$__$28$fs$2f$promises$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/fs/promises [external] (fs/promises, cjs)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFilepath$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getSSOTokenFilepath.js [app-route] (ecmascript)");
;
;
const tokenIntercept = {};
const getSSOTokenFromFile = async (id)=>{
    if (tokenIntercept[id]) {
        return tokenIntercept[id];
    }
    const ssoTokenFilepath = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFilepath$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSSOTokenFilepath"])(id);
    const ssoTokenText = await (0, __TURBOPACK__imported__module__$5b$externals$5d2f$fs$2f$promises__$5b$external$5d$__$28$fs$2f$promises$2c$__cjs$29$__["readFile"])(ssoTokenFilepath, "utf8");
    return JSON.parse(ssoTokenText);
};
}),
"[project]/node_modules/@aws-sdk/token-providers/dist-es/constants.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "EXPIRE_WINDOW_MS",
    ()=>EXPIRE_WINDOW_MS,
    "REFRESH_MESSAGE",
    ()=>REFRESH_MESSAGE
]);
const EXPIRE_WINDOW_MS = 5 * 60 * 1000;
const REFRESH_MESSAGE = `To refresh this SSO session run 'aws sso login' with the corresponding profile.`;
}),
"[project]/node_modules/@aws-sdk/token-providers/dist-es/getSsoOidcClient.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSsoOidcClient",
    ()=>getSsoOidcClient
]);
const getSsoOidcClient = async (ssoRegion, init = {}, callerClientConfig)=>{
    const { SSOOIDCClient } = await __turbopack_context__.A("[project]/node_modules/@aws-sdk/nested-clients/dist-es/submodules/sso-oidc/index.js [app-route] (ecmascript, async loader)");
    const coalesce = (prop)=>init.clientConfig?.[prop] ?? init.parentClientConfig?.[prop] ?? callerClientConfig?.[prop];
    const ssoOidcClient = new SSOOIDCClient(Object.assign({}, init.clientConfig ?? {}, {
        region: ssoRegion ?? init.clientConfig?.region,
        logger: coalesce("logger"),
        userAgentAppId: coalesce("userAgentAppId")
    }));
    return ssoOidcClient;
};
}),
"[project]/node_modules/@aws-sdk/token-providers/dist-es/getNewSsoOidcToken.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getNewSsoOidcToken",
    ()=>getNewSsoOidcToken
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$getSsoOidcClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/token-providers/dist-es/getSsoOidcClient.js [app-route] (ecmascript)");
;
const getNewSsoOidcToken = async (ssoToken, ssoRegion, init = {}, callerClientConfig)=>{
    const { CreateTokenCommand } = await __turbopack_context__.A("[project]/node_modules/@aws-sdk/nested-clients/dist-es/submodules/sso-oidc/index.js [app-route] (ecmascript, async loader)");
    const ssoOidcClient = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$getSsoOidcClient$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSsoOidcClient"])(ssoRegion, init, callerClientConfig);
    return ssoOidcClient.send(new CreateTokenCommand({
        clientId: ssoToken.clientId,
        clientSecret: ssoToken.clientSecret,
        refreshToken: ssoToken.refreshToken,
        grantType: "refresh_token"
    }));
};
}),
"[project]/node_modules/@aws-sdk/token-providers/dist-es/validateTokenExpiry.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "validateTokenExpiry",
    ()=>validateTokenExpiry
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/TokenProviderError.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/token-providers/dist-es/constants.js [app-route] (ecmascript)");
;
;
const validateTokenExpiry = (token)=>{
    if (token.expiration && token.expiration.getTime() < Date.now()) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TokenProviderError"](`Token is expired. ${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REFRESH_MESSAGE"]}`, false);
    }
};
}),
"[project]/node_modules/@aws-sdk/token-providers/dist-es/validateTokenKey.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "validateTokenKey",
    ()=>validateTokenKey
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/TokenProviderError.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/token-providers/dist-es/constants.js [app-route] (ecmascript)");
;
;
const validateTokenKey = (key, value, forRefresh = false)=>{
    if (typeof value === "undefined") {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TokenProviderError"](`Value not present for '${key}' in SSO Token${forRefresh ? ". Cannot refresh" : ""}. ${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REFRESH_MESSAGE"]}`, false);
    }
};
}),
"[project]/node_modules/@aws-sdk/token-providers/dist-es/writeSSOTokenToFile.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "writeSSOTokenToFile",
    ()=>writeSSOTokenToFile
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFilepath$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getSSOTokenFilepath.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
;
;
const { writeFile } = __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"];
const writeSSOTokenToFile = (id, ssoToken)=>{
    const tokenFilepath = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFilepath$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSSOTokenFilepath"])(id);
    const tokenString = JSON.stringify(ssoToken, null, 2);
    return writeFile(tokenFilepath, tokenString);
};
}),
"[project]/node_modules/@aws-sdk/token-providers/dist-es/fromSso.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromSso",
    ()=>fromSso
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/TokenProviderError.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getProfileName.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFromFile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getSSOTokenFromFile.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$loadSsoSessionData$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/loadSsoSessionData.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/parseKnownFiles.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/token-providers/dist-es/constants.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$getNewSsoOidcToken$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/token-providers/dist-es/getNewSsoOidcToken.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenExpiry$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/token-providers/dist-es/validateTokenExpiry.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/token-providers/dist-es/validateTokenKey.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$writeSSOTokenToFile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/token-providers/dist-es/writeSSOTokenToFile.js [app-route] (ecmascript)");
;
;
;
;
;
;
;
const lastRefreshAttemptTime = new Date(0);
const fromSso = (init = {})=>async ({ callerClientConfig } = {})=>{
        init.logger?.debug("@aws-sdk/token-providers - fromSso");
        const profiles = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseKnownFiles"])(init);
        const profileName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getProfileName"])({
            profile: init.profile ?? callerClientConfig?.profile
        });
        const profile = profiles[profileName];
        if (!profile) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TokenProviderError"](`Profile '${profileName}' could not be found in shared credentials file.`, false);
        } else if (!profile["sso_session"]) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TokenProviderError"](`Profile '${profileName}' is missing required property 'sso_session'.`);
        }
        const ssoSessionName = profile["sso_session"];
        const ssoSessions = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$loadSsoSessionData$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadSsoSessionData"])(init);
        const ssoSession = ssoSessions[ssoSessionName];
        if (!ssoSession) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TokenProviderError"](`Sso session '${ssoSessionName}' could not be found in shared credentials file.`, false);
        }
        for (const ssoSessionRequiredKey of [
            "sso_start_url",
            "sso_region"
        ]){
            if (!ssoSession[ssoSessionRequiredKey]) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TokenProviderError"](`Sso session '${ssoSessionName}' is missing required property '${ssoSessionRequiredKey}'.`, false);
            }
        }
        const ssoStartUrl = ssoSession["sso_start_url"];
        const ssoRegion = ssoSession["sso_region"];
        let ssoToken;
        try {
            ssoToken = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFromFile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSSOTokenFromFile"])(ssoSessionName);
        } catch (e) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$TokenProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["TokenProviderError"](`The SSO session token associated with profile=${profileName} was not found or is invalid. ${__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["REFRESH_MESSAGE"]}`, false);
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateTokenKey"])("accessToken", ssoToken.accessToken);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateTokenKey"])("expiresAt", ssoToken.expiresAt);
        const { accessToken, expiresAt } = ssoToken;
        const existingToken = {
            token: accessToken,
            expiration: new Date(expiresAt)
        };
        if (existingToken.expiration.getTime() - Date.now() > __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$constants$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["EXPIRE_WINDOW_MS"]) {
            return existingToken;
        }
        if (Date.now() - lastRefreshAttemptTime.getTime() < 30 * 1000) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenExpiry$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateTokenExpiry"])(existingToken);
            return existingToken;
        }
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateTokenKey"])("clientId", ssoToken.clientId, true);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateTokenKey"])("clientSecret", ssoToken.clientSecret, true);
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateTokenKey"])("refreshToken", ssoToken.refreshToken, true);
        try {
            lastRefreshAttemptTime.setTime(Date.now());
            const newSsoOidcToken = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$getNewSsoOidcToken$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getNewSsoOidcToken"])(ssoToken, ssoRegion, init, callerClientConfig);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateTokenKey"])("accessToken", newSsoOidcToken.accessToken);
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenKey$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateTokenKey"])("expiresIn", newSsoOidcToken.expiresIn);
            const newTokenExpiration = new Date(Date.now() + newSsoOidcToken.expiresIn * 1000);
            try {
                await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$writeSSOTokenToFile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["writeSSOTokenToFile"])(ssoSessionName, {
                    ...ssoToken,
                    accessToken: newSsoOidcToken.accessToken,
                    expiresAt: newTokenExpiration.toISOString(),
                    refreshToken: newSsoOidcToken.refreshToken
                });
            } catch (error) {}
            return {
                token: newSsoOidcToken.accessToken,
                expiration: newTokenExpiration
            };
        } catch (error) {
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$validateTokenExpiry$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateTokenExpiry"])(existingToken);
            return existingToken;
        }
    };
}),
"[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/resolveSSOCredentials.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "resolveSSOCredentials",
    ()=>resolveSSOCredentials
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$fromSso$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/token-providers/dist-es/fromSso.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFromFile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getSSOTokenFromFile.js [app-route] (ecmascript)");
;
;
;
;
const SHOULD_FAIL_CREDENTIAL_CHAIN = false;
const resolveSSOCredentials = async ({ ssoStartUrl, ssoSession, ssoAccountId, ssoRegion, ssoRoleName, ssoClient, clientConfig, parentClientConfig, callerClientConfig, profile, filepath, configFilepath, ignoreCache, logger })=>{
    let token;
    const refreshMessage = `To refresh this SSO session run aws sso login with the corresponding profile.`;
    if (ssoSession) {
        try {
            const _token = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$token$2d$providers$2f$dist$2d$es$2f$fromSso$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fromSso"])({
                profile,
                filepath,
                configFilepath,
                ignoreCache
            })();
            token = {
                accessToken: _token.token,
                expiresAt: new Date(_token.expiration).toISOString()
            };
        } catch (e) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](e.message, {
                tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
                logger
            });
        }
    } else {
        try {
            token = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getSSOTokenFromFile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getSSOTokenFromFile"])(ssoStartUrl);
        } catch (e) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`The SSO session associated with this profile is invalid. ${refreshMessage}`, {
                tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
                logger
            });
        }
    }
    if (new Date(token.expiresAt).getTime() - Date.now() <= 0) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`The SSO session associated with this profile has expired. ${refreshMessage}`, {
            tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
            logger
        });
    }
    const { accessToken } = token;
    const { SSOClient, GetRoleCredentialsCommand } = await __turbopack_context__.A("[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/loadSso.js [app-route] (ecmascript, async loader)");
    const sso = ssoClient || new SSOClient(Object.assign({}, clientConfig ?? {}, {
        logger: clientConfig?.logger ?? callerClientConfig?.logger ?? parentClientConfig?.logger,
        region: clientConfig?.region ?? ssoRegion,
        userAgentAppId: clientConfig?.userAgentAppId ?? callerClientConfig?.userAgentAppId ?? parentClientConfig?.userAgentAppId
    }));
    let ssoResp;
    try {
        ssoResp = await sso.send(new GetRoleCredentialsCommand({
            accountId: ssoAccountId,
            roleName: ssoRoleName,
            accessToken
        }));
    } catch (e) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](e, {
            tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
            logger
        });
    }
    const { roleCredentials: { accessKeyId, secretAccessKey, sessionToken, expiration, credentialScope, accountId } = {} } = ssoResp;
    if (!accessKeyId || !secretAccessKey || !sessionToken || !expiration) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"]("SSO returns an invalid temporary credential.", {
            tryNextLink: SHOULD_FAIL_CREDENTIAL_CHAIN,
            logger
        });
    }
    const credentials = {
        accessKeyId,
        secretAccessKey,
        sessionToken,
        expiration: new Date(expiration),
        ...credentialScope && {
            credentialScope
        },
        ...accountId && {
            accountId
        }
    };
    if (ssoSession) {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(credentials, "CREDENTIALS_SSO", "s");
    } else {
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(credentials, "CREDENTIALS_SSO_LEGACY", "u");
    }
    return credentials;
};
}),
"[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/validateSsoProfile.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "validateSsoProfile",
    ()=>validateSsoProfile
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-route] (ecmascript)");
;
const validateSsoProfile = (profile, logger)=>{
    const { sso_start_url, sso_account_id, sso_region, sso_role_name } = profile;
    if (!sso_start_url || !sso_account_id || !sso_region || !sso_role_name) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile is configured with invalid SSO credentials. Required parameters "sso_account_id", ` + `"sso_region", "sso_role_name", "sso_start_url". Got ${Object.keys(profile).join(", ")}\nReference: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-sso.html`, {
            tryNextLink: false,
            logger
        });
    }
    return profile;
};
}),
"[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/fromSSO.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromSSO",
    ()=>fromSSO
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getProfileName.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$loadSsoSessionData$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/loadSsoSessionData.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/parseKnownFiles.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$isSsoProfile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/isSsoProfile.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$resolveSSOCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/resolveSSOCredentials.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$validateSsoProfile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/validateSsoProfile.js [app-route] (ecmascript)");
;
;
;
;
;
const fromSSO = (init = {})=>async ({ callerClientConfig } = {})=>{
        init.logger?.debug("@aws-sdk/credential-provider-sso - fromSSO");
        const { ssoStartUrl, ssoAccountId, ssoRegion, ssoRoleName, ssoSession } = init;
        const { ssoClient } = init;
        const profileName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getProfileName"])({
            profile: init.profile ?? callerClientConfig?.profile
        });
        if (!ssoStartUrl && !ssoAccountId && !ssoRegion && !ssoRoleName && !ssoSession) {
            const profiles = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseKnownFiles"])(init);
            const profile = profiles[profileName];
            if (!profile) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile ${profileName} was not found.`, {
                    logger: init.logger
                });
            }
            if (!(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$isSsoProfile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isSsoProfile"])(profile)) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile ${profileName} is not configured with SSO credentials.`, {
                    logger: init.logger
                });
            }
            if (profile?.sso_session) {
                const ssoSessions = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$loadSsoSessionData$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["loadSsoSessionData"])(init);
                const session = ssoSessions[profile.sso_session];
                const conflictMsg = ` configurations in profile ${profileName} and sso-session ${profile.sso_session}`;
                if (ssoRegion && ssoRegion !== session.sso_region) {
                    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Conflicting SSO region` + conflictMsg, {
                        tryNextLink: false,
                        logger: init.logger
                    });
                }
                if (ssoStartUrl && ssoStartUrl !== session.sso_start_url) {
                    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Conflicting SSO start_url` + conflictMsg, {
                        tryNextLink: false,
                        logger: init.logger
                    });
                }
                profile.sso_region = session.sso_region;
                profile.sso_start_url = session.sso_start_url;
            }
            const { sso_start_url, sso_account_id, sso_region, sso_role_name, sso_session } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$validateSsoProfile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateSsoProfile"])(profile, init.logger);
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$resolveSSOCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveSSOCredentials"])({
                ssoStartUrl: sso_start_url,
                ssoSession: sso_session,
                ssoAccountId: sso_account_id,
                ssoRegion: sso_region,
                ssoRoleName: sso_role_name,
                ssoClient: ssoClient,
                clientConfig: init.clientConfig,
                parentClientConfig: init.parentClientConfig,
                callerClientConfig: init.callerClientConfig,
                profile: profileName,
                filepath: init.filepath,
                configFilepath: init.configFilepath,
                ignoreCache: init.ignoreCache,
                logger: init.logger
            });
        } else if (!ssoStartUrl || !ssoAccountId || !ssoRegion || !ssoRoleName) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"]("Incomplete configuration. The fromSSO() argument hash must include " + '"ssoStartUrl", "ssoAccountId", "ssoRegion", "ssoRoleName"', {
                tryNextLink: false,
                logger: init.logger
            });
        } else {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$resolveSSOCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveSSOCredentials"])({
                ssoStartUrl,
                ssoSession,
                ssoAccountId,
                ssoRegion,
                ssoRoleName,
                ssoClient,
                clientConfig: init.clientConfig,
                parentClientConfig: init.parentClientConfig,
                callerClientConfig: init.callerClientConfig,
                profile: profileName,
                filepath: init.filepath,
                configFilepath: init.configFilepath,
                ignoreCache: init.ignoreCache,
                logger: init.logger
            });
        }
    };
}),
"[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/types.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
}),
"[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromSSO",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$fromSSO$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fromSSO"],
    "isSsoProfile",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$isSsoProfile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isSsoProfile"],
    "validateSsoProfile",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$validateSsoProfile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["validateSsoProfile"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$fromSSO$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/fromSSO.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$isSsoProfile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/isSsoProfile.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$types$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/types.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$sso$2f$dist$2d$es$2f$validateSsoProfile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/validateSsoProfile.js [app-route] (ecmascript)");
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__85a94fe7._.js.map