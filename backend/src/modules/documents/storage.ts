import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { badRequest, notFound } from "../../shared/errors.js";

export const ACCEPTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
] as const;

export interface StoredDocument {
  storageKey: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
}

export interface PrivateDocumentStorage {
  put(input: { bytes: Buffer; declaredMimeType: string }): Promise<StoredDocument>;
  read(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

function detectContent(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-")
    return { mimeType: "application/pdf", extension: "pdf" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { mimeType: "image/jpeg", extension: "jpg" };
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return { mimeType: "image/png", extension: "png" };
  const brand = bytes.length >= 12 ? bytes.subarray(4, 12).toString("ascii") : "";
  if (/^ftyp(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand))
    return { mimeType: "image/heic", extension: "heic" };
  throw badRequest("INVALID_FILE_CONTENT", "El contenido del archivo no coincide con un formato permitido");
}

function normalizedDeclaredMimeType(value: string) {
  return value.toLowerCase().split(";", 1)[0]?.trim() ?? "";
}

export function createLocalDocumentStorage(root: string, maxBytes: number): PrivateDocumentStorage {
  const absoluteRoot = resolve(root);
  const storagePath = (storageKey: string) => {
    if (!/^[0-9a-f-]{36}\.(pdf|jpg|png|heic)$/.test(storageKey))
      throw badRequest("INVALID_STORAGE_KEY", "Identificador de almacenamiento no válido");
    const candidate = resolve(absoluteRoot, storageKey);
    if (!candidate.startsWith(`${absoluteRoot}${sep}`))
      throw badRequest("INVALID_STORAGE_KEY", "Identificador de almacenamiento no válido");
    return candidate;
  };

  return {
    async put({ bytes, declaredMimeType }) {
      if (!bytes.length) throw badRequest("EMPTY_FILE", "El archivo está vacío");
      if (bytes.length > maxBytes)
        throw badRequest("FILE_TOO_LARGE", `El archivo supera el límite de ${maxBytes} bytes`);
      const detected = detectContent(bytes);
      const declared = normalizedDeclaredMimeType(declaredMimeType);
      const declaredEquivalent =
        declared === detected.mimeType ||
        (detected.mimeType === "image/heic" && ["image/heic", "image/heif"].includes(declared));
      if (!declaredEquivalent)
        throw badRequest("MIME_MISMATCH", "El tipo MIME declarado no coincide con el contenido");
      await mkdir(absoluteRoot, { recursive: true });
      const storageKey = `${randomUUID()}.${detected.extension}`;
      const handle = await open(storagePath(storageKey), "wx");
      try {
        await handle.writeFile(bytes);
      } finally {
        await handle.close();
      }
      return {
        storageKey,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        sizeBytes: bytes.length,
        mimeType: detected.mimeType,
      };
    },
    async read(storageKey) {
      try {
        return await readFile(storagePath(storageKey));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") throw notFound("Archivo");
        throw error;
      }
    },
    async delete(storageKey) {
      try {
        await unlink(storagePath(storageKey));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}
