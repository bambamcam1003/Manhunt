import selfsigned from 'selfsigned';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const host = process.argv[2];
if (!host) {
  console.error('Usage: node scripts/generate-cert.js <public-ip-or-hostname>');
  process.exit(1);
}

const altNames = [
  { type: 2, value: 'localhost' },
  { type: 7, value: '127.0.0.1' },
];
// type 7 = IP, type 2 = DNS. Add the given host as both, in case it's a hostname.
if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
  altNames.push({ type: 7, value: host });
} else {
  altNames.push({ type: 2, value: host });
}

const attrs = [{ name: 'commonName', value: host }];
const pems = selfsigned.generate(attrs, {
  days: 7,
  keySize: 2048,
  extensions: [{ name: 'subjectAltName', altNames }],
});

const outDir = path.join(__dirname, '..', 'certs');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(outDir, 'key.pem'), pems.private);

console.log(`Self-signed certificate written to ${outDir}`);
console.log(`Valid for 7 days, covers: ${host}, localhost, 127.0.0.1`);
console.log('Friends will see a browser warning ("connection not private") the first time they load the site — that is expected for a self-signed cert. They just need to click through it once (e.g. "Advanced" -> "Proceed").');
