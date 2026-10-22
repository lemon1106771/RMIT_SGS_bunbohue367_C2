import { redirect } from "next/navigation";

// Old route: the payee is now a hospital.
export default function Page() {
  redirect("/hospital");
}
