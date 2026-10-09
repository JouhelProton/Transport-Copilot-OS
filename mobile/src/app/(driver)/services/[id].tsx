import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { ApiError, friendlyApiMessage } from "@/api/client";
import { driverApi } from "@/api/driver";
import { useAuth } from "@/auth/context";
import { DetailRow, LoadingScreen, OfflineBanner, PrimaryButton, SecondaryButton, StateScreen, StatusBadge } from "@/components/ui";
import { useConnectivity } from "@/hooks/use-connectivity";
import { formatDateTime } from "@/lib/format";
import { colors } from "@/theme/colors";
import type { ApiDriverService, DriverPod, IncidentPriority, IncidentType } from "@/types/api";
import { TrackingController, type TrackingStatus } from "@/tracking/controller";
import { SafeAreaView } from "react-native-safe-area-context";
import { routeParam } from "@/lib/route-params";

const initialTracking: TrackingStatus = {
  state: "OFF",
  apiBaseUrl: process.env.EXPO_PUBLIC_API_URL ?? "Sin configurar",
  trackingSessionId: null,
  lastAttemptAt: null,
  lastConfirmedAt: null,
  lastAccuracy: null,
  lastHttpStatus: null,
  pendingCount: 0,
  rejectedCount: 0,
  message: null,
};

const INCIDENT_LABELS: Record<IncidentType, string> = {
  DELAY: "Retraso", BREAKDOWN: "Avería", LOADING_PROBLEM: "Problema de carga", UNLOADING_PROBLEM: "Problema de descarga",
  WRONG_ADDRESS: "Dirección incorrecta", DOCUMENT_PROBLEM: "Problema documental", OTHER: "Otra incidencia",
};

export default function ServiceDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = routeParam(params.id);
  const auth = useAuth();
  const { offline } = useConnectivity();
  const [item, setItem] = useState<ApiDriverService | null>(null);
  const [pod, setPod] = useState<DriverPod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [acceptedNow, setAcceptedNow] = useState(false);
  const [incidentType, setIncidentType] = useState<IncidentType>("OTHER");
  const [incidentPriority, setIncidentPriority] = useState<IncidentPriority>("MEDIUM");
  const [incidentDescription, setIncidentDescription] = useState("");
  const [sendingIncident, setSendingIncident] = useState(false);
  const [incidentMessage, setIncidentMessage] = useState<string | null>(null);
  const [tracking, setTracking] = useState<TrackingStatus>(initialTracking);
  const [evidence, setEvidence] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [receiverName, setReceiverName] = useState("");
  const [observations, setObservations] = useState("");
  const [podMessage, setPodMessage] = useState<string | null>(null);
  const [submittingPod, setSubmittingPod] = useState(false);
  const trackingRef = useRef<TrackingController | null>(null);

  const load = useCallback(async () => {
    if (!auth.token || !id || offline) return;
    setError(null);
    try {
      const service = await driverApi.service(auth.token, id);
      setItem(service);
      try {
        setPod(await driverApi.pod(auth.token, id));
      } catch (podReason) {
        // The service remains usable when an optional POD route is unavailable on an older backend.
        setPod(null);
        setPodMessage(podReason instanceof ApiError && podReason.status === 404 ? "La entrega y documentos se cargarán cuando el backend documental esté disponible." : friendlyApiMessage(podReason));
      }
    } catch (reason) {
      if (reason instanceof ApiError && reason.kind === "UNAUTHORIZED") { await auth.expire(); return; }
      if (reason instanceof ApiError && reason.status === 403) setError("Este servicio no está asignado a tu conductor o tu sesión no tiene permiso para verlo.");
      else if (reason instanceof ApiError && reason.status === 404) setError("El servicio ya no existe en la API conectada. Actualiza la lista de servicios.");
      else setError(friendlyApiMessage(reason));
    }
  }, [auth, id, offline]);

  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => () => { void trackingRef.current?.dispose(); }, []);

  const toggleTracking = async () => {
    if (!auth.token || !id || offline || !item?.assignment) return;
    if (["ACTIVE", "LOW_ACCURACY", "OFFLINE", "SYNC_PENDING"].includes(tracking.state)) { await trackingRef.current?.stop(); return; }
    if (!trackingRef.current) { trackingRef.current = new TrackingController(auth.token, id); trackingRef.current.subscribe(setTracking); }
    await trackingRef.current.start();
  };

  const accept = async () => {
    if (!auth.token || !id || offline || accepting) return;
    setAccepting(true); setError(null);
    try { setItem(await driverApi.acceptService(auth.token, id)); setAcceptedNow(true); }
    catch (reason) { if (reason instanceof ApiError && reason.kind === "UNAUTHORIZED") { await auth.expire(); return; } setError(friendlyApiMessage(reason)); }
    finally { setAccepting(false); }
  };

  const reportIncident = async () => {
    if (!auth.token || !id || offline || sendingIncident || incidentDescription.trim().length < 5) return;
    setSendingIncident(true); setIncidentMessage(null);
    try {
      await driverApi.createIncident(auth.token, id, { type: incidentType, priority: incidentPriority, description: incidentDescription.trim() });
      setIncidentDescription(""); setIncidentMessage("Incidencia enviada a operaciones.");
    } catch (reason) {
      if (reason instanceof ApiError && reason.kind === "UNAUTHORIZED") { await auth.expire(); return; }
      setIncidentMessage(friendlyApiMessage(reason));
    } finally { setSendingIncident(false); }
  };

  const takePhoto = async () => {
    setPodMessage(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) { setPodMessage("Necesitamos permiso de cámara solo para capturar la evidencia que decidas enviar."); return; }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!result.canceled) setEvidence((current) => [...current, ...result.assets].slice(0, 4));
  };

  const selectImage = async () => {
    setPodMessage(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { setPodMessage("Necesitamos permiso para adjuntar la imagen que selecciones."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8, allowsMultipleSelection: true, selectionLimit: Math.max(1, 4 - evidence.length) });
    if (!result.canceled) setEvidence((current) => [...current, ...result.assets].slice(0, 4));
  };

  const submitPod = async () => {
    if (!auth.token || !id || offline || submittingPod || !evidence.length) return;
    setSubmittingPod(true); setPodMessage(null);
    try {
      const result = await driverApi.submitPod(auth.token, id, {
        deliveredAt: new Date().toISOString(),
        ...(receiverName.trim() ? { receiverName: receiverName.trim() } : {}),
        ...(observations.trim() ? { observations: observations.trim() } : {}),
        files: evidence.map((asset, index) => ({ uri: asset.uri, name: asset.fileName ?? `entrega-${Date.now()}-${index + 1}.jpg`, type: asset.mimeType ?? "image/jpeg" })),
      });
      setPod(result); setEvidence([]); setPodMessage("POD recibido por operaciones.");
    } catch (reason) {
      if (reason instanceof ApiError && reason.kind === "UNAUTHORIZED") { await auth.expire(); return; }
      setPodMessage(reason instanceof ApiError && reason.code === "FILE_TOO_LARGE" ? "La imagen supera el tamaño permitido. Selecciona una más pequeña." : friendlyApiMessage(reason));
    } finally { setSubmittingPod(false); }
  };

  if (!item && !error && !offline) return <LoadingScreen label="Cargando servicio…" />;
  if (!item && offline) return <StateScreen eyebrow="Sin conexión" title="No podemos abrir este servicio" message="Conéctate a Internet y vuelve a intentarlo." />;
  if (!item) return <StateScreen eyebrow="Servicio" title="Servicio no disponible" message={error ?? "No hemos podido cargarlo."} actionLabel="Volver" onAction={() => router.back()} />;
  const accepted = item.status === "DRIVER_ACCEPTED";
  const temperature = item.tempMin === null ? "No requerida" : `${item.tempMin}–${item.tempMax ?? item.tempMin} °C`;
  const trackingActive = ["ACTIVE", "LOW_ACCURACY", "OFFLINE", "SYNC_PENDING", "SERVER_UNAVAILABLE", "SAMPLE_REJECTED"].includes(tracking.state);
  const trackingSynchronized = tracking.state === "ACTIVE" && tracking.lastConfirmedAt !== null && tracking.pendingCount === 0;
  const trackingTitle = trackingSynchronized ? "GPS activo y sincronizado" : trackingActive ? "GPS activo con sincronización pendiente" : tracking.state === "STOPPED" ? "Seguimiento detenido" : "Seguimiento desactivado";
  const trackingLabel = tracking.state === "REQUESTING_PERMISSION" ? "Solicitando permiso…" : tracking.state === "LOCATING" ? "Buscando ubicación…" : trackingActive ? "Detener seguimiento" : "Iniciar seguimiento GPS";
  const podCanSubmit = !pod || pod.status === "REJECTED";

  return <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>{offline ? <OfflineBanner /> : null}<ScrollView contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Text style={styles.backText}>‹  Mis servicios</Text></Pressable>
    <View style={styles.heading}><View style={styles.grow}><Text style={styles.label}>REFERENCIA</Text><Text style={styles.title}>{item.reference}</Text></View><StatusBadge status={item.status} /></View>
    <View style={styles.card}><DetailRow label="Origen" value={`${item.origin.name} · ${item.origin.address}`} /><DetailRow label="Destino" value={`${item.destination.name} · ${item.destination.address}`} /><DetailRow label="Recogida planificada" value={formatDateTime(item.plannedPickup)} /><DetailRow label="Entrega planificada" value={formatDateTime(item.plannedDelivery)} /><DetailRow label="Mercancía" value={`${item.cargo} · ${item.pallets} palets`} /><DetailRow label="Temperatura" value={temperature} /><DetailRow label="Vehículo" value={item.assignment?.vehiclePlate ?? "Pendiente"} /></View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {accepted ? <View accessibilityRole="alert" style={styles.confirmed}><Text style={styles.confirmedIcon}>✓</Text><Text style={styles.confirmedTitle}>{acceptedNow ? "Servicio aceptado" : "Servicio ya aceptado"}</Text><Text style={styles.confirmedText}>Operaciones tiene la confirmación.</Text></View> : <PrimaryButton title={accepting ? "Confirmando…" : "Aceptar servicio"} busy={accepting} disabled={offline} onPress={() => void accept()} />}

    <View style={styles.trackingCard}><View style={styles.trackingHeader}><View style={styles.grow}><Text style={styles.trackingEyebrow}>SEGUIMIENTO GPS</Text><Text style={styles.trackingTitle}>{trackingTitle}</Text></View><View style={[styles.trackingDot, trackingSynchronized && styles.trackingDotActive]} /></View><Text style={styles.trackingText}>{tracking.message ?? "El conductor decide cuándo compartir su ubicación."}</Text><View style={styles.diagnostics}><Text style={styles.diagnostic}>API: {tracking.apiBaseUrl}</Text><Text style={styles.diagnostic}>Estado: {tracking.state}</Text><Text style={styles.diagnostic}>Sesión GPS: {tracking.trackingSessionId ?? "Sin iniciar"}</Text><Text style={styles.diagnostic}>Último intento: {tracking.lastAttemptAt ? formatDateTime(tracking.lastAttemptAt) : "—"}</Text><Text style={styles.diagnostic}>Última confirmación: {tracking.lastConfirmedAt ? formatDateTime(tracking.lastConfirmedAt) : "—"}</Text><Text style={styles.diagnostic}>HTTP: {tracking.lastHttpStatus ?? "—"}</Text></View>{tracking.lastAccuracy !== null ? <Text style={styles.trackingMeta}>Precisión aproximada: {Math.round(tracking.lastAccuracy)} m</Text> : null}{tracking.pendingCount > 0 ? <Text style={styles.trackingPending}>Pendientes de sincronizar: {tracking.pendingCount}</Text> : null}{tracking.rejectedCount > 0 ? <Text style={styles.trackingRejected}>Muestras rechazadas conservadas: {tracking.rejectedCount}</Text> : null}<PrimaryButton title={trackingLabel} busy={tracking.state === "REQUESTING_PERMISSION" || tracking.state === "LOCATING"} disabled={offline || !item.assignment || ["AUTH_ERROR", "AUTHORIZATION_ERROR", "SESSION_EXPIRED", "ERROR"].includes(tracking.state)} onPress={() => void toggleTracking()} /></View>

    <View style={styles.podCard}><Text style={styles.trackingEyebrow}>PRUEBA DE ENTREGA</Text><Text style={styles.trackingTitle}>{pod ? `POD · ${pod.status}` : "Registrar entrega"}</Text>{pod ? <><Text style={styles.trackingText}>Enviado {formatDateTime(pod.serverSubmittedAt)} · {pod.documents.length} evidencia(s)</Text>{pod.history.at(-1)?.reason ? <Text style={styles.trackingRejected}>Motivo: {pod.history.at(-1)?.reason}</Text> : null}</> : <Text style={styles.trackingText}>Adjunta entre una y cuatro imágenes. No indiques un receptor si no dispones de ese dato.</Text>}{podCanSubmit ? <><View style={styles.choiceRow}><Pressable style={styles.podChoice} onPress={() => void takePhoto()}><Text style={styles.podChoiceText}>Tomar fotografía</Text></Pressable><Pressable style={styles.podChoice} onPress={() => void selectImage()}><Text style={styles.podChoiceText}>Seleccionar imagen</Text></Pressable></View>{evidence.map((asset, index) => <View key={`${asset.uri}-${index}`} style={styles.evidenceRow}><Text style={styles.evidenceText} numberOfLines={1}>{asset.fileName ?? `Evidencia ${index + 1}`}</Text><Pressable onPress={() => setEvidence((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Text style={styles.removeText}>Quitar</Text></Pressable></View>)}<TextInput value={receiverName} onChangeText={setReceiverName} placeholder="Receptor (opcional)" placeholderTextColor={colors.disabled} style={styles.singleInput} maxLength={160} /><TextInput value={observations} onChangeText={setObservations} placeholder="Observaciones de la entrega" placeholderTextColor={colors.disabled} style={styles.incidentInput} multiline maxLength={2000} /><PrimaryButton title={submittingPod ? "Enviando POD…" : "Enviar prueba de entrega"} busy={submittingPod} disabled={offline || evidence.length === 0} onPress={() => void submitPod()} /></> : null}{podMessage ? <Text accessibilityRole="alert" style={styles.trackingText}>{podMessage}</Text> : null}<SecondaryButton title="Abrir documentos del servicio" onPress={() => router.push({ pathname: "/services/[id]/documents", params: { id } })} /></View>

    <View style={styles.incidentCard}><Text style={styles.trackingEyebrow}>COMUNICAR INCIDENCIA</Text><View style={styles.choiceRow}>{(["DELAY", "BREAKDOWN", "LOADING_PROBLEM", "UNLOADING_PROBLEM", "WRONG_ADDRESS", "DOCUMENT_PROBLEM", "OTHER"] as IncidentType[]).map((type) => <Pressable key={type} onPress={() => setIncidentType(type)} style={[styles.choice, incidentType === type && styles.choiceActive]}><Text style={[styles.choiceText, incidentType === type && styles.choiceTextActive]}>{INCIDENT_LABELS[type]}</Text></Pressable>)}</View><View style={styles.choiceRow}>{(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as IncidentPriority[]).map((priority) => <Pressable key={priority} onPress={() => setIncidentPriority(priority)} style={[styles.choice, incidentPriority === priority && styles.choiceActive]}><Text style={[styles.choiceText, incidentPriority === priority && styles.choiceTextActive]}>{priority}</Text></Pressable>)}</View><TextInput accessibilityLabel="Descripción de la incidencia" multiline value={incidentDescription} onChangeText={setIncidentDescription} placeholder="Describe qué ocurre y dónde" placeholderTextColor={colors.disabled} style={styles.incidentInput} />{incidentMessage ? <Text accessibilityRole="alert" style={styles.trackingText}>{incidentMessage}</Text> : null}<PrimaryButton title={sendingIncident ? "Enviando…" : "Enviar incidencia"} busy={sendingIncident} disabled={offline || incidentDescription.trim().length < 5} onPress={() => void reportIncident()} /></View>
    <Text style={styles.note}>El GPS funciona en primer plano con permiso explícito. El seguimiento en segundo plano se preparará para Development Build en v0.6.5.</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, paddingBottom: 40 }, back: { minHeight: 48, alignSelf: "flex-start", justifyContent: "center" }, backText: { color: colors.primary, fontSize: 15, fontWeight: "800" },
  heading: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginVertical: 17 }, grow: { flex: 1 }, label: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1 }, title: { color: colors.ink, fontSize: 28, fontWeight: "900", marginTop: 5 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 22, paddingHorizontal: 18, marginBottom: 18 }, error: { color: colors.danger, backgroundColor: colors.dangerSoft, borderRadius: 12, padding: 12, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  confirmed: { backgroundColor: colors.successSoft, borderRadius: 20, padding: 20, alignItems: "center" }, confirmedIcon: { width: 38, height: 38, borderRadius: 19, textAlign: "center", textAlignVertical: "center", color: "#fff", backgroundColor: colors.success, fontSize: 24, fontWeight: "900" }, confirmedTitle: { color: colors.success, fontSize: 20, fontWeight: "900", marginTop: 10 }, confirmedText: { color: colors.success, fontSize: 14, marginTop: 4 },
  trackingCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, marginTop: 18, gap: 9 }, trackingHeader: { flexDirection: "row", alignItems: "center" }, trackingEyebrow: { color: colors.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 }, trackingTitle: { color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 5 }, trackingDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.disabled }, trackingDotActive: { backgroundColor: colors.success }, trackingText: { color: colors.muted, fontSize: 13, lineHeight: 19 }, diagnostics: { borderRadius: 12, backgroundColor: colors.background, padding: 10, gap: 4 }, diagnostic: { color: colors.muted, fontSize: 11 }, trackingMeta: { color: colors.text, fontSize: 12 }, trackingPending: { color: colors.warning, fontSize: 12, fontWeight: "800" }, trackingRejected: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  podCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, marginTop: 18, gap: 12 }, podChoice: { flexGrow: 1, minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 }, podChoiceText: { color: colors.primary, fontWeight: "800", fontSize: 13 }, evidenceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, backgroundColor: colors.background, borderRadius: 12, padding: 10 }, evidenceText: { color: colors.text, fontSize: 12, flex: 1 }, removeText: { color: colors.danger, fontSize: 12, fontWeight: "800" }, singleInput: { minHeight: 48, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, color: colors.ink },
  incidentCard: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 18, marginTop: 18, gap: 12 }, choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, choice: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }, choiceActive: { backgroundColor: colors.primary, borderColor: colors.primary }, choiceText: { color: colors.text, fontSize: 10, fontWeight: "800" }, choiceTextActive: { color: "#fff" }, incidentInput: { minHeight: 96, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, color: colors.ink, textAlignVertical: "top" }, note: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 18, paddingHorizontal: 16 },
});
