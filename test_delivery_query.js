#!/usr/bin/env node

/**
 * Direct test of semantic query handler
 * Tests both delivery history and revenue queries
 */

require('ts-node/register/transpile-only');

const { createSemanticQueryHandler } = require('./semantic-query-engine');
const sql = require('mssql');
const { gemini_generateText } = require('./services/aiServices');

async function testQueries() {
  console.log('\n=== TESTING SEMANTIC QUERIES ===\n');

  try {
    // Create connection pool
    const poolConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      server: process.env.DB_SERVER,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT),
      trustServerCertificate: true,
      requestTimeout: 300000,
    };

    const pool = new sql.ConnectionPool(poolConfig);
    await pool.connect();
    console.log('✓ Connected to database\n');

    // Initialize handler
    const handler = await createSemanticQueryHandler(
      pool,
      gemini_generateText,
      './semantic-query-engine/metadata',
    );
    console.log('✓ Semantic query handler initialized\n');

    // Test Query 1: Delivery history (works)
    console.log('--- Test 1: Delivery History Query ---');
    console.log('Query: lịch sử giao hàng 2026\n');
    const result1 = await handler.handle({
      question: 'lịch sử giao hàng 2026',
      chat_history: [],
      chat_summary: '',
      debug: false,
    });

    if (result1.ok) {
      console.log('✓ Query PASSED');
      console.log(`  Rows: ${result1.data?.rows?.length || 0}`);
    } else {
      console.log('✗ Query FAILED');
      console.log(`  Error: ${result1.error?.message}`);
    }

    // Test Query 2: Revenue query (should work now)
    console.log('\n--- Test 2: Revenue Query ---');
    console.log('Query: doanh thu 2026\n');
    const result2 = await handler.handle({
      question: 'doanh thu 2026',
      chat_history: [],
      chat_summary: '',
      debug: false,
    });

    if (result2.ok) {
      console.log('✓ Query PASSED');
      console.log(`  Rows: ${result2.data?.rows?.length || 0}`);
      if (result2.data?.rows?.[0]) {
        console.log(`  Sample: `, JSON.stringify(result2.data.rows[0]).slice(0, 200));
      }
    } else {
      console.log('✗ Query FAILED');
      console.log(`  Error: ${result2.error?.message}`);
    }

    console.log('\n=== TESTS COMPLETE ===\n');
    await pool.close();
  } catch (error) {
    console.error('✗ Test failed:', error.message);
    process.exit(1);
  }
}

testQueries();
