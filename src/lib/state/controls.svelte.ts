// src/lib/state/controls.svelte.ts
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export class ControlsState {
  // -------------------------
  // Stage Message State
  // -------------------------
  stageMessage = $state("");
  showMessageOnStage = $state(false);
  showMessageOnProjector = $state(false);
  isMessageActive = $derived(
    this.showMessageOnStage || this.showMessageOnProjector,
  );

  // -------------------------
  // Service Countdown State
  // -------------------------
  serviceTargetTimestamp = $state<number | null>(null);
  showServiceTimerOnStage = $state(true);
  showServiceTimerOnProjector = $state(false);
  isServiceTimerActive = $derived(this.serviceTargetTimestamp !== null);

  // -------------------------
  // Speaker Timer State
  // -------------------------
  speakerDurationMs = $state(50 * 60 * 1000);
  speakerTargetTimestamp = $state<number | null>(null);
  speakerPausedRemainingMs = $state<number | null>(null);
  showSpeakerTimerOnStage = $state(true);
  showSpeakerTimerOnProjector = $state(false);
  isSpeakerTimerRunning = $derived(this.speakerTargetTimestamp !== null);
  speakerTotalDurationMs = $state(0);

  constructor() {
    this.initSyncListener();
  }

  private async initSyncListener() {
    try {
      await listen("request-controls-state", () => {
        this.broadcastControls();
      });
    } catch (err) {
      console.error("[Operator] Failed to bind controls listener:", err);
    }
  }

  // --- Messages ---
  setStageMessage(text: string) {
    this.stageMessage = text;
  }
  clearStageMessage() {
    this.stageMessage = "";
    this.showMessageOnStage = false;
    this.showMessageOnProjector = false;
    this.broadcastControls();
  }
  toggleMessageStage() {
    this.showMessageOnStage = !this.showMessageOnStage;
    this.broadcastControls();
  }
  toggleMessageProjector() {
    this.showMessageOnProjector = !this.showMessageOnProjector;
    this.broadcastControls();
  }

  // --- Service Timer ---
  startServiceTimer(targetDate: Date) {
    this.serviceTargetTimestamp = targetDate.getTime();
    this.broadcastControls();
  }
  stopServiceTimer() {
    this.serviceTargetTimestamp = null;
    this.broadcastControls();
  }
  toggleServiceTimerStage() {
    this.showServiceTimerOnStage = !this.showServiceTimerOnStage;
    this.broadcastControls();
  }
  toggleServiceTimerProjector() {
    this.showServiceTimerOnProjector = !this.showServiceTimerOnProjector;
    this.broadcastControls();
  }

  // --- Speaker Timer ---
  startSpeakerTimer() {
    if (this.speakerPausedRemainingMs !== null) {
      this.speakerTargetTimestamp = Date.now() + this.speakerPausedRemainingMs;
      this.speakerPausedRemainingMs = null;
    } else {
      this.speakerTargetTimestamp = Date.now() + this.speakerDurationMs;
    }
    this.broadcastControls();
  }
  pauseSpeakerTimer() {
    if (this.speakerTargetTimestamp) {
      this.speakerPausedRemainingMs = this.speakerTargetTimestamp - Date.now();
      this.speakerTargetTimestamp = null;
      this.broadcastControls();
    }
  }
  resetSpeakerTimer() {
    this.speakerTargetTimestamp = null;
    this.speakerPausedRemainingMs = null;
    this.broadcastControls();
  }
  adjustSpeakerTimer(minutes: number) {
    const adjustmentMs = minutes * 60 * 1000;

    // NEW: Always adjust the base duration so the Stage percentage math stays accurate!
    this.speakerDurationMs = Math.max(0, this.speakerDurationMs + adjustmentMs);

    if (this.speakerTargetTimestamp !== null) {
      this.speakerTargetTimestamp += adjustmentMs;
    } else if (this.speakerPausedRemainingMs !== null) {
      this.speakerPausedRemainingMs += adjustmentMs;
    }
    this.broadcastControls();
  }
  setSpeakerDuration(minutes: number) {
    this.speakerDurationMs = minutes * 60 * 1000;
    if (!this.isSpeakerTimerRunning && this.speakerPausedRemainingMs === null) {
      this.broadcastControls();
    }
  }
  toggleSpeakerTimerStage() {
    this.showSpeakerTimerOnStage = !this.showSpeakerTimerOnStage;
    this.broadcastControls();
  }
  toggleSpeakerTimerProjector() {
    this.showSpeakerTimerOnProjector = !this.showSpeakerTimerOnProjector;
    this.broadcastControls();
  }

  // --- Broadcast ---
  public async broadcastControls() {
    const payload = {
      stageMessage: this.stageMessage,
      showMessageOnStage: this.showMessageOnStage,
      showMessageOnProjector: this.showMessageOnProjector,

      serviceTargetTimestamp: this.serviceTargetTimestamp,
      showServiceTimerOnStage: this.showServiceTimerOnStage,
      showServiceTimerOnProjector: this.showServiceTimerOnProjector,

      speakerTargetTimestamp: this.speakerTargetTimestamp,
      speakerPausedRemainingMs: this.speakerPausedRemainingMs,
      speakerTotalDurationMs: this.speakerDurationMs, // NEW: Pushed to display
      showSpeakerTimerOnStage: this.showSpeakerTimerOnStage,
      showSpeakerTimerOnProjector: this.showSpeakerTimerOnProjector,
    };

    try {
      await emit("controls-update", payload);
      await invoke("broadcast_payload", {
        eventType: "controls-update",
        payload: payload,
      });
    } catch (error) {
      console.error("Failed to broadcast controls:", error);
    }
  }
}

export const controlsState = new ControlsState();
