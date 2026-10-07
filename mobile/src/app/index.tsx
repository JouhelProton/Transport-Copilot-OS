import { Redirect } from "expo-router";
import { useAuth } from "@/auth/context";
import { LoadingScreen, StateScreen } from "@/components/ui";

export default function IndexScreen() {
  const auth = useAuth();
  if (auth.status === "checking") return <LoadingScreen label="Comprobando sesión…" />;
  if (auth.status === "unavailable")
    return <StateScreen eyebrow="Conexión" title="No podemos comprobar tu sesión" message={auth.startupError ?? "Comprueba tu conexión y vuelve a intentarlo."} actionLabel="Reintentar" onAction={() => void auth.retry()} />;
  return <Redirect href={auth.status === "authenticated" ? "/services" : "/login"} />;
}
