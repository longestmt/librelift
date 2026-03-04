import { Haptics, ImpactStyle } from '@capacitor/haptics';

/**
 * Trigger a very light haptic click (e.g. standard button taps, tab navigation)
 */
export async function hapticLight() {
    try {
        await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {
        if (navigator.vibrate) navigator.vibrate(10);
    }
}

/**
 * Trigger a medium haptic click (e.g. starting a workout, opening a modal)
 */
export async function hapticMedium() {
    try {
        await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {
        if (navigator.vibrate) navigator.vibrate(20);
    }
}

/**
 * Trigger a heavy haptic click (e.g. completing a set, deleting an item)
 */
export async function hapticHeavy() {
    try {
        await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (e) {
        if (navigator.vibrate) navigator.vibrate([30, 50, 30]);
    }
}

/**
 * Trigger a success haptic pattern (e.g. finishing a workout, saving settings)
 */
export async function hapticSuccess() {
    try {
        await Haptics.notification({ type: 'SUCCESS' });
    } catch (e) {
        if (navigator.vibrate) navigator.vibrate([40, 80, 50]);
    }
}

/**
 * Trigger a warning/error haptic pattern
 */
export async function hapticError() {
    try {
        await Haptics.notification({ type: 'ERROR' });
    } catch (e) {
        if (navigator.vibrate) navigator.vibrate([20, 40, 20, 40, 50]);
    }
}
