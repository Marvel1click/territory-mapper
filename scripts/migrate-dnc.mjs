#!/usr/bin/env node

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const keyVersion = Number(process.env.DNC_ENCRYPTION_KEY_VERSION ?? '1');
const encodedKey = process.env[`DNC_ENCRYPTION_KEY_V${keyVersion}`];

if (!url || !serviceKey || !encodedKey) {
  throw new Error('Set NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and the active DNC encryption key.');
}
const key = Buffer.from(encodedKey, 'base64');
if (key.byteLength !== 32 || !Number.isSafeInteger(keyVersion) || keyVersion < 1) {
  throw new Error('The active DNC key must decode to 32 bytes and have a positive integer version.');
}

const encrypt = (plaintext) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `v${keyVersion}.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
};
const decrypt = (ciphertext) => {
  const [, iv, tag, value] = ciphertext.split('.');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(value, 'base64url')), decipher.final()]).toString('utf8');
};
const hash = (value) => createHash('sha256').update(value.trim().toLocaleLowerCase('en')).digest('hex');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { data, error } = await supabase
  .from('dnc_records')
  .select('id,house_id,address_ciphertext,verified_at,houses(address,notes)');
if (error) throw error;

const pending = (data ?? []).filter((row) => row.houses?.address && row.houses.address !== 'DNC address restricted');
process.stdout.write(`${apply ? 'Applying' : 'Dry run:'} ${pending.length} DNC record(s) require encryption and masking.\n`);
if (!apply) {
  process.stdout.write('Re-run with --apply after confirming the backup and active key version. No data was changed.\n');
  process.exit(0);
}

let migrated = 0;
for (const row of pending) {
  const addressCiphertext = encrypt(row.houses.address);
  const notesCiphertext = row.houses.notes ? encrypt(row.houses.notes) : null;
  if (decrypt(addressCiphertext) !== row.houses.address || (notesCiphertext && decrypt(notesCiphertext) !== row.houses.notes)) {
    throw new Error(`Encryption verification failed for DNC record ${row.id}.`);
  }
  const now = new Date().toISOString();
  const { error: recordError } = await supabase.from('dnc_records').update({
    address_ciphertext: addressCiphertext,
    notes_ciphertext: notesCiphertext,
    address_hash: hash(row.houses.address),
    key_version: keyVersion,
    migrated_at: now,
    verified_at: now,
    updated_at: now,
  }).eq('id', row.id);
  if (recordError) throw recordError;
  const { error: maskError } = await supabase.from('houses').update({
    address: 'DNC address restricted',
    notes: null,
    status: 'dnc',
    is_dnc: true,
    dnc_encrypted_address: null,
    deleted_at: now,
  }).eq('id', row.house_id);
  if (maskError) throw maskError;
  migrated += 1;
}

process.stdout.write(`Verified, encrypted, and masked ${migrated} DNC record(s).\n`);
