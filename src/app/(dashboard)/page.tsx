import { redirect } from "next/navigation";
import { isOperationCockpitEnabled } from "@/lib/operacao/feature";

export default function DashboardPage() {
  redirect(isOperationCockpitEnabled ? "/operacao" : "/dashboard");
}
