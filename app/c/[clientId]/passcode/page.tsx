import { notFound } from "next/navigation";
import { requireClientView } from "@/lib/client-guard";
import { getClient } from "@/lib/db";
import PasscodeForm from "./PasscodeForm";

export const dynamic = "force-dynamic";

export default async function Passcode({
  params,
}: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  await requireClientView(clientId);

  const client = await getClient(clientId);
  if (!client) notFound();

  return (
    <PasscodeForm
      clientId={clientId}
      name={client.name}
      hasPasscode={client.hasPasscode}
    />
  );
}
