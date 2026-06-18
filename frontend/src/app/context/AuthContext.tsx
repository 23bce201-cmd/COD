import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import keycloak, { initKeycloak, isDevAuthBypass } from "../lib/keycloak";

export type Role = "admin" | "manager" | "employee" | "client";

interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    client_id?: string | null;
}

interface LoginOptions {
    email?: string;
    idpHint?: string;
}

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (options?: LoginOptions) => Promise<{ success: boolean; error?: string }>;
    logout: () => Promise<void>;
    getAccessToken: () => string | null;
    apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
}

const DEFAULT_API_ORIGIN = import.meta.env.DEV ? "http://localhost:3001" : "";
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || DEFAULT_API_ORIGIN).replace(/\/$/, "");
const DEV_AUTH_EMAIL_HEADER = "X-Dev-Auth-Email";
const DEV_AUTH_EMAIL_STORAGE_KEY = "cloudcrm.dev_auth_email";
const DEV_AUTH_DEFAULT_EMAIL = (import.meta.env.VITE_DEV_AUTH_EMAIL || "").trim();
const AuthContext = createContext<AuthContextType | null>(null);

function normalizeUser(data: any): User {
    return {
        id: data.id,
        email: data.email,
        name: data.name || "",
        role: (data.role === "agency_admin" ? "admin" : data.role) as Role,
        client_id: data.client_id,
    };
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        async function bootstrap() {
            try {
                if (isDevAuthBypass) {
                    const nextUser = await fetchMe();
                    if (mounted) {
                        setUser(nextUser);
                    }
                    return;
                }

                const authenticated = await initKeycloak();
                if (!authenticated) {
                    if (mounted) setUser(null);
                    return;
                }

                const nextUser = await fetchMe();
                if (mounted) {
                    setUser(nextUser);
                }
            } catch (error) {
                console.error("Failed to initialize Keycloak:", error);
                if (mounted) {
                    setUser(null);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        }

        if (keycloak) {
            keycloak.onAuthLogout = () => {
                if (mounted) {
                    setUser(null);
                }
            };

            keycloak.onTokenExpired = async () => {
                try {
                    await keycloak.updateToken(30);
                } catch {
                    if (mounted) {
                        setUser(null);
                    }
                }
            };
        }

        bootstrap();

        return () => {
            mounted = false;
        };
    }, []);

    function getDevAuthEmail(overrideEmail?: string) {
        const fromOverride = overrideEmail?.trim() || "";
        if (fromOverride) return fromOverride;

        const fromStorage = sessionStorage.getItem(DEV_AUTH_EMAIL_STORAGE_KEY)?.trim() || "";
        if (fromStorage) return fromStorage;

        return DEV_AUTH_DEFAULT_EMAIL;
    }

    async function fetchMe(devEmailOverride?: string) {
        if (!isDevAuthBypass && !keycloak?.token) {
            return null;
        }

        const headers: Record<string, string> = {};
        if (keycloak?.token) {
            headers.Authorization = `Bearer ${keycloak.token}`;
        }

        if (isDevAuthBypass) {
            const devEmail = getDevAuthEmail(devEmailOverride);
            if (devEmail) {
                headers[DEV_AUTH_EMAIL_HEADER] = devEmail;
            }
        }

        const res = await fetch(`${API_ORIGIN}/api/users/me`, {
            headers,
        });

        if (!res.ok) {
            return null;
        }

        const data = await res.json();
        return normalizeUser(data.user);
    }

    async function login(options: LoginOptions = {}) {
        if (isDevAuthBypass) {
            const requestedEmail = options.email?.trim();
            if (requestedEmail) {
                sessionStorage.setItem(DEV_AUTH_EMAIL_STORAGE_KEY, requestedEmail);
            }

            const nextUser = await fetchMe(requestedEmail);
            if (!nextUser) {
                return { success: false, error: "No matching active local user found for development login." };
            }

            setUser(nextUser);
            return { success: true };
        }

        if (!keycloak) {
            return { success: false, error: "Keycloak is not configured." };
        }

        try {
            await keycloak.login({
                redirectUri: `${window.location.origin}/`,
                loginHint: options.email || undefined,
                idpHint: options.idpHint || undefined,
            });
            return { success: true };
        } catch {
            return { success: false, error: "Failed to redirect to Keycloak." };
        }
    }

    async function logout() {
        setUser(null);
        sessionStorage.removeItem(DEV_AUTH_EMAIL_STORAGE_KEY);

        if (isDevAuthBypass || !keycloak) {
            return;
        }

        try {
            await keycloak.logout({
                redirectUri: `${window.location.origin}/login`,
            });
        } catch (error) {
            console.error("Keycloak logout failed:", error);
        }
    }

    function getAccessToken() {
        return keycloak?.token || null;
    }

    async function apiFetch(path: string, init: RequestInit = {}) {
        if (keycloak?.authenticated) {
            await keycloak.updateToken(30);
        }

        const headers: Record<string, string> = {
            ...(init.headers as Record<string, string>),
        };

        if (keycloak?.token) {
            headers.Authorization = `Bearer ${keycloak.token}`;
        }

        if (isDevAuthBypass) {
            const devEmail = getDevAuthEmail();
            if (devEmail) {
                headers[DEV_AUTH_EMAIL_HEADER] = devEmail;
            }
        }

        if (!headers["Content-Type"] && !(init.body instanceof FormData)) {
            headers["Content-Type"] = "application/json";
        }

        const response = await fetch(`${API_ORIGIN}${path}`, {
            ...init,
            headers,
        });

        if (response.status === 401) {
            setUser(null);
        }

        return response;
    }

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, getAccessToken, apiFetch }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
}
