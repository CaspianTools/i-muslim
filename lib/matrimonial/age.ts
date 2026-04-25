export function ageFromDob(dobIso: string, now: Date = new Date()): number {
  const dob = new Date(dobIso);
  if (Number.isNaN(dob.getTime())) return 0;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return Math.max(0, age);
}

export function isAdult(dobIso: string): boolean {
  return ageFromDob(dobIso) >= 18;
}

export function ageInRange(dobIso: string, min: number, max: number): boolean {
  const age = ageFromDob(dobIso);
  return age >= min && age <= max;
}
