// Runs migration 012 — Attendance Management Module schema
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
            path.join(__dirname, 'migrations', '012_attendance.sql'),
            'utf-8',
        );

        await client.query(sql);
        console.log('[migrate] Migration 012 completed successfully (Attendance Management Module schema created)');
    } catch (err) {
        console.error('[migrate] Migration 012 failed:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
