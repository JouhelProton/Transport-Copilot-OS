import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Satellite, Wifi, WifiOff } from "lucide-react";
import type { ApiTrackingPosition, ApiTrackingSession } from "@/lib/api/operations";
import { cn } from "@/lib/utils";

type MapMode = "geo" | "sat";
type LatLng = { lat: number; lng: number };
interface GoogleMap { fitBounds(bounds: GoogleBounds, padding?: number): void; }
interface GoogleBounds { extend(point: LatLng): void; }
interface GoogleOverlay { setMap(map: null): void; }
interface GoogleMaps { Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMap; Marker: new (options: Record<string, unknown>) => GoogleOverlay; Polyline: new (options: Record<string, unknown>) => GoogleOverlay; LatLngBounds: new () => GoogleBounds; }

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

function statusFor(position: ApiTrackingPosition | null) {
  if (!position) return { label: "SIN POSICIÓN", className: "bg-muted text-muted-foreground" };
  const age = Date.now() - new Date(position.recordedAt).getTime();
  if (age > 90_000) return { label: "POSICIÓN DESACTUALIZADA", className: "bg-amber-100 text-amber-800" };
  return { label: "GPS REAL", className: "bg-emerald-100 text-emerald-800" };
}

export function LiveTrackingMap({ position, history, session, className }: { position: ApiTrackingPosition | null; history: ApiTrackingPosition[]; session: ApiTrackingSession | null; className?: string }) {
  const [mode, setMode] = useState<MapMode>("geo");
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();
  const status = statusFor(position);
  const lastUpdate = position ? new Date(position.recordedAt).toLocaleString("es-ES") : null;
  if (!apiKey) return <TrackingFallback position={position} history={history} session={session} className={className} />;
  return <GoogleTrackingMap apiKey={apiKey} mode={mode} setMode={setMode} position={position} history={history} session={session} status={status} lastUpdate={lastUpdate} className={className} />;
}

function GoogleTrackingMap({ apiKey, mode, setMode, position, history, session, status, lastUpdate, className }: { apiKey: string; mode: MapMode; setMode: (mode: MapMode) => void; position: ApiTrackingPosition | null; history: ApiTrackingPosition[]; session: ApiTrackingSession | null; status: { label: string; className: string }; lastUpdate: string | null; className?: string }) {
  const canvas = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const overlays: GoogleOverlay[] = [];
    void loadMaps(apiKey).then((maps) => {
      if (cancelled || !canvas.current) return;
      const points = [...history, ...(position ? [position] : [])];
      const center = position ? { lat: position.latitude, lng: position.longitude } : { lat: 40.2, lng: -3.7 };
      const map = new maps.Map(canvas.current, { center, zoom: position ? 12 : 6, mapTypeId: mode === "sat" ? "satellite" : "roadmap", mapTypeControl: false, streetViewControl: false, fullscreenControl: true, zoomControl: true, gestureHandling: "cooperative" });
      if (points.length) {
        const bounds = new maps.LatLngBounds();
        points.forEach((item) => bounds.extend({ lat: item.latitude, lng: item.longitude }));
        if (points.length > 1) map.fitBounds(bounds, 48);
        overlays.push(new maps.Polyline({ path: points.map((item) => ({ lat: item.latitude, lng: item.longitude })), map, strokeColor: "#3157D5", strokeOpacity: 0.72, strokeWeight: 4, geodesic: true }));
      }
      if (position) overlays.push(new maps.Marker({ position: { lat: position.latitude, lng: position.longitude }, map, title: "Última posición GPS real", label: "●" }));
      setError(null);
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "No se pudo cargar Google Maps"); });
    return () => { cancelled = true; overlays.forEach((overlay) => overlay.setMap(null)); };
  }, [apiKey, history, mode, position]);
  return <div className={cn("relative min-h-[420px] overflow-hidden rounded-xl border bg-muted", className)}><div ref={canvas} className="absolute inset-0" aria-label="Mapa Google Maps con tracking GPS real" /><div className="absolute left-3 top-3 z-10 flex gap-1 rounded-lg bg-card p-1 shadow-card"><button type="button" className={cn("rounded-md px-3 py-1.5 text-sm", mode === "geo" && "bg-ink text-ink-foreground")} onClick={() => setMode("geo")}>Mapa</button><button type="button" className={cn("rounded-md px-3 py-1.5 text-sm", mode === "sat" && "bg-ink text-ink-foreground")} onClick={() => setMode("sat")}><Satellite className="mr-1 inline h-3.5 w-3.5" />Satélite</button></div><div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg bg-card/95 px-3 py-2 text-xs font-bold shadow-card"><span className={cn("rounded-full px-2 py-1", status.className)}>{status.label}</span>{session?.status === "ACTIVE" ? <Wifi className="h-4 w-4 text-emerald-600" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}</div><div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-card"><span>{session?.status === "ACTIVE" ? "Seguimiento activo" : "Seguimiento detenido"}</span>{lastUpdate ? <span>Última muestra: {lastUpdate}</span> : null}<span>Histórico: {history.length} puntos</span></div>{error ? <p role="alert" className="absolute bottom-16 left-3 right-3 rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground">{error}. Comprueba la configuración de Google Maps.</p> : null}</div>;
}

function TrackingFallback({ position, history, session, className }: { position: ApiTrackingPosition | null; history: ApiTrackingPosition[]; session: ApiTrackingSession | null; className?: string }) {
  const status = statusFor(position);
  const coords = useMemo(() => position ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` : "Todavía no hay una posición recibida", [position]);
  return <div className={cn("flex min-h-[300px] flex-col justify-between rounded-xl border bg-card p-5", className)}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-widest text-primary">TRACKING GPS</p><h3 className="mt-1 text-lg font-bold">Google Maps pendiente de configuración</h3></div><MapPin className="h-5 w-5 text-primary" /></div><div className="space-y-3 text-sm"><p className="font-semibold">{status.label}</p><p className="text-muted-foreground">{coords}</p><p className="text-muted-foreground">Estado de sesión: {session?.status ?? "SIN INICIAR"} · Histórico: {history.length} puntos</p></div><p className="text-xs text-muted-foreground">Añade VITE_GOOGLE_MAPS_API_KEY al entorno del frontend para mostrar el mapa. Los datos GPS recibidos siguen siendo consultables y no se sustituye por una posición simulada.</p></div>;
}
