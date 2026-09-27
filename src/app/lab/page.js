import { notFound } from "next/navigation";
import LabView from "./lab-view";

export const metadata = { title: "Character lab", robots: { index: false } };

// Development tool for checking characters and clips; not part of the site.
export default async function LabPage({ searchParams }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { clip = "Idle_Loop", who = "artist" } = await searchParams;
  return <LabView clip={clip} names={who.split(",")} />;
}
