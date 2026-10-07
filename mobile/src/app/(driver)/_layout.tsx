import { Redirect, Stack } from "expo-router";
import { useAuth } from "@/auth/context";
import { LoadingScreen } from "@/components/ui";

export default function DriverLayout() {
  const auth = useAuth();
  if (auth.status === "checking") return <LoadingScreen />;
  if (auth.status !== "authenticated") return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
