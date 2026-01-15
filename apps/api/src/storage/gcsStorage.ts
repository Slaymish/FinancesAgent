import { Storage } from "@google-cloud/storage";

export async function writeGcsJson(params: {
  bucket: string;
  storageKey: string;
  rawJson: string;
}): Promise<void> {
  const { bucket, storageKey, rawJson } = params;
  const storage = new Storage();
  const file = storage.bucket(bucket).file(storageKey);

  await file.save(rawJson, {
    contentType: "application/json; charset=utf-8",
    resumable: false
  });
}

export async function readGcsJson(params: {
  bucket: string;
  storageKey: string;
}): Promise<unknown> {
  const { bucket, storageKey } = params;
  const storage = new Storage();
  const file = storage.bucket(bucket).file(storageKey);

  const [buf] = await file.download();
  const raw = buf.toString("utf8");
  return JSON.parse(raw) as unknown;
}
