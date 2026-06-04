// Runs migration 011 to add per-user Gmail OAuth connections.
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function run() {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    console.log('[migrate] Connected to database');

    try {
        const sql = fs.readFileSync(
            path.join(__dirname, 'migrations', '011_user_gmail_connections.sql'),
            'utf-8',
        );

        await client.query(sql);
        console.log('[migrate] Migration 011 completed successfully (user Gmail connections added)');
    } catch (err) {
        console.error('[migrate] Migration failed:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
