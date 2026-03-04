import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const getConnectionString = () => {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL or DATABASE_URL environment variable is required');
  }
  return connectionString;
};

const client = postgres(getConnectionString(), {
  prepare: false,
  // Connection timeout settings for serverless environments
  connect_timeout: 10, // 10 seconds to establish connection
  idle_timeout: 20, // Close idle connections after 20 seconds
  max_lifetime: 60 * 30, // Max connection lifetime 30 minutes
  // Limit connections for serverless
  max: 1, // Single connection per serverless instance
});

export const db = drizzle(client, { schema });
