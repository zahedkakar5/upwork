import { z } from "zod";
export const specialties = [
  "Mobile apps",
  "Web & full stack",
  "UI/UX & prototyping",
  "AI integration & chatbots",
  "Ecommerce",
  "Desktop apps",
] as const;
export const discoverySkills = [
  "iOS",
  "Android",
  "Flutter",
  "React Native",
  "React",
  "Next.js",
  "UI/UX",
  "Figma",
  "Shopify",
  "AI Integration",
  "Chatbot",
];
export const discoveryCategories = [
  "All categories",
  "Web, Mobile & Software Dev",
  "IT & Networking",
  "Design & Creative",
  "Data Science & Analytics",
];
export const discoverySchema = z.object({
  specialty: z.enum(specialties).optional(),
  keywords: z.string().trim().max(200).default(""),
  skills: z.array(z.string().max(50)).max(12).default([]),
  category: z
    .enum(discoveryCategories as [string, ...string[]])
    .default("All categories"),
  jobType: z.enum(["all", "hourly", "fixed"]).default("all"),
  experience: z
    .enum(["all", "entry_level", "intermediate", "expert"])
    .default("all"),
  duration: z
    .enum([
      "all",
      "less_than_1_month",
      "1_to_3_months",
      "3_to_6_months",
      "more_than_6_months",
    ])
    .default("all"),
  scope: z.enum(["all", "small", "medium", "large"]).default("all"),
  maxAgeMinutes: z.number().int().min(1).max(10080).default(60),
});
export type DiscoveryFilters = z.infer<typeof discoverySchema>;
const queries: Record<string, string> = {
  "Mobile apps": '"mobile app" OR Flutter OR "React Native" OR iOS OR Android',
  "Web & full stack":
    '"web app" OR "full stack" OR "front end" OR React OR Next.js',
  "UI/UX & prototyping": '"app design" OR "UI/UX" OR Figma OR prototype',
  "AI integration & chatbots": '"AI integration" OR chatbot OR "AI app"',
  Ecommerce: 'Shopify OR ecommerce OR "e-commerce"',
  "Desktop apps": '"desktop app" OR Electron',
};
export function discoveryQuery(f: DiscoveryFilters) {
  const parts = [
    f.specialty ? queries[f.specialty] : Object.values(queries).join(" OR "),
    ...f.skills.map((s) => '"' + s.replaceAll('"', "") + '"'),
    f.keywords,
  ];
  return parts.filter(Boolean).join(" OR ");
}
export function openingKeyword(text: string): string | null {
  const match = text.match(
    /(?:start|begin|open)\s+(?:your\s+)?(?:proposal|cover letter|application|response|message)\s+(?:with|by (?:saying|writing))\s*[“"'`]([^”"'`\n]{1,80})[”"'`]/i,
  );
  return match?.[1]?.trim() ?? null;
}
export function screeningFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      typeof item === "string"
        ? item
        : item && typeof item === "object"
          ? String(
              (item as Record<string, unknown>).question ??
                (item as Record<string, unknown>).text ??
                "",
            )
          : "",
    )
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function clientRestrictions(text: string) {
  return {
    noAI: /\b(?:no AI(?:[- ]generated)? (?:proposals|applications|responses)|do not use AI|AI(?:[- ]generated)? (?:proposals|applications|responses) (?:are )?not (?:allowed|accepted))\b/i.test(
      text,
    ),
    noAgency:
      /\b(?:no agencies|agencies (?:must not|cannot|should not) apply|do not apply (?:as|if you are) an agency)\b/i.test(
        text,
      ),
  };
}
