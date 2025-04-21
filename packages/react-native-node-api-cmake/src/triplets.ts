import { APPLE_TRIPLETS } from "./apple.js";

export const SUPPORTED_TRIPLETS = [...APPLE_TRIPLETS, "arm64-android"] as const;

export type SupportedTriplet = (typeof SUPPORTED_TRIPLETS)[number];
