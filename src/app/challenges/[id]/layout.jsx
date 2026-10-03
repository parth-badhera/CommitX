import { prisma } from "@/lib/prisma";

export async function generateMetadata({ params }) {
  try {
    const id = params.id;
    const c = await prisma.challenge.findFirst({
      where: /^\d+$/.test(id) ? { OR: [{ id }, { contractChallengeId: Number(id) }] } : { id },
      select: { name: true, description: true, isPrivate: true },
    });
    if (!c) return { title: "Challenge" };
    return {
      title: c.name,
      description: c.isPrivate ? "A private CommitX challenge." : c.description || "Join this CommitX challenge.",
    };
  } catch {
    return { title: "Challenge" };
  }
}

export default function Layout({ children }) {
  return children;
}
