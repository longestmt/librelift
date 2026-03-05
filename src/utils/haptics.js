import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Haptics utility — uses Capacitor's built-in web implementation
 * which calls navigator.vibrate() on the web automatically.
 * On native (Android/iOS), it uses the real haptic engine.
 */

/** Light tap — tab switches, minor buttons */
export async function hapticLight() {
    try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (_) { }
}

/** Medium tap — starting a workout, opening modals */
export async function hapticMedium() {
    try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (_) { }
}

/** Heavy tap — completing a set */
export async function hapticHeavy() {
    try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch (_) { }
}

/** Success pattern — finishing a workout */
export async function hapticSuccess() {
    try { await Haptics.notification({ type: NotificationType.Success }); } catch (_) { }
}

/** Error pattern */
export async function hapticError() {
    try { await Haptics.notification({ type: NotificationType.Error }); } catch (_) { }
}
