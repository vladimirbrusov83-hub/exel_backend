import { notFound, redirect } from "next/navigation";
import { clientAllowed } from "@/lib/client-guard";
import { getClient } from "@/lib/db";
import EnterForm from "./EnterForm";

export const dynamic = "force-dynamic";

export default async function Enter({
  params,
}: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const client = await getClient(clientId);
  if (!client) notFound();

  // Already through — either no passcode, or the cookie is good. Without this
  // the back button after entering lands on a passcode box for a page that is
  // wide open.
  if (await clientAllowed(clientId)) redirect(`/c/${clientId}`);

  return <EnterForm clientId={clientId} name={client.name} />;
}
