module.exports = [
"[externals]/node:crypto [external] (node:crypto, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("node:crypto", () => require("node:crypto"));

module.exports = mod;
}),
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-route] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
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
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveCredentialSource.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "resolveCredentialSource",
    ()=>resolveCredentialSource
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$chain$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/chain.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-route] (ecmascript)");
;
;
const resolveCredentialSource = (credentialSource, profileName, logger)=>{
    const sourceProvidersMap = {
        EcsContainer: async (options)=>{
            const { fromHttp } = await __turbopack_context__.A("[project]/node_modules/@aws-sdk/credential-provider-http/dist-es/index.js [app-route] (ecmascript, async loader)");
            const { fromContainerMetadata } = await __turbopack_context__.A("[project]/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-route] (ecmascript, async loader)");
            logger?.debug("@aws-sdk/credential-provider-ini - credential_source is EcsContainer");
            return async ()=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$chain$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["chain"])(fromHttp(options ?? {}), fromContainerMetadata(options))().then(setNamedProvider);
        },
        Ec2InstanceMetadata: async (options)=>{
            logger?.debug("@aws-sdk/credential-provider-ini - credential_source is Ec2InstanceMetadata");
            const { fromInstanceMetadata } = await __turbopack_context__.A("[project]/node_modules/@smithy/credential-provider-imds/dist-es/index.js [app-route] (ecmascript, async loader)");
            return async ()=>fromInstanceMetadata(options)().then(setNamedProvider);
        },
        Environment: async (options)=>{
            logger?.debug("@aws-sdk/credential-provider-ini - credential_source is Environment");
            const { fromEnv } = await __turbopack_context__.A("[project]/node_modules/@aws-sdk/credential-provider-env/dist-es/index.js [app-route] (ecmascript, async loader)");
            return async ()=>fromEnv(options)().then(setNamedProvider);
        }
    };
    if (credentialSource in sourceProvidersMap) {
        return sourceProvidersMap[credentialSource];
    } else {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Unsupported credential source in profile ${profileName}. Got ${credentialSource}, ` + `expected EcsContainer or Ec2InstanceMetadata or Environment.`, {
            logger
        });
    }
};
const setNamedProvider = (creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_NAMED_PROVIDER", "p");
}),
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveAssumeRoleCredentials.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isAssumeRoleProfile",
    ()=>isAssumeRoleProfile,
    "resolveAssumeRoleCredentials",
    ()=>resolveAssumeRoleCredentials
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getProfileName.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveCredentialSource$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveCredentialSource.js [app-route] (ecmascript)");
;
;
;
;
const isAssumeRoleProfile = (arg, { profile = "default", logger } = {})=>{
    return Boolean(arg) && typeof arg === "object" && typeof arg.role_arn === "string" && [
        "undefined",
        "string"
    ].indexOf(typeof arg.role_session_name) > -1 && [
        "undefined",
        "string"
    ].indexOf(typeof arg.external_id) > -1 && [
        "undefined",
        "string"
    ].indexOf(typeof arg.mfa_serial) > -1 && (isAssumeRoleWithSourceProfile(arg, {
        profile,
        logger
    }) || isCredentialSourceProfile(arg, {
        profile,
        logger
    }));
};
const isAssumeRoleWithSourceProfile = (arg, { profile, logger })=>{
    const withSourceProfile = typeof arg.source_profile === "string" && typeof arg.credential_source === "undefined";
    if (withSourceProfile) {
        logger?.debug?.(`    ${profile} isAssumeRoleWithSourceProfile source_profile=${arg.source_profile}`);
    }
    return withSourceProfile;
};
const isCredentialSourceProfile = (arg, { profile, logger })=>{
    const withProviderProfile = typeof arg.credential_source === "string" && typeof arg.source_profile === "undefined";
    if (withProviderProfile) {
        logger?.debug?.(`    ${profile} isCredentialSourceProfile credential_source=${arg.credential_source}`);
    }
    return withProviderProfile;
};
const resolveAssumeRoleCredentials = async (profileName, profiles, options, callerClientConfig, visitedProfiles = {}, resolveProfileData)=>{
    options.logger?.debug("@aws-sdk/credential-provider-ini - resolveAssumeRoleCredentials (STS)");
    const profileData = profiles[profileName];
    const { source_profile, region } = profileData;
    if (!options.roleAssumer) {
        const { getDefaultRoleAssumer } = await __turbopack_context__.A("[project]/node_modules/@aws-sdk/nested-clients/dist-es/submodules/sts/index.js [app-route] (ecmascript, async loader)");
        options.roleAssumer = getDefaultRoleAssumer({
            ...options.clientConfig,
            credentialProviderLogger: options.logger,
            parentClientConfig: {
                ...callerClientConfig,
                ...options?.parentClientConfig,
                region: region ?? options?.parentClientConfig?.region ?? callerClientConfig?.region
            }
        }, options.clientPlugins);
    }
    if (source_profile && source_profile in visitedProfiles) {
        throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Detected a cycle attempting to resolve credentials for profile` + ` ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getProfileName"])(options)}. Profiles visited: ` + Object.keys(visitedProfiles).join(", "), {
            logger: options.logger
        });
    }
    options.logger?.debug(`@aws-sdk/credential-provider-ini - finding credential resolver using ${source_profile ? `source_profile=[${source_profile}]` : `profile=[${profileName}]`}`);
    const sourceCredsProvider = source_profile ? resolveProfileData(source_profile, profiles, options, callerClientConfig, {
        ...visitedProfiles,
        [source_profile]: true
    }, isCredentialSourceWithoutRoleArn(profiles[source_profile] ?? {})) : (await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveCredentialSource$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveCredentialSource"])(profileData.credential_source, profileName, options.logger)(options))();
    if (isCredentialSourceWithoutRoleArn(profileData)) {
        return sourceCredsProvider.then((creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_SOURCE_PROFILE", "o"));
    } else {
        const params = {
            RoleArn: profileData.role_arn,
            RoleSessionName: profileData.role_session_name || `aws-sdk-js-${Date.now()}`,
            ExternalId: profileData.external_id,
            DurationSeconds: parseInt(profileData.duration_seconds || "3600", 10)
        };
        const { mfa_serial } = profileData;
        if (mfa_serial) {
            if (!options.mfaCodeProvider) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile ${profileName} requires multi-factor authentication, but no MFA code callback was provided.`, {
                    logger: options.logger,
                    tryNextLink: false
                });
            }
            params.SerialNumber = mfa_serial;
            params.TokenCode = await options.mfaCodeProvider(mfa_serial);
        }
        const sourceCreds = await sourceCredsProvider;
        return options.roleAssumer(sourceCreds, params).then((creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_SOURCE_PROFILE", "o"));
    }
};
const isCredentialSourceWithoutRoleArn = (section)=>{
    return !section.role_arn && !!section.credential_source;
};
}),
"[project]/node_modules/@aws-sdk/credential-provider-login/dist-es/LoginCredentialsFetcher.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LoginCredentialsFetcher",
    ()=>LoginCredentialsFetcher
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$httpRequest$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/protocol-http/dist-es/httpRequest.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$readFile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/readFile.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:crypto [external] (node:crypto, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:fs [external] (node:fs, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$os__$5b$external$5d$__$28$node$3a$os$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:os [external] (node:os, cjs)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/node:path [external] (node:path, cjs)");
;
;
;
;
;
;
;
class LoginCredentialsFetcher {
    profileData;
    init;
    callerClientConfig;
    static REFRESH_THRESHOLD = 5 * 60 * 1000;
    constructor(profileData, init, callerClientConfig){
        this.profileData = profileData;
        this.init = init;
        this.callerClientConfig = callerClientConfig;
    }
    async loadCredentials() {
        const token = await this.loadToken();
        if (!token) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Failed to load a token for session ${this.loginSession}, please re-authenticate using aws login`, {
                tryNextLink: false,
                logger: this.logger
            });
        }
        const accessToken = token.accessToken;
        const now = Date.now();
        const expiryTime = new Date(accessToken.expiresAt).getTime();
        const timeUntilExpiry = expiryTime - now;
        if (timeUntilExpiry <= LoginCredentialsFetcher.REFRESH_THRESHOLD) {
            return this.refresh(token);
        }
        return {
            accessKeyId: accessToken.accessKeyId,
            secretAccessKey: accessToken.secretAccessKey,
            sessionToken: accessToken.sessionToken,
            accountId: accessToken.accountId,
            expiration: new Date(accessToken.expiresAt)
        };
    }
    get logger() {
        return this.init?.logger;
    }
    get loginSession() {
        return this.profileData.login_session;
    }
    async refresh(token) {
        const { SigninClient, CreateOAuth2TokenCommand } = await __turbopack_context__.A("[project]/node_modules/@aws-sdk/nested-clients/dist-es/submodules/signin/index.js [app-route] (ecmascript, async loader)");
        const { logger, userAgentAppId } = this.callerClientConfig ?? {};
        const isH2 = (requestHandler)=>{
            return requestHandler?.metadata?.handlerProtocol === "h2";
        };
        const requestHandler = isH2(this.callerClientConfig?.requestHandler) ? undefined : this.callerClientConfig?.requestHandler;
        const region = this.profileData.region ?? await this.callerClientConfig?.region?.() ?? process.env.AWS_REGION;
        const client = new SigninClient({
            credentials: {
                accessKeyId: "",
                secretAccessKey: ""
            },
            region,
            requestHandler,
            logger,
            userAgentAppId,
            ...this.init?.clientConfig
        });
        this.createDPoPInterceptor(client.middlewareStack);
        const commandInput = {
            tokenInput: {
                clientId: token.clientId,
                refreshToken: token.refreshToken,
                grantType: "refresh_token"
            }
        };
        try {
            const response = await client.send(new CreateOAuth2TokenCommand(commandInput));
            const { accessKeyId, secretAccessKey, sessionToken } = response.tokenOutput?.accessToken ?? {};
            const { refreshToken, expiresIn } = response.tokenOutput ?? {};
            if (!accessKeyId || !secretAccessKey || !sessionToken || !refreshToken) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"]("Token refresh response missing required fields", {
                    logger: this.logger,
                    tryNextLink: false
                });
            }
            const expiresInMs = (expiresIn ?? 900) * 1000;
            const expiration = new Date(Date.now() + expiresInMs);
            const updatedToken = {
                ...token,
                accessToken: {
                    ...token.accessToken,
                    accessKeyId: accessKeyId,
                    secretAccessKey: secretAccessKey,
                    sessionToken: sessionToken,
                    expiresAt: expiration.toISOString()
                },
                refreshToken: refreshToken
            };
            await this.saveToken(updatedToken);
            const newAccessToken = updatedToken.accessToken;
            return {
                accessKeyId: newAccessToken.accessKeyId,
                secretAccessKey: newAccessToken.secretAccessKey,
                sessionToken: newAccessToken.sessionToken,
                accountId: newAccessToken.accountId,
                expiration
            };
        } catch (error) {
            if (error.name === "AccessDeniedException") {
                const errorType = error.error;
                let message;
                switch(errorType){
                    case "TOKEN_EXPIRED":
                        message = "Your session has expired. Please reauthenticate.";
                        break;
                    case "USER_CREDENTIALS_CHANGED":
                        message = "Unable to refresh credentials because of a change in your password. Please reauthenticate with your new password.";
                        break;
                    case "INSUFFICIENT_PERMISSIONS":
                        message = "Unable to refresh credentials due to insufficient permissions. You may be missing permission for the 'CreateOAuth2Token' action.";
                        break;
                    default:
                        message = `Failed to refresh token: ${String(error)}. Please re-authenticate using \`aws login\``;
                }
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](message, {
                    logger: this.logger,
                    tryNextLink: false
                });
            }
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Failed to refresh token: ${String(error)}. Please re-authenticate using aws login`, {
                logger: this.logger
            });
        }
    }
    async loadToken() {
        const tokenFilePath = this.getTokenFilePath();
        try {
            let tokenData;
            try {
                tokenData = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$readFile$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["readFile"])(tokenFilePath, {
                    ignoreCache: this.init?.ignoreCache
                });
            } catch  {
                tokenData = await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].readFile(tokenFilePath, "utf8");
            }
            const token = JSON.parse(tokenData);
            const missingFields = [
                "accessToken",
                "clientId",
                "refreshToken",
                "dpopKey"
            ].filter((k)=>!token[k]);
            if (!token.accessToken?.accountId) {
                missingFields.push("accountId");
            }
            if (missingFields.length > 0) {
                throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Token validation failed, missing fields: ${missingFields.join(", ")}`, {
                    logger: this.logger,
                    tryNextLink: false
                });
            }
            return token;
        } catch (error) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Failed to load token from ${tokenFilePath}: ${String(error)}`, {
                logger: this.logger,
                tryNextLink: false
            });
        }
    }
    async saveToken(token) {
        const tokenFilePath = this.getTokenFilePath();
        const directory = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["dirname"])(tokenFilePath);
        try {
            await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].mkdir(directory, {
                recursive: true
            });
        } catch (error) {}
        await __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$fs__$5b$external$5d$__$28$node$3a$fs$2c$__cjs$29$__["promises"].writeFile(tokenFilePath, JSON.stringify(token, null, 2), "utf8");
    }
    getTokenFilePath() {
        const directory = process.env.AWS_LOGIN_CACHE_DIRECTORY ?? (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["join"])((0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$os__$5b$external$5d$__$28$node$3a$os$2c$__cjs$29$__["homedir"])(), ".aws", "login", "cache");
        const loginSessionBytes = Buffer.from(this.loginSession, "utf8");
        const loginSessionSha256 = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createHash"])("sha256").update(loginSessionBytes).digest("hex");
        return (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$path__$5b$external$5d$__$28$node$3a$path$2c$__cjs$29$__["join"])(directory, `${loginSessionSha256}.json`);
    }
    derToRawSignature(derSignature) {
        let offset = 2;
        if (derSignature[offset] !== 0x02) {
            throw new Error("Invalid DER signature");
        }
        offset++;
        const rLength = derSignature[offset++];
        let r = derSignature.subarray(offset, offset + rLength);
        offset += rLength;
        if (derSignature[offset] !== 0x02) {
            throw new Error("Invalid DER signature");
        }
        offset++;
        const sLength = derSignature[offset++];
        let s = derSignature.subarray(offset, offset + sLength);
        r = r[0] === 0x00 ? r.subarray(1) : r;
        s = s[0] === 0x00 ? s.subarray(1) : s;
        const rPadded = Buffer.concat([
            Buffer.alloc(32 - r.length),
            r
        ]);
        const sPadded = Buffer.concat([
            Buffer.alloc(32 - s.length),
            s
        ]);
        return Buffer.concat([
            rPadded,
            sPadded
        ]);
    }
    createDPoPInterceptor(middlewareStack) {
        middlewareStack.add((next)=>async (args)=>{
                if (__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$protocol$2d$http$2f$dist$2d$es$2f$httpRequest$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["HttpRequest"].isInstance(args.request)) {
                    const request = args.request;
                    const actualEndpoint = `${request.protocol}//${request.hostname}${request.port ? `:${request.port}` : ""}${request.path}`;
                    const dpop = await this.generateDpop(request.method, actualEndpoint);
                    request.headers = {
                        ...request.headers,
                        DPoP: dpop
                    };
                }
                return next(args);
            }, {
            step: "finalizeRequest",
            name: "dpopInterceptor",
            override: true
        });
    }
    async generateDpop(method = "POST", endpoint) {
        const token = await this.loadToken();
        try {
            const privateKey = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createPrivateKey"])({
                key: token.dpopKey,
                format: "pem",
                type: "sec1"
            });
            const publicKey = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["createPublicKey"])(privateKey);
            const publicDer = publicKey.export({
                format: "der",
                type: "spki"
            });
            let pointStart = -1;
            for(let i = 0; i < publicDer.length; i++){
                if (publicDer[i] === 0x04) {
                    pointStart = i;
                    break;
                }
            }
            const x = publicDer.slice(pointStart + 1, pointStart + 33);
            const y = publicDer.slice(pointStart + 33, pointStart + 65);
            const header = {
                alg: "ES256",
                typ: "dpop+jwt",
                jwk: {
                    kty: "EC",
                    crv: "P-256",
                    x: x.toString("base64url"),
                    y: y.toString("base64url")
                }
            };
            const payload = {
                jti: crypto.randomUUID(),
                htm: method,
                htu: endpoint,
                iat: Math.floor(Date.now() / 1000)
            };
            const headerB64 = Buffer.from(JSON.stringify(header)).toString("base64url");
            const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
            const message = `${headerB64}.${payloadB64}`;
            const asn1Signature = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$node$3a$crypto__$5b$external$5d$__$28$node$3a$crypto$2c$__cjs$29$__["sign"])("sha256", Buffer.from(message), privateKey);
            const rawSignature = this.derToRawSignature(asn1Signature);
            const signatureB64 = rawSignature.toString("base64url");
            return `${message}.${signatureB64}`;
        } catch (error) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Failed to generate Dpop proof: ${error instanceof Error ? error.message : String(error)}`, {
                logger: this.logger,
                tryNextLink: false
            });
        }
    }
}
}),
"[project]/node_modules/@aws-sdk/credential-provider-login/dist-es/fromLoginCredentials.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromLoginCredentials",
    ()=>fromLoginCredentials
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getProfileName.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/parseKnownFiles.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$login$2f$dist$2d$es$2f$LoginCredentialsFetcher$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-login/dist-es/LoginCredentialsFetcher.js [app-route] (ecmascript)");
;
;
;
;
const fromLoginCredentials = (init)=>async ({ callerClientConfig } = {})=>{
        init?.logger?.debug?.("@aws-sdk/credential-providers - fromLoginCredentials");
        const profiles = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseKnownFiles"])(init || {});
        const profileName = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getProfileName"])({
            profile: init?.profile ?? callerClientConfig?.profile
        });
        const profile = profiles[profileName];
        if (!profile?.login_session) {
            throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Profile ${profileName} does not contain login_session.`, {
                tryNextLink: true,
                logger: init?.logger
            });
        }
        const fetcher = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$login$2f$dist$2d$es$2f$LoginCredentialsFetcher$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["LoginCredentialsFetcher"](profile, init, callerClientConfig);
        const credentials = await fetcher.loadCredentials();
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(credentials, "CREDENTIALS_LOGIN", "AD");
    };
}),
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveLoginCredentials.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isLoginProfile",
    ()=>isLoginProfile,
    "resolveLoginCredentials",
    ()=>resolveLoginCredentials
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$login$2f$dist$2d$es$2f$fromLoginCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-login/dist-es/fromLoginCredentials.js [app-route] (ecmascript)");
;
;
const isLoginProfile = (data)=>{
    return Boolean(data && data.login_session);
};
const resolveLoginCredentials = async (profileName, options, callerClientConfig)=>{
    const credentials = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$login$2f$dist$2d$es$2f$fromLoginCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fromLoginCredentials"])({
        ...options,
        profile: profileName
    })({
        callerClientConfig
    });
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(credentials, "CREDENTIALS_PROFILE_LOGIN", "AC");
};
}),
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveProcessCredentials.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isProcessProfile",
    ()=>isProcessProfile,
    "resolveProcessCredentials",
    ()=>resolveProcessCredentials
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-route] (ecmascript)");
;
const isProcessProfile = (arg)=>Boolean(arg) && typeof arg === "object" && typeof arg.credential_process === "string";
const resolveProcessCredentials = async (options, profile)=>__turbopack_context__.A("[project]/node_modules/@aws-sdk/credential-provider-process/dist-es/index.js [app-route] (ecmascript, async loader)").then(({ fromProcess })=>fromProcess({
            ...options,
            profile
        })().then((creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_PROCESS", "v")));
}),
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveSsoCredentials.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isSsoProfile",
    ()=>isSsoProfile,
    "resolveSsoCredentials",
    ()=>resolveSsoCredentials
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-route] (ecmascript)");
;
const resolveSsoCredentials = async (profile, profileData, options = {}, callerClientConfig)=>{
    const { fromSSO } = await __turbopack_context__.A("[project]/node_modules/@aws-sdk/credential-provider-sso/dist-es/index.js [app-route] (ecmascript, async loader)");
    return fromSSO({
        profile,
        logger: options.logger,
        parentClientConfig: options.parentClientConfig,
        clientConfig: options.clientConfig
    })({
        callerClientConfig
    }).then((creds)=>{
        if (profileData.sso_session) {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_SSO", "r");
        } else {
            return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_SSO_LEGACY", "t");
        }
    });
};
const isSsoProfile = (arg)=>arg && (typeof arg.sso_start_url === "string" || typeof arg.sso_account_id === "string" || typeof arg.sso_session === "string" || typeof arg.sso_region === "string" || typeof arg.sso_role_name === "string");
}),
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveStaticCredentials.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isStaticCredsProfile",
    ()=>isStaticCredsProfile,
    "resolveStaticCredentials",
    ()=>resolveStaticCredentials
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-route] (ecmascript)");
;
const isStaticCredsProfile = (arg)=>Boolean(arg) && typeof arg === "object" && typeof arg.aws_access_key_id === "string" && typeof arg.aws_secret_access_key === "string" && [
        "undefined",
        "string"
    ].indexOf(typeof arg.aws_session_token) > -1 && [
        "undefined",
        "string"
    ].indexOf(typeof arg.aws_account_id) > -1;
const resolveStaticCredentials = async (profile, options)=>{
    options?.logger?.debug("@aws-sdk/credential-provider-ini - resolveStaticCredentials");
    const credentials = {
        accessKeyId: profile.aws_access_key_id,
        secretAccessKey: profile.aws_secret_access_key,
        sessionToken: profile.aws_session_token,
        ...profile.aws_credential_scope && {
            credentialScope: profile.aws_credential_scope
        },
        ...profile.aws_account_id && {
            accountId: profile.aws_account_id
        }
    };
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(credentials, "CREDENTIALS_PROFILE", "n");
};
}),
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveWebIdentityCredentials.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "isWebIdentityProfile",
    ()=>isWebIdentityProfile,
    "resolveWebIdentityCredentials",
    ()=>resolveWebIdentityCredentials
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/core/dist-es/submodules/client/setCredentialFeature.js [app-route] (ecmascript)");
;
const isWebIdentityProfile = (arg)=>Boolean(arg) && typeof arg === "object" && typeof arg.web_identity_token_file === "string" && typeof arg.role_arn === "string" && [
        "undefined",
        "string"
    ].indexOf(typeof arg.role_session_name) > -1;
const resolveWebIdentityCredentials = async (profile, options, callerClientConfig)=>__turbopack_context__.A("[project]/node_modules/@aws-sdk/credential-provider-web-identity/dist-es/index.js [app-route] (ecmascript, async loader)").then(({ fromTokenFile })=>fromTokenFile({
            webIdentityTokenFile: profile.web_identity_token_file,
            roleArn: profile.role_arn,
            roleSessionName: profile.role_session_name,
            roleAssumerWithWebIdentity: options.roleAssumerWithWebIdentity,
            logger: options.logger,
            parentClientConfig: options.parentClientConfig
        })({
            callerClientConfig
        }).then((creds)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$core$2f$dist$2d$es$2f$submodules$2f$client$2f$setCredentialFeature$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["setCredentialFeature"])(creds, "CREDENTIALS_PROFILE_STS_WEB_ID_TOKEN", "q")));
}),
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveProfileData.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "resolveProfileData",
    ()=>resolveProfileData
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/property-provider/dist-es/CredentialsProviderError.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveAssumeRoleCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveAssumeRoleCredentials.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveLoginCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveLoginCredentials.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProcessCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveProcessCredentials.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveSsoCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveSsoCredentials.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveStaticCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveStaticCredentials.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveWebIdentityCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveWebIdentityCredentials.js [app-route] (ecmascript)");
;
;
;
;
;
;
;
const resolveProfileData = async (profileName, profiles, options, callerClientConfig, visitedProfiles = {}, isAssumeRoleRecursiveCall = false)=>{
    const data = profiles[profileName];
    if (Object.keys(visitedProfiles).length > 0 && (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveStaticCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isStaticCredsProfile"])(data)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveStaticCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveStaticCredentials"])(data, options);
    }
    if (isAssumeRoleRecursiveCall || (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveAssumeRoleCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isAssumeRoleProfile"])(data, {
        profile: profileName,
        logger: options.logger
    })) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveAssumeRoleCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveAssumeRoleCredentials"])(profileName, profiles, options, callerClientConfig, visitedProfiles, resolveProfileData);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveStaticCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isStaticCredsProfile"])(data)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveStaticCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveStaticCredentials"])(data, options);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveWebIdentityCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isWebIdentityProfile"])(data)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveWebIdentityCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveWebIdentityCredentials"])(data, options, callerClientConfig);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProcessCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isProcessProfile"])(data)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProcessCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveProcessCredentials"])(options, profileName);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveSsoCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isSsoProfile"])(data)) {
        return await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveSsoCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveSsoCredentials"])(profileName, data, options, callerClientConfig);
    }
    if ((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveLoginCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["isLoginProfile"])(data)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveLoginCredentials$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveLoginCredentials"])(profileName, options, callerClientConfig);
    }
    throw new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$property$2d$provider$2f$dist$2d$es$2f$CredentialsProviderError$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["CredentialsProviderError"](`Could not resolve credentials using profile: [${profileName}] in configuration/credentials file(s).`, {
        logger: options.logger
    });
};
}),
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/fromIni.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromIni",
    ()=>fromIni
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/getProfileName.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@smithy/shared-ini-file-loader/dist-es/parseKnownFiles.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProfileData$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/resolveProfileData.js [app-route] (ecmascript)");
;
;
const fromIni = (init = {})=>async ({ callerClientConfig } = {})=>{
        init.logger?.debug("@aws-sdk/credential-provider-ini - fromIni");
        const profiles = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$parseKnownFiles$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["parseKnownFiles"])(init);
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$resolveProfileData$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["resolveProfileData"])((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$smithy$2f$shared$2d$ini$2d$file$2d$loader$2f$dist$2d$es$2f$getProfileName$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getProfileName"])({
            profile: init.profile ?? callerClientConfig?.profile
        }), profiles, init, callerClientConfig);
    };
}),
"[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fromIni",
    ()=>__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$fromIni$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fromIni"]
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$index$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/index.js [app-route] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$aws$2d$sdk$2f$credential$2d$provider$2d$ini$2f$dist$2d$es$2f$fromIni$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@aws-sdk/credential-provider-ini/dist-es/fromIni.js [app-route] (ecmascript)");
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__53ca1444._.js.map