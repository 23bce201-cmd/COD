import Keycloak from "keycloak-js";

const authMode = (import.meta.env.VITE_AUTH_MODE || "keycloak").trim();

export const isDevAuthBypass = authMode.toLowerCase() === "dev-bypass";

const hasKeycloakConfig = Boolean(
    import.meta.env.VITE_KEYCLOAK_URL &&
    import.meta.env.VITE_KEYCLOAK_REALM &&
    import.meta.env.VITE_KEYCLOAK_CLIENT_ID
);

const keycloak = isDevAuthBypass || !hasKeycloakConfig
    ? null
    : new Keycloak({
        url: import.meta.env.VITE_KEYCLOAK_URL,
        realm: import.meta.env.VITE_KEYCLOAK_REALM,
        clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
    });

let initPromise: Promise<boolean> | null = null;

export function initKeycloak() {
    if (isDevAuthBypass) {
        return Promise.resolve(false);
    }

    if (!keycloak) {
        return Promise.resolve(false);
    }

    if (!initPromise) {
        initPromise = keycloak.init({
            onLoad: "check-sso",
            pkceMethod: "S256",
            checkLoginIframe: false,
            silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
        });
    }

    return initPromise;
}

export default keycloak;
