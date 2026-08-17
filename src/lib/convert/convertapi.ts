import "server-only";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export type ConvertApiResult = { fileName: string; buffer: Buffer };

// https://www.convertapi.com/docs/getting-started — POST /convert/{from}/to/{to},
// Bearer token, multipart field "File". StoreFile=true returns a
// time-limited download URL (3h) instead of inlining the result as base64.
export async function convertFile(fromExt: string, toExt: string, source: Buffer, filename: string): Promise<ConvertApiResult> {
  const form = new FormData();
  form.append("File", new Blob([new Uint8Array(source)]), filename);
  form.append("StoreFile", "true");

  const res = await fetch(`https://v2.convertapi.com/convert/${fromExt}/to/${toExt}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${requireEnv("CONVERTAPI_TOKEN")}` },
    body: form,
  });

  if (!res.ok) throw new Error(`ConvertAPI request failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const file = data.Files?.[0];
  if (!file?.Url) throw new Error(`ConvertAPI response missing output file: ${JSON.stringify(data)}`);

  const downloadRes = await fetch(file.Url);
  if (!downloadRes.ok) throw new Error(`Failed to download converted file: ${downloadRes.status}`);
  const buffer = Buffer.from(await downloadRes.arrayBuffer());

  return { fileName: file.FileName ?? `converted.${toExt}`, buffer };
}
