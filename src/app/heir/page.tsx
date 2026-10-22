import { redirect } from "next/navigation";

// Old route kept as a redirect.
export default function Page() {
  redirect("/hospital");
}
