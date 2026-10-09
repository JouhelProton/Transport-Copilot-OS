import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ApiError, friendlyApiMessage } from "@/api/client";
import { driverApi } from "@/api/driver";
import { useAuth } from "@/auth/context";
import { DetailRow, LoadingScreen, OfflineBanner, PrimaryButton, SecondaryButton, StateScreen } from "@/components/ui";
import { useConnectivity } from "@/hooks/use-connectivity";
import { formatDateTime } from "@/lib/format";
import { colors } from "@/theme/colors";
import type { ApiDriverService, DriverDocument, DriverPod } from "@/types/api";
import { SafeAreaView } from "react-native-safe-area-context";
import { routeParam } from "@/lib/route-params";

export default function DriverDocumentsScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = routeParam(params.id);
  const auth = useAuth();
  const { offline } = useConnectivity();
  const [service, setService] = useState<ApiDriverService | null>(null);
  const [documents, setDocuments] = useState<DriverDocument[]>([]);
  const [pod, setPod] = useState<DriverPod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!auth.token || !id || offline) return;
    setError(null);
    try {
      const loadedService = await driverApi.service(auth.token, id);
      setService(loadedService);
      try { setDocuments(await driverApi.documents(auth.token, id)); } catch (documentsReason) { setDocuments([]); setMessage(friendlyApiMessage(documentsReason)); }
      try { setPod(await driverApi.pod(auth.token, id)); } catch (podReason) { setPod(null); if (podReason instanceof ApiError && podReason.status !== 404) setMessage(friendlyApiMessage(podReason)); }
    } catch (reason) {
      if (reason instanceof ApiError && reason.kind === "UNAUTHORIZED") { await auth.expire(); return; }
      if (reason instanceof ApiError && reason.status === 403) setError("Este servicio no está asignado a tu conductor o tu sesión no tiene permiso para verlo.");
      else if (reason instanceof ApiError && reason.status === 404) setError("El servicio ya no existe en la API conectada. Actualiza la lista de servicios.");
      else setError(friendlyApiMessage(reason));
    }
  }, [auth, id, offline]);

  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);

  const addPhoto = async () => {
    if (!auth.token || !id || busy || offline) return;
    setMessage(null); setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) { setMessage("Concede permiso de cámara para adjuntar una evidencia."); return; }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const uploaded = await driverApi.uploadDocument(auth.token, id, { type: "DELIVERY_PHOTO", file: { uri: asset.uri, name: asset.fileName ?? `evidencia-${Date.now()}.jpg`, type: asset.mimeType ?? "image/jpeg" } });
      setDocuments((current) => [uploaded, ...current]); setMessage("Evidencia recibida por el servidor.");
    } catch (reason) { if (reason instanceof ApiError && reason.kind === "UNAUTHORIZED") { await auth.expire(); return; } setMessage(friendlyApiMessage(reason)); }
    finally { setBusy(false); }
  };

  if (!service && !error && !offline) return <LoadingScreen label="Cargando documentos…" />;
  if (!service && offline) return <StateScreen eyebrow="Sin conexión" title="Documentos no disponibles" message="Conéctate a Internet para consultar los documentos del servicio." />;
  if (!service) return <StateScreen eyebrow="Documentos" title="No se pudo abrir el servicio" message={error ?? "Error desconocido"} actionLabel="Volver" onAction={() => router.back()} />;
  return <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
    {offline ? <OfflineBanner /> : null}
    <ScrollView contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹  Volver al servicio</Text></Pressable>
      <Text style={styles.eyebrow}>ENTREGA Y DOCUMENTOS</Text><Text style={styles.title}>{service.reference}</Text>
      <View style={styles.summary}><DetailRow label="Origen" value={service.origin.name} /><DetailRow label="Destino" value={service.destination.name} /><DetailRow label="Estado del servicio" value={service.status} /></View>
      <View style={styles.card}><Text style={styles.cardTitle}>Documentos asociados</Text><Text style={styles.cardText}>Los archivos se almacenan de forma privada y quedan pendientes de revisión operativa.</Text>{documents.length ? documents.map((document) => <View key={document.id} style={styles.document}><View style={styles.grow}><Text style={styles.documentName} numberOfLines={1}>{document.originalName}</Text><Text style={styles.documentMeta}>{document.type} · {document.status} · {formatDateTime(document.uploadedAt)}</Text></View><Text style={styles.hash}>{document.sha256.slice(0, 8)}</Text></View>) : <Text style={styles.empty}>Todavía no hay documentos asociados.</Text>}<PrimaryButton title={busy ? "Subiendo…" : "Añadir fotografía"} busy={busy} disabled={offline} onPress={() => void addPhoto()} />{message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}</View>
      <View style={styles.card}><Text style={styles.cardTitle}>Prueba de entrega</Text>{pod ? <><Text style={styles.status}>{pod.status}</Text><Text style={styles.cardText}>Enviada {formatDateTime(pod.serverSubmittedAt)} · {pod.documents.length} evidencia(s).</Text>{pod.receiverName ? <DetailRow label="Receptor" value={pod.receiverName} /> : null}{pod.observations ? <DetailRow label="Observaciones" value={pod.observations} /> : null}</> : <Text style={styles.cardText}>Aún no has enviado una prueba de entrega. Usa el botón de la pantalla del servicio para completar el formulario con receptor, observaciones y hasta cuatro fotos.</Text>}<SecondaryButton title="Abrir formulario POD" onPress={() => router.back()} /></View>
      <Text style={styles.note}>La confirmación solo aparece después de recibir respuesta persistida del backend.</Text>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 42, gap: 18 }, back: { minHeight: 46, justifyContent: "center", alignSelf: "flex-start" }, backText: { color: colors.primary, fontSize: 15, fontWeight: "800" }, eyebrow: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }, title: { color: colors.ink, fontSize: 30, fontWeight: "900", marginTop: -10 }, summary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 18 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 18, gap: 12 }, cardTitle: { color: colors.ink, fontSize: 18, fontWeight: "900" }, cardText: { color: colors.muted, fontSize: 13, lineHeight: 20 }, document: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.background, borderRadius: 12, padding: 12 }, grow: { flex: 1 }, documentName: { color: colors.text, fontSize: 13, fontWeight: "800" }, documentMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, hash: { color: colors.muted, fontSize: 10, fontFamily: "monospace" }, empty: { color: colors.muted, fontSize: 13 }, message: { color: colors.primary, fontSize: 13, fontWeight: "700" }, status: { alignSelf: "flex-start", color: colors.success, backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7, fontWeight: "900", fontSize: 12 }, note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", paddingHorizontal: 14 },
});
