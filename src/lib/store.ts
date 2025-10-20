import fs from "fs";
import path from "path";
import { tmpdir } from "os";

const STORAGE_DIR = path.join(tmpdir(), "linkedin-pro-pdfs");

// Asegurar que el directorio existe
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

function sanitizeUsername(username: string): string {
  // Reemplazar caracteres problemáticos con guiones
  return username.replace(/[^a-zA-Z0-9-_]/g, "-");
}

function getUserFilePath(username: string): string {
  const sanitized = sanitizeUsername(username);
  return path.join(STORAGE_DIR, `${sanitized}.txt`);
}

export function setUserText(username: string, text: string) {
  const filePath = getUserFilePath(username);
  fs.writeFileSync(filePath, text, "utf-8");
}

export function getUserText(username: string): string | null {
  const filePath = getUserFilePath(username);
  
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}
