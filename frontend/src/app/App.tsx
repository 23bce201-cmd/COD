import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Login } from "./components/screens/auth/Login";
import { MainDashboard } from "./components/screens/dashboards/MainDashboard";
import { AddClient } from "./components/screens/clients/AddClient";
import { ClientDashboard } from "./components/screens/dashboards/ClientDashboard";

import { ReactNode } from "react";

/**
 * Route guard — checks authentication and role access.
 * Accepts one or more allowed roles.
 */
function AuthGuard({
    children,
    allowedRoles,
}: {
    children: ReactNode;
    allowedRoles?: ("admin" | "manager" | "employee" | "client")[];
}) {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F1F5F9" }}>
                <div style={{ color: "#64748B", fontSize: 16 }}>Loading…</div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    if (allowedRoles && !allowedRoles.includes(user.role)) {
        // Wrong role — redirect to their dashboard
        return <Navigate to={getDashboardPath(user.role)} replace />;
    }

    return <>{children}</>;
}

/**
 * Returns the dashboard path for a given role.
 */
function getDashboardPath(role: string): string {
    switch (role) {
        case "admin":
            return "/agency/dashboard";
        case "manager":
            return "/manager/dashboard";
        case "employee":
            return "/employee/dashboard";
        case "client":
            return "/client/dashboard";
        default:
            return "/login";
    }
}

function SmartRedirect() {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "#F1F5F9" }}>
                <div style={{ color: "#64748B", fontSize: 16 }}>Loading…</div>
            </div>
        );
    }

    if (!user) return <Navigate to="/login" replace />;
    return <Navigate to={getDashboardPath(user.role)} replace />;
}



function AppRoutes() {
    return (
        <div className="min-h-screen flex" style={{ backgroundColor: "#F1F5F9" }}>
            <main className="flex-1 overflow-auto">
                <Routes>
                    <Route path="/" element={<SmartRedirect />} />
                    <Route path="/login" element={<Login />} />

                    {/* Admin routes */}
                    <Route
                        path="/agency/add-client"
                        element={
                            <AuthGuard allowedRoles={["admin"]}>
                                <AddClient />
                            </AuthGuard>
                        }
                    />
                    <Route
                        path="/agency/:tab?"
                        element={
                            <AuthGuard allowedRoles={["admin"]}>
                                <MainDashboard />
                            </AuthGuard>
                        }
                    />
                    <Route
                        path="/manager/:tab?"
                        element={
                            <AuthGuard allowedRoles={["manager"]}>
                                <MainDashboard />
                            </AuthGuard>
                        }
                    />
                    <Route
                        path="/employee/:tab?"
                        element={
                            <AuthGuard allowedRoles={["employee"]}>
                                <MainDashboard />
                            </AuthGuard>
                        }
                    />

                    {/* Client routes */}
                    <Route
                        path="/client/:tab?"
                        element={
                            <AuthGuard allowedRoles={["client"]}>
                                <ClientDashboard />
                            </AuthGuard>
                        }
                    />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </main>
        </div>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </AuthProvider>
    );
}
