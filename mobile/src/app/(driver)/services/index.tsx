import { useCallback, useEffect, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ApiError, friendlyApiMessage } from "@/api/client";
import { driverApi } from "@/api/driver";
import { useAuth } from "@/auth/context";
import { Brand, LoadingScreen, OfflineBanner, SecondaryButton, StateScreen, StatusBadge } from "@/components/ui";
import { useConnectivity } from "@/hooks/use-connectivity";
import { formatDateTime } from "@/lib/format";
import { colors } from "@/theme/colors";
import type { ApiDriverService } from "@/types/api";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ServicesScreen() {
  const auth = useAuth();
  const { offline } = useConnectivity();
  const [items, setItems] = useState<ApiDriverService[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async (refresh = false) => {
    if (!auth.token || offline) return;
    if (refresh) setRefreshing(true);
    setError(null);
    try { setItems(await driverApi.services(auth.token)); }
    catch (reason) {
      if (reason instanceof ApiError && reason.kind === "UNAUTHORIZED") { await auth.expire(); return; }
      setError(friendlyApiMessage(reason));
    } finally { setRefreshing(false); }
  }, [auth, offline]);
  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

  if (!items && !error && !offline) return <LoadingScreen label="Cargando tus servicios…" />;
  if (!items && offline) return <StateScreen eyebrow="Sin conexión" title="Tus servicios no están disponibles" message="Conéctate a Internet para consultar tus asignaciones." />;
  if (!items && error) return <StateScreen eyebrow="Error temporal" title="No hemos podido cargar tus servicios" message={error} actionLabel="Reintentar" onAction={() => void load()} />;

  return <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>{offline ? <OfflineBanner /> : null}<View style={styles.header}><View style={styles.top}><Brand /><SecondaryButton title="Salir" onPress={() => void auth.logout()} /></View><Text style={styles.eyebrow}>OPERATIVA</Text><Text style={styles.title}>Mis servicios</Text><Text style={styles.subtitle}>{auth.session?.user.name}, aquí tienes tus asignaciones activas.</Text></View><FlatList data={items ?? []} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} enabled={!offline} tintColor={colors.primary} />} ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyTitle}>Sin servicios asignados</Text><Text style={styles.emptyText}>Operaciones te avisará cuando tengas una nueva asignación.</Text></View>} renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/services/[id]", params: { id: item.id } })} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}><View style={styles.cardTop}><View style={styles.grow}><Text style={styles.reference}>{item.reference}</Text><Text style={styles.route}>{item.origin.name}</Text><Text style={styles.destination}>→ {item.destination.name}</Text></View><StatusBadge status={item.status} /></View><View style={styles.meta}><Text style={styles.metaText}>{formatDateTime(item.plannedPickup)}</Text><Text style={styles.metaText}>{item.assignment?.vehiclePlate ?? "Vehículo pendiente"}</Text></View><Text style={styles.open}>Ver servicio  ›</Text></Pressable>} /></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, header: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 13 }, top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 28 },
  eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 }, title: { color: colors.ink, fontSize: 31, lineHeight: 38, fontWeight: "900", marginTop: 4 }, subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 5 },
  list: { padding: 20, paddingTop: 8, gap: 13, flexGrow: 1 }, card: { backgroundColor: colors.surface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: colors.border }, cardPressed: { transform: [{ scale: 0.99 }], borderColor: colors.primary },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, grow: { flex: 1 }, reference: { color: colors.muted, fontSize: 12, fontWeight: "700" }, route: { color: colors.ink, fontSize: 20, fontWeight: "800", marginTop: 7 }, destination: { color: colors.text, fontSize: 15, marginTop: 5 }, meta: { flexDirection: "row", justifyContent: "space-between", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 16, paddingTop: 14 }, metaText: { flex: 1, color: colors.muted, fontSize: 12, fontWeight: "600" }, open: { color: colors.primary, fontSize: 14, fontWeight: "800", marginTop: 16 },
  empty: { marginTop: 40, padding: 26, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: "center" }, emptyTitle: { color: colors.ink, fontSize: 20, fontWeight: "800" }, emptyText: { color: colors.muted, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 8 },
});
