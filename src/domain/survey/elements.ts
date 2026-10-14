export const elementCodes = ["E01", "E02", "E03", "E04", "E05", "E06", "E07", "E08"] as const;
export type ElementCode = (typeof elementCodes)[number];
