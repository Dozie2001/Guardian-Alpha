import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { GuardedExecutionResult } from "@/lib/trade/types";

const auditDir = path.join(process.cwd(), "data");
const auditPath = path.join(auditDir, "audit-log.json");

export async function readReceipts(): Promise<GuardedExecutionResult[]> {
  try {
    const raw = await readFile(auditPath, "utf8");
    return JSON.parse(raw) as GuardedExecutionResult[];
  } catch {
    return [];
  }
}

export async function appendReceipt(receipt: GuardedExecutionResult) {
  await mkdir(auditDir, { recursive: true });
  const receipts = await readReceipts();
  receipts.unshift(receipt);
  await writeFile(auditPath, JSON.stringify(receipts.slice(0, 100), null, 2));
}

export async function writeReceipts(receipts: GuardedExecutionResult[]) {
  await mkdir(auditDir, { recursive: true });
  await writeFile(auditPath, JSON.stringify(receipts.slice(0, 100), null, 2));
}
