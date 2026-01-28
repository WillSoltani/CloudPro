"use client";

export function LogoutButton() {
  const logout = () => {
    const domainRaw = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
    const logoutUri = process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI;

    if (!domainRaw || !clientId || !logoutUri) {
      console.error("Missing Cognito env vars.");
      return;
    }

    const domain = domainRaw.startsWith("http")
      ? domainRaw.replace(/\/$/, "")
      : `https://${domainRaw.replace(/\/$/, "")}`;

    // Clear local session
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("id_token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("pkce_verifier");
    sessionStorage.removeItem("oauth_state");

    // Tell UI “auth changed” immediately (so navbar flips even before redirect)
    window.dispatchEvent(new Event("auth:changed"));

    // Cognito hosted UI logout
    const url =
      `${domain}/logout` +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&logout_uri=${encodeURIComponent(logoutUri)}`;

    window.location.assign(url);
  };

  return (
    <button
      type="button"
      onClick={logout}
      className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/15"
    >
      Log out
    </button>
  );
}
