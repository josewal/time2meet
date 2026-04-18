export type ParticipantCells = { id: string; name: string; slotIndices: number[] };

export function computeHeatmap(slotCount: number, participants: ParticipantCells[]): number[] {
  const counts = new Array<number>(slotCount).fill(0);
  for (const p of participants) {
    for (const idx of p.slotIndices) {
      if (idx >= 0 && idx < slotCount) counts[idx]++;
    }
  }
  return counts;
}

export function bestSlots(
  counts: number[],
  topN: number = 5,
): { slotIndex: number; count: number }[] {
  const entries: { slotIndex: number; count: number }[] = [];
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) entries.push({ slotIndex: i, count: counts[i] });
  }
  // Ties broken by earlier slotIndex (ascending i already in push order).
  entries.sort((a, b) => (b.count - a.count) || (a.slotIndex - b.slotIndex));
  return entries.slice(0, Math.max(0, topN));
}

export function participantsAvailableAt(
  slotIndex: number,
  participants: ParticipantCells[],
): { id: string; name: string }[] {
  const out: { id: string; name: string }[] = [];
  for (const p of participants) {
    if (p.slotIndices.includes(slotIndex)) out.push({ id: p.id, name: p.name });
  }
  return out;
}
