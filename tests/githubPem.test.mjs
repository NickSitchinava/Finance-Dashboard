import { readFileSync } from "node:fs";
import { generateKeyPairSync, webcrypto } from "node:crypto";
import test from "node:test";
import assert from "node:assert/strict";
import { transformSync } from "esbuild";

test("GitHub PKCS#1 private key converts to WebCrypto PKCS#8", async () => {
  const source = readFileSync(new URL("../supabase/functions/_shared/pem.ts", import.meta.url), "utf8");
  const code = transformSync(source, { loader: "ts", format: "esm" }).code;
  const { pkcs1ToPkcs8 } = await import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pkcs1 = privateKey.export({ type: "pkcs1", format: "der" });
  const key = await webcrypto.subtle.importKey("pkcs8", pkcs1ToPkcs8(pkcs1),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode("F-Dash"));
  assert.equal(signature.byteLength, 256);
});
