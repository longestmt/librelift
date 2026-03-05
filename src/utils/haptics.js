import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

/**
 * Haptics utility — tries Capacitor's plugin first, then falls back
 * to navigator.vibrate() directly for PWA/web contexts.
 */

function vibrateFallback(pattern) {
    try {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    } catch (_) { }
}

/** Light tap — tab switches, minor buttons */
export async function hapticLight() {
    try {
        await Haptics.impact({ style: ImpactStyle.Light });
    } catch (_) {
        vibrateFallback(20);
    }
    // Always try direct vibration as backup on web
    vibrateFallback(20);
}

/** Medium tap — starting a workout, opening modals */
export async function hapticMedium() {
    try {
        await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (_) {
        vibrateFallback(40);
    }
    vibrateFallback(40);
}

/** Heavy tap — completing a set */
export async function hapticHeavy() {
    try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (_) {
        vibrateFallback(60);
    }
    vibrateFallback(60);
}

/** Success pattern — finishing a workout */
export async function hapticSuccess() {
    try {
        await Haptics.notification({ type: NotificationType.Success });
    } catch (_) {
        vibrateFallback([35, 65, 21]);
    }
    vibrateFallback([35, 65, 21]);
}

/** Error pattern */
export async function hapticError() {
    try {
        await Haptics.notification({ type: NotificationType.Error });
    } catch (_) {
        vibrateFallback([27, 45, 50]);
    }
    vibrateFallback([27, 45, 50]);
}
