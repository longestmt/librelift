import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const isNative = Capacitor.isNativePlatform();

/**
 * Fallback vibration for web/PWA (Android Chrome only)
 */
function webVibrate(pattern) {
    try {
        if (navigator.vibrate) navigator.vibrate(pattern);
    } catch (_) { /* ignore */ }
}

/**
 * Trigger a very light haptic click (e.g. standard button taps, tab navigation)
 */
export async function hapticLight() {
    if (isNative) {
        try { await Haptics.impact({ style: ImpactStyle.Light }); } catch (_) { }
    } else {
        webVibrate(10);
    }
}

/**
 * Trigger a medium haptic click (e.g. starting a workout, opening a modal)
 */
export async function hapticMedium() {
    if (isNative) {
        try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (_) { }
    } else {
        webVibrate(20);
    }
}

/**
 * Trigger a heavy haptic click (e.g. completing a set, deleting an item)
 */
export async function hapticHeavy() {
    if (isNative) {
        try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch (_) { }
    } else {
        webVibrate([30, 50, 30]);
    }
}

/**
 * Trigger a success haptic pattern (e.g. finishing a workout, saving settings)
 */
export async function hapticSuccess() {
    if (isNative) {
        try { await Haptics.notification({ type: 'SUCCESS' }); } catch (_) { }
    } else {
        webVibrate([40, 80, 50]);
    }
}

/**
 * Trigger a warning/error haptic pattern
 */
export async function hapticError() {
    if (isNative) {
        try { await Haptics.notification({ type: 'ERROR' }); } catch (_) { }
    } else {
        webVibrate([20, 40, 20, 40, 50]);
    }
}
