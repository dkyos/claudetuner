// Root has no standalone UI — redirect to the dashboard (the real local UI).
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function Page() {
  redirect("/dashboard");
}
