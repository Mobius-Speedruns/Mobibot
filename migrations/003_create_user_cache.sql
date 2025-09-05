CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS twitches (
  id SERIAL PRIMARY KEY,
  channel TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX name_users_trgm_idx ON users USING gin (name gin_trgm_ops);
CREATE INDEX channel_twitches_trgm_idx ON twitches USING gin (channel gin_trgm_ops);


