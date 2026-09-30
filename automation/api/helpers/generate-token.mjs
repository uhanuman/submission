import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

dotenv.config({ path: envPath });

const BASE_URL = process.env.INVENTREE_BASE_URL || 'http://localhost:8000';
const USERNAME = process.env.INVENTREE_USERNAME || 'admin';
const PASSWORD = process.env.INVENTREE_PASSWORD || 'Inventree-QA-2026!';

/**
 * Requests an API token from InvenTree via /api/user/me/token/
 * per https://docs.inventree.org/en/stable/api/#requesting-a-token
 */
export async function generateToken() {
  const url = `${BASE_URL.replace(/\/$/, '')}/api/user/me/token/`;
  const basicAuth = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');

  console.log(`Requesting token from: ${url}`);
  console.log(`Using username: ${USERNAME}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to request token (${response.status} ${response.statusText}): ${errorText}`);
  }

  const data = await response.json();
  const token = data.token;
  console.log(`Token successfully acquired: ${token}`);

  process.env.INVENTREE_API_TOKEN = token;

  // Persist into .env if present
  if (fs.existsSync(envPath)) {
    let envContent = fs.readFileSync(envPath, 'utf8');
    if (/^INVENTREE_API_TOKEN=.*$/m.test(envContent)) {
      envContent = envContent.replace(/^INVENTREE_API_TOKEN=.*$/m, `INVENTREE_API_TOKEN=${token}`);
    } else {
      envContent += `\nINVENTREE_API_TOKEN=${token}`;
    }
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`Updated INVENTREE_API_TOKEN in ${envPath}`);
  }

  return token;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateToken().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
