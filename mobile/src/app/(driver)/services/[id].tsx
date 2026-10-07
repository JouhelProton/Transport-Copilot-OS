import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ApiError, friendlyApiMessage } from "@/api/client";
import { driverApi } from "@/api/driver";
import { useAuth } from "@/auth/context";
import { DetailRow, LoadingScreen, OfflineBanner, PrimaryButton, StateScreen, StatusBadge } from "@/components/ui";
import { useConnectivity } from "@/hooks/use-connectivity";
import { formatDateTime } from "@/lib/format";
import { colors } from "@/theme/colors";
import type { ApiDriverService } from "@/types/api";

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const auth = useAuth();
  const { offline } = useConnectivity();
  const [item, setItem] = useState<ApiDriverService | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptedNow, setAcceptedNow] = useState(false);
  const load = useCallback(async () => {
    if (!auth.token || !id || offline) return;
    setError(null);
    try { setItem(await driverApi.service(auth.token, id)); }
    catch (reason) {
      if (reason instanceof ApiError && reason.kind === "UNAUTHORIZED") { await auth.expire(); return; }
      setError(reason instanceof ApiError && [403, 404].includes(reason.status ?? 0) ? "Este servicio no existe o no está asignado a tu conductor." : friendlyApiMessage(reason));
    }
  }, [auth, id, offline]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  const accept = async () => {
    if (!auth.token || !id || offline || accepting) return;
    setAccepting(true); setError(null);
    try { setItem(await driverApi.acceptService(auth.token, id)); setAcceptedNow(true); }
    catch (reason) {
      if (reason instanceof ApiError && reason.kind === "UNAUTHORIZED") { await auth.expire(); return; }
      setError(friendlyApiMessage(reason));
    } finally { setAccepting(false); }
  };

  if (!item && !error && !offline) return <LoadingScreen label="Cargando servicio…" />;
  if (!item && offline) return <StateScreen eyebrow="Sin conexión" title="No podemos abrir este servicio" message="Conéctate a Internet y vuelve a intentarlo." />;
  if (!item) return <StateScreen eyebrow="Servicio" title="Servicio no disponible" message={error ?? "No hemos podido cargarlo."} actionLabel="Volver" onAction={() => router.back()} />;
  const accepted = item.status === "DRIVER_ACCEPTED";
  const temperature = item.tempMin === null ? "No requerida" : `${item.tempMin}–${item.tempMax ?? item.tempMin} °C`;

  return <View style={styles.screen}>{offline ? <OfflineBanner /> : null}<ScrollView contentContainerStyle={styles.content}><Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹  Mis servicios</Text></Pressable><View style={styles.heading}><View style={styles.grow}><Text style={styles.label}>REFERENCIA</Text><Text style={styles.title}>{item.reference}</Text></View><StatusBadge status={item.status} /></View><View style={styles.card}><DetailRow label="Origen" value={`${item.origin.name} · ${item.origin.address}`} /><DetailRow label="Destino" value={`${item.destination.name} · ${item.destination.address}`} /><DetailRow label="Recogida planificada" value={formatDateTime(item.plannedPickup)} /><DetailRow label="Entrega planificada" value={formatDateTime(item.plannedDelivery)} /><DetailRow label="Mercancía" value={`${item.cargo} · ${item.pallets} palets`} /><DetailRow label="Temperatura" value={temperature} /><DetailRow label="Vehículo" value={item.assignment?.vehiclePlate ?? "Pendiente"} /></View>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{accepted ? <View accessibilityRole="alert" style={styles.confirmed}><Text style={styles.confirmedIcon}>✓</Text><Text style={styles.confirmedTitle}>{acceptedNow ? "Servicio aceptado" : "Servicio ya aceptado"}</Text><Text style={styles.confirmedText}>Operaciones tiene la confirmación.</Text></View> : <PrimaryButton title={accepting ? "Confirmando…" : "Aceptar servicio"} busy={accepting} disabled={offline} onPress={() => void accept()} />}<Text style={styles.note}>El inicio del viaje y el GPS se incorporarán en un hito posterior.</Text></ScrollView></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 40 }, back: { minHeight: 48, alignSelf: "flex-start", justifyContent: "center" }, backText: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginVertical: 17 }, grow: { flex: 1 }, label: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }, title: { color: colors.ink, fontSize: 28, fontWeight: "900", marginTop: 5 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: 18, marginBottom: 18 }, error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  confirmed: { backgroundColor: colors.successSoft, borderRadius: 20, padding: 20, alignItems: "center" }, confirmedIcon: { width: 38, height: 38, borderRadius: 19, textAlign: "center", textAlignVertical: "center", color: "#fff", backgroundColor: colors.success, fontSize: 24, fontWeight: "900" }, confirmedTitle: { color: colors.success, fontSize: 20, fontWeight: "900", marginTop: 10 }, confirmedText: { color: colors.success, fontSize: 14, marginTop: 4 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 18, paddingHorizontal: 16 },
});
