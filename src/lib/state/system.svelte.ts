// src/lib/state/system.svelte.ts

export type SystemAlert = {
  id: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  timeout?: number;
};

export type DisplayInfo = {
  name: string;
  is_primary: boolean;
  width: number;
  height: number;
};

class SystemState {
  // --- Core State ---
  isLive = $state(false);

  // Window Statuses
  isProjectorOpen = $state(false);
  isStageOpen = $state(false);

  // Hardware tracking
  displays = $state<DisplayInfo[]>([]);

  // Assignments (Stores the 'name' of the monitor)
  projectorMonitor = $state<string | null>(null);
  stageMonitor = $state<string | null>(null);

  alerts = $state<SystemAlert[]>([]);

  // --- Derived State ---
  totalDisplays = $derived(this.displays.length);
  hasExternalDisplays = $derived(this.totalDisplays > 1);

  // Lists for dropdowns (filters out monitors assigned to other outputs)
  availableForProjector = $derived(
    this.displays.filter((d) => d.name !== this.stageMonitor),
  );

  availableForStage = $derived(
    this.displays.filter((d) => d.name !== this.projectorMonitor),
  );

  // --- Actions/Mutations ---

  toggleLive() {
    this.isLive = !this.isLive;
  }

  setDisplays(newDisplays: DisplayInfo[]) {
    this.displays = newDisplays;

    if (
      this.projectorMonitor &&
      !newDisplays.some((d) => d.name === this.projectorMonitor)
    ) {
      this.projectorMonitor = null;
    }
    if (
      this.stageMonitor &&
      !newDisplays.some((d) => d.name === this.stageMonitor)
    ) {
      this.stageMonitor = null;
    }

    if (!this.projectorMonitor && newDisplays.length > 1) {
      const secondary = newDisplays.find((d) => !d.is_primary);
      if (secondary) this.projectorMonitor = secondary.name;
    }

    if (!this.stageMonitor && newDisplays.length > 2) {
      const tertiary = newDisplays.filter(
        (d) => !d.is_primary && d.name !== this.projectorMonitor,
      )[0];
      if (tertiary) this.stageMonitor = tertiary.name;
    }
  }

  assignProjector(monitorName: string) {
    this.projectorMonitor = monitorName;
    if (this.stageMonitor === monitorName) {
      this.stageMonitor = null;
    }
  }

  assignStage(monitorName: string) {
    this.stageMonitor = monitorName;
    if (this.projectorMonitor === monitorName) {
      this.projectorMonitor = null;
    }
  }

  addAlert(alert: Omit<SystemAlert, "id">) {
    const id = crypto.randomUUID();
    const timeout = alert.timeout === undefined ? 5000 : alert.timeout;
    this.alerts.push({ ...alert, id });

    if (timeout > 0) {
      setTimeout(() => {
        this.removeAlert(id);
      }, timeout);
    }
  }

  removeAlert(id: string) {
    this.alerts = this.alerts.filter((a) => a.id !== id);
  }
}

export const systemState = new SystemState();
