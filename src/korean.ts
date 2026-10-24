export function withKoreanParticle(value: string, kind: "and" | "subject" | "topic" | "object"): string {
  const ending = value.trim().replace(/[”"'」】)\]]+$/u, "");
  const code = ending.charCodeAt(ending.length - 1);
  const final = code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : 0;
  const hasFinal = final !== 0;
  return value + (kind === "and" ? (hasFinal ? "과" : "와")
    : kind === "subject" ? (hasFinal ? "이" : "가")
      : kind === "object" ? (hasFinal ? "을" : "를") : (hasFinal ? "은" : "는"));
}

export function lifeDate(startYear: number, week: number, day = 1): Date {
  return new Date(startYear, 0, (week - 1) * 7 + day);
}
