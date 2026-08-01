// /src/lib/utils/helper.ts

import { confirm } from "@tauri-apps/plugin-dialog";

export interface ConfirmDialogOptions {
  title?: string;
  kind?: "info" | "warning" | "error";
  message: string;
}

export const confirmDialog = async (
  options: ConfirmDialogOptions,
): Promise<boolean> => {
  return await confirm(options.message, {
    title: options.title,
    kind: options.kind || "warning",
  });
};
