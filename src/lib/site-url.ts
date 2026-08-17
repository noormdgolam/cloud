import "server-only";

export function siteUrl(): string {
  return process.env.AUTH_URL ?? "https://cloud.bongshai.com";
}
