import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Satellite, Wifi, WifiOff } from "lucide-react";
import type { ApiTrackingPosition, ApiTrackingSession } from "@/lib/api/operations";
import { cn } from "@/lib/utils";

type MapMode = "geo" | "sat";
type LatLng = { lat: number; lng: number };
interface GoogleMap { fitBounds(bounds: GoogleBounds, padding?: number): void; }
interface GoogleBounds { extend(point: LatLng): void; }
interface GoogleOverlay { setMap(map: null): void; addListener?(event: string, callback: () => void): void; }
interface GoogleInfoWindow { open(options: { anchor: GoogleOverlay; map: GoogleMap }): void; close(): void; }
interface GoogleMaps {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap;
  Marker: new (options: Record<string, unknown>) => GoogleOverlay;
  InfoWindow: new (options: { content: string }) => GoogleInfoWindow;
  Polyline: new (options: Record<string, unknown>) => GoogleOverlay;
  LatLngBounds: new () => GoogleBounds;
  Point: new (x: number, y: number) => unknown;
  Size: new (width: number, height: number) => unknown;
}

declare global {
  interface Window { google?: { maps: GoogleMaps }; __nexoGoogleMapsReady?: () => void; }
}

let mapsPromise: Promise<GoogleMaps> | undefined;

function loadMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise((resolve, reject) => {
    const callback = "__nexoGoogleMapsReady";
    window[callback] = () => window.google?.maps ? resolve(window.google.maps) : reject(new Error("Google Maps no disponible"));
    const script = document.createElement("script");
    script.dataset.nexoGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&language=es&region=ES&callback=${callback}`;
    script.onerror = () => { mapsPromise = undefined; reject(new Error("No se pudo cargar Google Maps")); };
    document.head.appendChild(script);
  });
  return mapsPromise;
}

export function trackingMapStatus(position: ApiTrackingPosition | null, session: ApiTrackingSession | null, now = Date.now()) {
  if (!position) return { label: "SIN POSICIÓN", tone: "none" as const, className: "bg-muted text-muted-foreground" };
  if (session?.status !== "ACTIVE") return { label: "TRACKING DETENIDO", tone: "stopped" as const, className: "bg-slate-200 text-slate-700" };
  const age = now - new Date(position.recordedAt).getTime();
  if (age > 90_000) return { label: "GPS DESACTUALIZADO", tone: "stale" as const, className: "bg-amber-100 text-amber-800" };
  return { label: "GPS ACTUALIZADO", tone: "live" as const, className: "bg-emerald-100 text-emerald-800" };
}

export function nextVehicleHeading(previous: number | null, heading: number | null) {
  if (heading === null || !Number.isFinite(heading) || heading < 0 || heading > 360) return previous ?? 0;
  if (previous === null) return heading;
  const delta = ((heading - previous + 540) % 360) - 180;
  return (previous + delta * 0.65 + 360) % 360;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}

function truckMarkerDataUrl(heading: number, tone: "live" | "stale" | "stopped" | "none") {
  const primary = tone === "live" ? "#3157D5" : tone === "stale" ? "#B7791F" : "#64748B";
  const opacity = tone === "stale" ? 0.78 : tone === "stopped" ? 0.72 : 1;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><g transform="rotate(${heading.toFixed(1)} 32 32)" opacity="${opacity}"><circle cx="32" cy="32" r="29" fill="white" stroke="${primary}" stroke-width="3"/><path d="M25 47V21c0-3 2-5 5-5h4c3 0 5 2 5 5v26H25Z" fill="${primary}"/><path d="M27.5 25h9v8h-9z" fill="#DCE7FF"/><path d="M22 36h4v9h-4zm16 0h4v9h-4z" fill="#14213D"/><circle cx="24" cy="45" r="2.4" fill="#14213D"/><circle cx="40" cy="45" r="2.4" fill="#14213D"/><path d="m32 8 5 7H27l5-7Z" fill="${primary}"/></g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

interface LiveTrackingMapProps {
  position: ApiTrackingPosition | null;
  history: ApiTrackingPosition[];
  session: ApiTrackingSession | null;
  serviceReference: string;
  driverName: string;
  operationalStatus: string;
  className?: string;
}

export function LiveTrackingMap({ position, history, session, serviceReference, driverName, operationalStatus, className }: LiveTrackingMapProps) {
  const [mode, setMode] = useState<MapMode>("geo");
  const lastHeading = useRef<number | null>(null);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const status = trackingMapStatus(position, session);
  const heading = nextVehicleHeading(lastHeading.current, position?.heading ?? null);
  if (position?.heading !== null && position?.heading !== undefined) lastHeading.current = heading;
  const lastUpdate = position ? new Date(position.recordedAt).toLocaleString("es-ES") : null;
  if (!apiKey) return <TrackingFallback position={position} history={history} session={session} className={className} />;
  return <GoogleTrackingMap apiKey={apiKey} mode={mode} setMode={setMode} position={position} history={history} session={session} status={status} heading={heading} serviceReference={serviceReference} driverName={driverName} operationalStatus={operationalStatus} lastUpdate={lastUpdate} className={className} />;
}

function GoogleTrackingMap({ apiKey, mode, setMode, position, history, session, status, heading, serviceReference, driverName, operationalStatus, lastUpdate, className }: LiveTrackingMapProps & { apiKey: string; mode: MapMode; setMode: (mode: MapMode) => void; status: ReturnType<typeof trackingMapStatus>; heading: number; lastUpdate: string | null }) {
  const canvas = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const overlays: GoogleOverlay[] = [];
    let infoWindow: GoogleInfoWindow | null = null;
    void loadMaps(apiKey).then((maps) => {
      if (cancelled || !canvas.current) return;
      const points = [...history, ...(position ? [position] : [])];
      const center = position ? { lat: position.latitude, lng: position.longitude } : { lat: 40.2, lng: -3.7 };
      const map = new maps.Map(canvas.current, { center, zoom: position ? 12 : 6, mapTypeId: mode === "sat" ? "satellite" : "roadmap", mapTypeControl: false, streetViewControl: false, fullscreenControl: true, zoomControl: true, gestureHandling: "cooperative" });
      if (points.length) {
        const bounds = new maps.LatLngBounds();
        points.forEach((item) => bounds.extend({ lat: item.latitude, lng: item.longitude }));
        if (points.length > 1) map.fitBounds(bounds, 48);
        overlays.push(new maps.Polyline({ path: points.map((item) => ({ lat: item.latitude, lng: item.longitude })), map, strokeColor: status.tone === "live" ? "#3157D5" : "#64748B", strokeOpacity: status.tone === "live" ? 0.75 : 0.45, strokeWeight: 4, geodesic: true }));
      }
      if (position) {
        const marker = new maps.Marker({ position: { lat: position.latitude, lng: position.longitude }, map, title: `${serviceReference} · ${status.label}`, icon: { url: truckMarkerDataUrl(heading, status.tone), scaledSize: new maps.Size(58, 58), anchor: new maps.Point(29, 29) }, zIndex: 10 });
        const speed = position.speed === null ? "No disponible" : `${Math.max(0, position.speed * 3.6).toFixed(1)} km/h`;
        infoWindow = new maps.InfoWindow({ content: `<div style="font:13px system-ui;line-height:1.55;min-width:220px"><strong style="color:#14213D">${escapeHtml(serviceReference)}</strong><br><span>${escapeHtml(driverName)}</span><hr style="border:0;border-top:1px solid #e5e7eb"><b>${escapeHtml(status.label)}</b><br>${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}<br>Actualización: ${escapeHtml(new Date(position.recordedAt).toLocaleString("es-ES"))}<br>Precisión: ${Math.round(position.accuracy)} m · Velocidad: ${speed}<br>Estado: ${escapeHtml(operationalStatus)}</div>` });
        marker.addListener?.("click", () => infoWindow?.open({ anchor: marker, map }));
        overlays.push(marker);
      }
      setError(null);
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar Google Maps"); });
    return () => { cancelled = true; infoWindow?.close(); overlays.forEach((overlay) => overlay.setMap(null)); };
  }, [apiKey, driverName, heading, history, mode, operationalStatus, position, serviceReference, status.label, status.tone]);
  return <div className={cn("relative min-h-[420px] overflow-hidden rounded-xl border bg-muted", className)}><div ref={canvas} className="absolute inset-0" aria-label="Mapa Google Maps con tracking GPS real" /><div className="absolute left-3 top-3 z-10 flex gap-1 rounded-lg bg-card p-1 shadow-card"><button type="button" className={cn("rounded-md px-3 py-1.5 text-sm", mode === "geo" && "bg-ink text-ink-foreground")} onClick={() => setMode("geo")}>Mapa</button><button type="button" className={cn("rounded-md px-3 py-1.5 text-sm", mode === "sat" && "bg-ink text-ink-foreground")} onClick={() => setMode("sat")}><Satellite className="mr-1 inline h-3.5 w-3.5" />Satélite</button></div><div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg bg-card/95 px-3 py-2 text-xs font-bold shadow-card"><span className={cn("rounded-full px-2 py-1", status.className)}>{status.label}</span>{session?.status === "ACTIVE" ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}</div><div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-card"><span>{session?.status === "ACTIVE" ? "Seguimiento activo" : "Seguimiento detenido"}</span>{lastUpdate ? <span>Última muestra: {lastUpdate}</span> : null}<span>Histórico: {history.length} puntos</span><span>Pulsa el camión para ver detalles</span></div>{error ? <p role="alert" className="absolute bottom-16 left-3 right-3 rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground">{error}. Comprueba la configuración de Google Maps.</p> : null}</div>;
}

function TrackingFallback({ position, history, session, className }: { position: ApiTrackingPosition | null; history: ApiTrackingPosition[]; session: ApiTrackingSession | null; className?: string }) {
  const status = trackingMapStatus(position, session);
  const coords = useMemo(() => position ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` : "Todavía no hay una posición recibida", [position]);
  return <div className={cn("flex min-h-[300px] flex-col justify-between rounded-xl border bg-card p-5", className)}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-primary">TRACKING GPS</p><h3 className="mt-1 text-lg font-bold">Google Maps pendiente de configuración</h3></div><MapPin className="h-5 w-5 text-primary" /></div><div className="space-y-3 text-sm"><p className="font-semibold">{status.label}</p><p className="text-muted-foreground">{coords}</p><p className="text-muted-foreground">Estado de sesión: {session?.status ?? "SIN INICIAR"} · Histórico: {history.length} puntos</p></div><p className="text-xs text-muted-foreground">Añade VITE_GOOGLE_MAPS_API_KEY al entorno del frontend para mostrar el mapa. Los datos GPS recibidos siguen siendo consultables y no se sustituye por una posición simulada.</p></div>;
}
