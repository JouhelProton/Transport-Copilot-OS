import { useEffect, useRef, useState } from "react";
import { MapPin, Truck } from "lucide-react";
import type { Service } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { DemoBadge } from "./ui";
import { fmtTime } from "@/lib/domain/projections";

type MapService = Pick<Service, "id" | "origin" | "destination" | "position">;
type MapMode = "geo" | "sat";
type LatLng = { lat: number; lng: number };

interface GoogleMapInstance {
  fitBounds(bounds: GoogleBounds, padding?: number): void;
}
interface GoogleBounds {
  extend(point: LatLng): void;
}
interface GoogleOverlay {
  setMap(map: null): void;
}
interface GoogleMapsNamespace {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapInstance;
  Marker: new (options: Record<string, unknown>) => GoogleOverlay;
  Polyline: new (options: Record<string, unknown>) => GoogleOverlay;
  LatLngBounds: new () => GoogleBounds;
}

declare global {
  interface Window {
    google?: { maps: GoogleMapsNamespace };
    __transportCopilotGoogleMapsReady?: () => void;
  }
}

let googleMapsPromise: Promise<GoogleMapsNamespace> | undefined;

function loadGoogleMaps(apiKey: string) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const callbackName = "__transportCopilotGoogleMapsReady";
    const previousScript = document.querySelector<HTMLScriptElement>(
      "script[data-transport-google-maps]",
    );

    window[callbackName] = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps no devolvió la librería esperada."));
    };

    if (previousScript) return;

    const script = document.createElement("script");
    script.dataset.transportGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&language=es&region=ES&callback=${callbackName}`;
    script.onerror = () => {
      googleMapsPromise = undefined;
      reject(new Error("No se pudo cargar Google Maps."));
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

/** Google Maps representa posiciones recibidas; no obtiene ni inventa GPS. */
export function MapView({
  services,
  className,
  height = "h-80",
}: {
  services: MapService[];
  className?: string;
  height?: string;
}) {
  const [mode, setMode] = useState<MapMode>("geo");
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

  if (!apiKey)
    return (
      <SchematicMap
        services={services}
        mode={mode}
        setMode={setMode}
        height={height}
        className={className}
      />
    );
  return (
    <GoogleMap
      services={services}
      mode={mode}
      setMode={setMode}
      apiKey={apiKey}
      height={height}
      className={className}
    />
  );
}

function GoogleMap({
  services,
  mode,
  setMode,
  apiKey,
  className,
  height,
}: {
  services: MapService[];
  mode: MapMode;
  setMode: (mode: MapMode) => void;
  apiKey: string;
  className?: string;
  height: string;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    const overlays: GoogleOverlay[] = [];

    void loadGoogleMaps(apiKey)
      .then((maps) => {
        if (cancelled || !canvasRef.current) return;

        const first = services.find((service) => service.position)?.position ?? services[0]?.origin;
        const map = new maps.Map(canvasRef.current, {
          center: first ? { lat: first.lat, lng: first.lng } : { lat: 40.2, lng: -3.7 },
          zoom: first ? 7 : 5,
          mapTypeId: mode === "sat" ? "satellite" : "roadmap",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          gestureHandling: "cooperative",
        });
        const bounds = new maps.LatLngBounds();
        let pointCount = 0;

        const addMarker = (position: LatLng, title: string, label?: string) => {
          bounds.extend(position);
          pointCount += 1;
          overlays.push(new maps.Marker({ position, map, title, label }));
        };

        services.forEach((service) => {
          addMarker(service.origin, `Origen · ${service.origin.name}`);
          addMarker(service.destination, `Destino · ${service.destination.name}`);
          overlays.push(
            new maps.Polyline({
              path: [service.origin, service.destination],
              map,
              strokeColor: "#2563eb",
              strokeOpacity: 0.72,
              strokeWeight: 3,
              geodesic: true,
            }),
          );
          if (service.position)
            addMarker(service.position, `${service.id} · ${fmtTime(service.position.at)}`, "●");
        });

        if (pointCount > 1) map.fitBounds(bounds, 56);
        setError(undefined);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof Error ? reason.message : "No se pudo cargar Google Maps.");
      });

    return () => {
      cancelled = true;
      overlays.forEach((overlay) => overlay.setMap(null));
    };
  }, [apiKey, mode, services]);

  return (
    <div className={cn("relative overflow-hidden rounded-xl border bg-muted", height, className)}>
      <div
        ref={canvasRef}
        className="absolute inset-0"
        aria-label="Mapa de Google con las posiciones de los servicios"
      />
      <MapControls mode={mode} setMode={setMode} />
      <DemoPositionBadge services={services} />
      {error && (
        <p
          role="alert"
          className="absolute inset-x-3 bottom-3 rounded-lg bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow-card"
        >
          {error} Revisa la clave y sus restricciones en Google Cloud.
        </p>
      )}
      {!error && (
        <p className="absolute bottom-2 left-3 rounded bg-card/90 px-2 py-0.5 text-xs text-muted-foreground shadow-card">
          Google Maps · posiciones recibidas por la plataforma
        </p>
      )}
    </div>
  );
}

const px = (lng: number) => ((lng + 9.5) / 13) * 100;
const py = (lat: number) => ((43.8 - lat) / 7.8) * 100;

function SchematicMap({
  services,
  mode,
  setMode,
  className,
  height,
}: {
  services: MapService[];
  mode: MapMode;
  setMode: (mode: MapMode) => void;
  className?: string;
  height: string;
}) {
  const sat = mode === "sat";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border",
        height,
        sat ? "map-sat" : "map-geo",
        className,
      )}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        {services.map((service) => (
          <line
            key={service.id}
            x1={px(service.origin.lng)}
            y1={py(service.origin.lat)}
            x2={px(service.destination.lng)}
            y2={py(service.destination.lat)}
            className={sat ? "stroke-ink-foreground" : "stroke-primary"}
            strokeWidth="0.6"
            strokeDasharray="1.5 1"
          />
        ))}
      </svg>
      {services.map((service) => (
        <div key={service.id}>
          <Pin
            x={px(service.origin.lng)}
            y={py(service.origin.lat)}
            label={service.origin.name.split(" —")[0]}
            sat={sat}
          />
          <Pin
            x={px(service.destination.lng)}
            y={py(service.destination.lat)}
            label={service.destination.name.split(" —")[0]}
            sat={sat}
            dest
          />
          {service.position && (
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${px(service.position.lng)}%`, top: `${py(service.position.lat)}%` }}
            >
              <div className="flex flex-col items-center">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-card ring-4 ring-primary/25">
                  <Truck className="h-4.5 w-4.5" aria-hidden />
                </span>
                <span className="mt-1 whitespace-nowrap rounded bg-card px-1.5 py-0.5 text-xs font-medium shadow-card">
                  {service.id} · {fmtTime(service.position.at)}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
      <MapControls mode={mode} setMode={setMode} />
      <DemoPositionBadge services={services} />
      <p className="absolute bottom-2 left-3 rounded bg-card/90 px-2 py-0.5 text-xs text-muted-foreground">
        Configura VITE_GOOGLE_MAPS_API_KEY para activar Google Maps
      </p>
    </div>
  );
}

function MapControls({ mode, setMode }: { mode: MapMode; setMode: (mode: MapMode) => void }) {
  return (
    <div
      className="absolute left-3 top-3 z-10 flex rounded-lg bg-card p-1 text-sm shadow-card"
      role="group"
      aria-label="Tipo de mapa"
    >
      {(["geo", "sat"] as const).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setMode(item)}
          aria-pressed={mode === item}
          className={cn(
            "rounded-md px-3 py-1 font-medium",
            mode === item ? "bg-ink text-ink-foreground" : "text-muted-foreground",
          )}
        >
          {item === "geo" ? "Mapa" : "Satélite"}
        </button>
      ))}
    </div>
  );
}

function DemoPositionBadge({ services }: { services: MapService[] }) {
  return (
    <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1">
      {services.some((service) => service.position?.simulated) && (
        <DemoBadge label="Posición DEMO simulada" />
      )}
    </div>
  );
}

function Pin({
  x,
  y,
  label,
  sat,
  dest,
}: {
  x: number;
  y: number;
  label: string;
  sat: boolean;
  dest?: boolean;
}) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-full"
      style={{ left: `${x}%`, top: `${y}%` }}
    >
      <div className="flex flex-col items-center">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-medium",
            sat ? "bg-ink text-ink-foreground" : "bg-card shadow-card",
          )}
        >
          {label}
        </span>
        <MapPin className={cn("h-5 w-5", dest ? "text-success" : "text-ink")} aria-hidden />
      </div>
    </div>
  );
}
