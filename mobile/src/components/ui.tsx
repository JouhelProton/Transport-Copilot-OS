import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View, type PressableProps } from "react-native";
import { colors } from "@/theme/colors";
import type { ServiceStatus } from "@/types/api";

export function Screen({ children }: PropsWithChildren) {
  return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
}

export function Brand() {
  return <View style={styles.brand}><View style={styles.brandMark}><Text style={styles.brandMarkText}>TC</Text></View><View><Text style={styles.brandName}>Transport Copilot</Text><Text style={styles.brandRole}>DRIVER</Text></View></View>;
}

export function PrimaryButton({ title, busy, ...props }: PressableProps & { title: string; busy?: boolean }) {
  const disabled = props.disabled || busy;
  return <Pressable accessibilityRole="button" {...props} disabled={disabled} style={({ pressed }) => [styles.button, pressed && !disabled && styles.buttonPressed, disabled && styles.buttonDisabled]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{title}</Text>}</Pressable>;
}

export function SecondaryButton({ title, ...props }: PressableProps & { title: string }) {
  return <Pressable accessibilityRole="button" {...props} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryPressed]}><Text style={styles.secondaryText}>{title}</Text></Pressable>;
}

export function OfflineBanner() {
  return <View accessibilityRole="alert" style={styles.offline}><Text style={styles.offlineText}>SIN CONEXIÓN · Acciones desactivadas</Text></View>;
}

export function StatusBadge({ status }: { status: ServiceStatus }) {
  const accepted = status === "DRIVER_ACCEPTED";
  return <View style={[styles.badge, accepted ? styles.badgeAccepted : styles.badgePending]}><Text style={[styles.badgeText, accepted ? styles.acceptedText : styles.pendingText]}>{accepted ? "ACEPTADO" : status === "ASSIGNED" ? "PENDIENTE" : "PLANIFICADO"}</Text></View>;
}

export function LoadingScreen({ label = "Cargando…" }: { label?: string }) {
  return <Screen><View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.stateMessage}>{label}</Text></View></Screen>;
}

export function StateScreen({ eyebrow, title, message, actionLabel, onAction, extra }: { eyebrow?: string; title: string; message: string; actionLabel?: string; onAction?: () => void; extra?: ReactNode }) {
  return <Screen><View style={styles.center}><View style={styles.stateCard}>{eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}<Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateMessage}>{message}</Text>{actionLabel && onAction ? <PrimaryButton title={actionLabel} onPress={onAction} /> : null}{extra}</View></View></Screen>;
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, center: { flex: 1, justifyContent: "center", padding: 24, gap: 14 },
  brand: { flexDirection: "row", alignItems: "center", gap: 12 }, brandMark: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" },
  brandMarkText: { color: "#fff", fontSize: 14, fontWeight: "800", letterSpacing: 1 }, brandName: { color: colors.ink, fontSize: 17, fontWeight: "800" }, brandRole: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 2 },
  button: { minHeight: 56, borderRadius: 17, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 }, buttonPressed: { backgroundColor: colors.primaryPressed, transform: [{ scale: 0.99 }] }, buttonDisabled: { backgroundColor: colors.disabled }, buttonText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  secondaryButton: { minHeight: 48, borderRadius: 15, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 }, secondaryPressed: { backgroundColor: colors.background }, secondaryText: { color: colors.ink, fontSize: 15, fontWeight: "700" },
  offline: { backgroundColor: colors.warningSoft, paddingHorizontal: 16, paddingVertical: 11 }, offlineText: { color: colors.warning, fontSize: 12, fontWeight: "800", textAlign: "center", letterSpacing: 0.5 },
  badge: { alignSelf: "flex-start", paddingVertical: 7, paddingHorizontal: 10, borderRadius: 999 }, badgeAccepted: { backgroundColor: colors.successSoft }, badgePending: { backgroundColor: colors.warningSoft }, badgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }, acceptedText: { color: colors.success }, pendingText: { color: colors.warning },
  stateCard: { backgroundColor: colors.surface, padding: 24, borderRadius: 24, borderWidth: 1, borderColor: colors.border, gap: 16 }, eyebrow: { color: colors.primary, fontSize: 12, fontWeight: "800", letterSpacing: 1.5, textTransform: "uppercase" }, stateTitle: { color: colors.ink, fontSize: 25, lineHeight: 31, fontWeight: "800" }, stateMessage: { color: colors.muted, fontSize: 15, lineHeight: 23, textAlign: "center" },
  detail: { paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, detailLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 }, detailValue: { color: colors.text, fontSize: 16, lineHeight: 23, fontWeight: "600", marginTop: 5 },
});
