import { AppRoutes } from "@/app/appRoutes";
import { AuthProvider } from "@/context/authContext";

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
