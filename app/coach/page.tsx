import { redirect } from "next/navigation";
import { getAllWorkouts, getClients } from "@/lib/db";
import CoachBoard from "./CoachBoard";

export const dynamic = "force-dynamic";

export default async function CoachPage({
  searchParams,
}: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const clients = await getClients();

  if (clients.length === 0) {
    return (
      <main className="p-6">
        <p>No clients in the database yet. Run <code>npm run db:push</code>.</p>
      </main>
    );
  }

  const selected = clients.find((x) => x.id === c) ?? clients[0];
  if (c && !clients.some((x) => x.id === c)) redirect("/coach");

  const workouts = await getAllWorkouts(selected.id);

  return <CoachBoard clients={clients} clientId={selected.id} workouts={workouts} />;
}
