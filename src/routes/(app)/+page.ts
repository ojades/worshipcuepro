// /src/routes/(app)/+page.ts
import { redirect } from "@sveltejs/kit";

export function load() {
  redirect(302, "/operator");
}
