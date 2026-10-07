import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/auth/context";
import { ApiError, friendlyApiMessage } from "@/api/client";
import { DriverRoleError } from "@/auth/service";
import { Brand, OfflineBanner, PrimaryButton, Screen } from "@/components/ui";
import { useConnectivity } from "@/hooks/use-connectivity";
import { colors } from "@/theme/colors";

export default function LoginScreen() {
  const auth = useAuth();
  const { offline } = useConnectivity();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (auth.status === "authenticated") return <Redirect href="/services" />;

  const submit = async () => {
    if (!email.trim() || !password) { setError("Introduce tu correo y contraseña."); return; }
    setBusy(true); setError(null);
    try { await auth.login(email, password); }
    catch (reason) {
      setError(reason instanceof DriverRoleError ? reason.message : reason instanceof ApiError && reason.kind === "UNAUTHORIZED" ? "Correo o contraseña incorrectos." : friendlyApiMessage(reason));
    }
    finally { setBusy(false); }
  };

  return <Screen>{offline ? <OfflineBanner /> : null}<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Brand /><View style={styles.hero}><Text style={styles.eyebrow}>Tu jornada, clara</Text><Text style={styles.title}>Accede a tus servicios</Text><Text style={styles.subtitle}>Consulta la ruta y confirma cada asignación directamente con operaciones.</Text></View><View style={styles.form}><View><Text style={styles.label}>Correo</Text><TextInput accessibilityLabel="Correo" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} style={styles.input} placeholder="conductor@empresa.com" placeholderTextColor={colors.disabled} /></View><View><Text style={styles.label}>Contraseña</Text><TextInput accessibilityLabel="Contraseña" autoCapitalize="none" autoComplete="password" secureTextEntry value={password} onChangeText={setPassword} onSubmitEditing={() => void submit()} style={styles.input} placeholder="Tu contraseña" placeholderTextColor={colors.disabled} /></View>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<PrimaryButton title="Entrar" busy={busy} disabled={offline} onPress={() => void submit()} /></View><Text style={styles.footer}>Acceso exclusivo para conductores autorizados.</Text></ScrollView></KeyboardAvoidingView></Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 }, content: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 34 }, hero: { gap: 10 },
  eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" }, title: { color: colors.ink, fontSize: 34, lineHeight: 39, fontWeight: "900" }, subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  form: { gap: 17 }, label: { color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 7 }, input: { minHeight: 56, borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 16, backgroundColor: colors.surface, color: colors.text, fontSize: 16 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20 }, footer: { color: colors.muted, fontSize: 12, textAlign: "center" },
});
