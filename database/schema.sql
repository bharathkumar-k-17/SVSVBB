-- Create custom types for roles
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'VOLUNTEER');

-- 1. Users Table (Extends Supabase Auth)
CREATE TABLE users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'VOLUNTEER',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    active BOOLEAN DEFAULT true
);

-- 2. Festival Years
CREATE TABLE festival_years (
    id SERIAL PRIMARY KEY,
    year_name TEXT NOT NULL UNIQUE, -- e.g., "SVSVBB 2024"
    is_active BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Chanda Collections
CREATE TABLE chanda_collections (
    id SERIAL PRIMARY KEY,
    year_id INTEGER REFERENCES festival_years(id) NOT NULL,
    receipt_no INTEGER NOT NULL,
    donor_name TEXT NOT NULL,
    phone TEXT,
    amount_pledged DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0,
    payment_mode TEXT CHECK (payment_mode IN ('Cash', 'UPI', 'Pending')),
    is_vip BOOLEAN DEFAULT false,
    gotram_english TEXT,
    gotram_telugu TEXT,
    collected_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(year_id, receipt_no)
);

-- 4. Expenses and Categories
CREATE TABLE expense_categories (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    budget_limit DECIMAL(10,2) -- Optional overall limit
);

-- Default categories
INSERT INTO expense_categories (name) VALUES 
('Stage'), ('Decoration'), ('Lighting'), ('Sound'), ('Pooja items'), 
('Crackers'), ('Tractor'), ('Food'), ('Cultural prizes'), ('Annadanam'), ('Misc');

CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    year_id INTEGER REFERENCES festival_years(id) NOT NULL,
    category_id INTEGER REFERENCES expense_categories(id) NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    date DATE NOT NULL,
    added_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Cultural Activities (Events)
CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    year_id INTEGER REFERENCES festival_years(id) NOT NULL,
    name TEXT NOT NULL,
    event_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE participants (
    id SERIAL PRIMARY KEY,
    event_id INTEGER REFERENCES events(id) NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    age INTEGER,
    position INTEGER -- 1 for 1st place, 2 for 2nd place, null for participants
);

-- 6. Laddu, Hundi, Annadanam
CREATE TABLE laddu_auctions (
    id SERIAL PRIMARY KEY,
    year_id INTEGER REFERENCES festival_years(id) NOT NULL,
    winner_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    collected BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE hundi_collections (
    id SERIAL PRIMARY KEY,
    year_id INTEGER REFERENCES festival_years(id) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    counted_by_names TEXT NOT NULL, -- Comma separated names of committee members
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE annadanam_items (
    id SERIAL PRIMARY KEY,
    year_id INTEGER REFERENCES festival_years(id) NOT NULL,
    item_name TEXT NOT NULL,
    quantity TEXT NOT NULL,
    estimated_cost DECIMAL(10,2),
    assigned_volunteer UUID REFERENCES users(id),
    status TEXT DEFAULT 'Pending'
);

-- RLS Setup (Row Level Security)
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE chanda_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE laddu_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE hundi_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE annadanam_items ENABLE ROW LEVEL SECURITY;

-- Note: Specific RLS Policies will be created in rls.sql
