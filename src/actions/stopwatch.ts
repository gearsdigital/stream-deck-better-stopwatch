import {action, SingletonAction, KeyDownEvent, KeyUpEvent, TouchTapEvent, WillAppearEvent, WillDisappearEvent,} from "@elgato/streamdeck";

// Constants
const DEFAULTS = {
    FORMAT: "mm:ss" as const,
    TICK_MS: 250,
    LONG_PRESS_MS: 700,
} as const;

const LIMITS = {
    TICK_MS: {MIN: 100, MAX: 1000},
    LONG_PRESS_MS: {MIN: 300, MAX: 2000},
} as const;

type TimeFormat = "mm:ss" | "hh:mm:ss" | "mm:ss.S";

type ActionContext = WillAppearEvent<StopwatchSettings>["action"];

/**
 * BetterStopwatch action for Stream Deck.
 *
 * Features:
 * - Short press/tap: Start/stop the timer
 * - Long press/hold: Reset to initial state (stopped at 00:00)
 * - Supports both physical keys and touch devices (Stream Deck Mobile)
 * - Persists state across plugin restarts
 * - Continues running when hidden
 * - Configurable display format and update interval
 * - Each key gets its own independent timer instance
 */
@action({UUID: "com.gearsdigital.betterstopwatch"})
export class BetterStopwatch extends SingletonAction<StopwatchSettings> {
    // Per-context state tracking (one entry per Stream Deck key)
    private tickTimers = new Map<string, ReturnType<typeof setInterval>>();
    private longPressTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private lastDownTimes = new Map<string, number>();
    private hasResetDuringPressByContext = new Map<string, boolean>();
    private actionContexts = new Map<string, ActionContext>();

    override async onWillAppear(ev: WillAppearEvent<StopwatchSettings>): Promise<void> {
        try {
            const contextId = ev.action.id;
            this.actionContexts.set(contextId, ev.action);
            const settings = this.ensureDefaults(ev.payload.settings);

            // Clear any default or user-set title immediately
            await ev.action.setTitle("");

            // Resume ticking if the stopwatch is running
            if (settings.running) {
                this.startTicking(contextId, settings);
            }

            await ev.action.setSettings(settings);
            await this.updateDisplay(contextId, settings);
        } catch (error) {
            console.error("[BetterStopwatch] Error in onWillAppear:", error);
        }
    }

    override async onWillDisappear(ev: WillDisappearEvent<StopwatchSettings>): Promise<void> {
        // Stop UI updates (stopwatch continues running in background)
        const contextId = ev.action.id;
        this.stopTicking(contextId);
        this.clearLongPressTimer(contextId);
        this.actionContexts.delete(contextId);
    }

    override async onKeyDown(ev: KeyDownEvent<StopwatchSettings>): Promise<void> {
        const contextId = ev.action.id;
        this.lastDownTimes.set(contextId, Date.now());
        this.hasResetDuringPressByContext.set(contextId, false);
        this.actionContexts.set(contextId, ev.action);

        const settings = this.ensureDefaults(ev.payload.settings);

        // Pause the tick timer to freeze the display during key press
        if (settings.running) {
            this.stopTicking(contextId);
        }

        // Start timer to reset when long press threshold is reached
        const timer = setTimeout(async () => {
            try {
                const now = Date.now();
                await this.handleReset(settings, now);
                this.hasResetDuringPressByContext.set(contextId, true);

                await ev.action.setSettings(settings);
                await this.updateDisplay(contextId, settings);
            } catch (error) {
                console.error("[BetterStopwatch] Error during long press reset:", error);
            }
        }, settings.longPressMs);
        this.longPressTimers.set(contextId, timer);
    }

    override async onKeyUp(ev: KeyUpEvent<StopwatchSettings>): Promise<void> {
        try {
            const contextId = ev.action.id;

            // Clear the long press timer
            this.clearLongPressTimer(contextId);

            this.actionContexts.set(contextId, ev.action);
            const settings = this.ensureDefaults(ev.payload.settings);
            const now = Date.now();
            const lastDownAt = this.lastDownTimes.get(contextId) ?? now;
            const pressMs = now - lastDownAt;
            this.lastDownTimes.delete(contextId);

            // If reset already happened during the press, we're now in initial state (stopped)
            if (this.hasResetDuringPressByContext.get(contextId)) {
                this.hasResetDuringPressByContext.set(contextId, false);
                return;
            }

            // Handle short press (toggle start/stop)
            if (pressMs < settings.longPressMs) {
                await this.handleToggle(contextId, settings, now);
                await ev.action.setSettings(settings);
                await this.updateDisplay(contextId, settings);
            }
        } catch (error) {
            console.error("[BetterStopwatch] Error in onKeyUp:", error);
        }
    }

    override async onTouchTap(ev: TouchTapEvent<StopwatchSettings>): Promise<void> {
        try {
            const contextId = ev.action.id;
            this.actionContexts.set(contextId, ev.action);
            const settings = this.ensureDefaults(ev.payload.settings);
            const now = Date.now();

            // Touch tap includes hold information for long press detection
            if (ev.payload.hold) {
                // Long press (reset to initial state)
                await this.handleReset(settings, now);
            } else {
                // Short tap (toggle)
                await this.handleToggle(contextId, settings, now);
            }

            await ev.action.setSettings(settings);
            await this.updateDisplay(contextId, settings);
        } catch (error) {
            console.error("[BetterStopwatch] Error in onTouchTap:", error);
        }
    }

    /**
     * Handles the reset action (long press).
     * Resets to initial state: stopped at 00:00.
     */
    private async handleReset(settings: Required<StopwatchSettings>, now: number): Promise<void> {
        settings.elapsedMs = 0;
        settings.running = false;
        settings.startedAt = 0;
    }

    /**
     * Handles the toggle action (short press).
     * Starts the stopwatch if stopped, stops it if running.
     */
    private async handleToggle(contextId: string, settings: Required<StopwatchSettings>, now: number): Promise<void> {
        if (!settings.running) {
            // START: adjust startedAt to account for previously elapsed time
            settings.running = true;
            settings.startedAt = now - settings.elapsedMs;
            this.startTicking(contextId, settings);
        } else {
            // STOP: freeze the elapsed time
            settings.running = false;
            settings.elapsedMs = now - settings.startedAt;
            this.stopTicking(contextId);
        }
    }

    /**
     * Ensures all settings have valid default values and are within acceptable ranges.
     */
    private ensureDefaults(s?: StopwatchSettings): Required<StopwatchSettings> {
        return {
            running: s?.running ?? false,
            startedAt: s?.startedAt ?? 0,
            elapsedMs: s?.elapsedMs ?? 0,
            format: s?.format ?? DEFAULTS.FORMAT,
            tickMs: this.clamp(s?.tickMs ?? DEFAULTS.TICK_MS, LIMITS.TICK_MS.MIN, LIMITS.TICK_MS.MAX),
            longPressMs: this.clamp(
                s?.longPressMs ?? DEFAULTS.LONG_PRESS_MS,
                LIMITS.LONG_PRESS_MS.MIN,
                LIMITS.LONG_PRESS_MS.MAX
            ),
        };
    }

    /**
     * Clamps a value between min and max.
     */
    private clamp(value: number, min: number, max: number): number {
        return Math.min(max, Math.max(min, value));
    }

    /**
     * Starts the periodic UI update timer.
     */
    private startTicking(contextId: string, settings: Required<StopwatchSettings>): void {
        this.stopTicking(contextId); // Prevent duplicate timers

        const updateUI = async () => {
            const actionContext = this.actionContexts.get(contextId);
            if (!actionContext) return;

            try {
                const elapsed = this.calculateElapsed(settings);
                const formattedElapsed = this.formatElapsed(elapsed, settings.format);
                await actionContext.setTitle("");
                await actionContext.setImage(this.createButtonImage(formattedElapsed, settings.running, elapsed));
            } catch (error) {
                console.error("[BetterStopwatch] Error updating display:", error);
            }
        };

        // Update immediately, then start interval
        void updateUI();
        const timer = setInterval(updateUI, settings.tickMs);
        this.tickTimers.set(contextId, timer);
    }

    /**
     * Stops the periodic UI update timer and cleans up resources.
     */
    private stopTicking(contextId: string): void {
        const timer = this.tickTimers.get(contextId);
        if (timer) {
            clearInterval(timer);
            this.tickTimers.delete(contextId);
        }
    }

    /**
     * Clears the long press timer if it exists.
     */
    private clearLongPressTimer(contextId: string): void {
        const timer = this.longPressTimers.get(contextId);
        if (timer) {
            clearTimeout(timer);
            this.longPressTimers.delete(contextId);
        }
    }

    /**
     * Creates a button image with the specified time text.
     * @param elapsed The formatted time string to display
     * @param running Whether the stopwatch is currently running
     * @param elapsedMs The elapsed time in milliseconds (to detect initial state)
     * @returns A data URL of the generated SVG image
     */
    private createButtonImage(elapsed: string, running: boolean, elapsedMs: number): string {
        // Determine if we're in initial state (not started yet)
        const isInitialState = !running && elapsedMs === 0;

        // Show as enabled if running OR in initial state, disabled only if stopped with time
        const showEnabled = running || isInitialState;

        // Background: black when enabled, darker when disabled
        const backgroundColor = showEnabled ? '#000000' : '#1a1a1a';

        // Text: white when enabled, gray when disabled
        const textColor = showEnabled ? '#FFFFFF' : '#666666';

        // Create SVG with embedded styles and centered text
        const svg = `<svg width="144" height="144" xmlns="http://www.w3.org/2000/svg">
            <rect width="144" height="144" fill="${backgroundColor}"/>
            <text x="72" y="72"
                  font-family="Arial, sans-serif"
                  font-size="42"
                  font-weight="bold"
                  fill="${textColor}"
                  text-anchor="middle"
                  dominant-baseline="central">${elapsed}</text>
        </svg>`;

        // Convert SVG to data URL
        return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    }

    /**
     * Updates the Stream Deck key display with the current elapsed time.
     */
    private async updateDisplay(contextId: string, settings: Required<StopwatchSettings>): Promise<void> {
        const actionContext = this.actionContexts.get(contextId);
        if (!actionContext) return;

        const elapsed = this.calculateElapsed(settings);

        // Initial state: use default Stream Deck UI (no custom image)
        if (!settings.running && elapsed === 0) {
            await actionContext.setImage(undefined);
            await actionContext.setTitle("");
            return;
        }

        // Running or stopped with time: show custom image
        const formattedElapsed = this.formatElapsed(elapsed, settings.format);
        await actionContext.setTitle("");
        await actionContext.setImage(this.createButtonImage(formattedElapsed, settings.running, elapsed));
    }

    /**
     * Calculates the current elapsed time in milliseconds.
     */
    private calculateElapsed(settings: Required<StopwatchSettings>): number {
        return settings.running ? Date.now() - settings.startedAt : settings.elapsedMs;
    }

    /**
     * Formats elapsed milliseconds into a human-readable time string.
     */
    private formatElapsed(ms: number, format: TimeFormat): string {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const tenths = Math.floor((ms % 1000) / 100);

        switch (format) {
            case "hh:mm:ss":
                return `${this.pad(hours)}:${this.pad(minutes)}:${this.pad(seconds)}`;

            case "mm:ss.S": {
                const totalMinutes = hours * 60 + minutes;
                return `${this.pad(totalMinutes)}:${this.pad(seconds)}.${tenths}`;
            }

            case "mm:ss":
            default: {
                // Show hours format when >= 60 minutes, otherwise show minutes format
                if (hours > 0) {
                    return `${hours}:${this.pad(minutes)}:${this.pad(seconds)}`;
                }
                return `${minutes}:${this.pad(seconds)}`;
            }
        }
    }

    /**
     * Pads a number with a leading zero if less than 10.
     */
    private pad(n: number): string {
        return n < 10 ? `0${n}` : `${n}`;
    }
}

/**
 * Settings for the Stopwatch action, persisted across plugin restarts.
 */
type StopwatchSettings = {
    /** Whether the stopwatch is currently running */
    running?: boolean;

    /** Epoch timestamp (ms) when the current run started (adjusted for prior elapsed time) */
    startedAt?: number;

    /** Accumulated elapsed time (ms) when the stopwatch is stopped */
    elapsedMs?: number;

    /** Display format for the elapsed time */
    format?: TimeFormat;

    /** UI update interval in milliseconds (100-1000ms, default: 250ms) */
    tickMs?: number;

    /** Long press duration threshold in milliseconds (300-2000ms, default: 300ms) */
    longPressMs?: number;
};
