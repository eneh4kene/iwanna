-- Migration: Add missing columns to pods table
-- Run this if your database already exists and needs these columns added

-- Add columns if they don't exist
DO $$ 
BEGIN
    -- Add wanna_ids column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pods' AND column_name = 'wanna_ids'
    ) THEN
        ALTER TABLE pods ADD COLUMN wanna_ids JSONB DEFAULT '[]';
    END IF;

    -- Add user_ids column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pods' AND column_name = 'user_ids'
    ) THEN
        ALTER TABLE pods ADD COLUMN user_ids JSONB DEFAULT '[]';
    END IF;

    -- Add shared_intent column (rename from collective_intent if it exists)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pods' AND column_name = 'shared_intent'
    ) THEN
        -- Check if collective_intent exists and rename it
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'pods' AND column_name = 'collective_intent'
        ) THEN
            ALTER TABLE pods RENAME COLUMN collective_intent TO shared_intent;
        ELSE
            ALTER TABLE pods ADD COLUMN shared_intent JSONB;
        END IF;
    END IF;

    -- Add meeting_place_name column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pods' AND column_name = 'meeting_place_name'
    ) THEN
        ALTER TABLE pods ADD COLUMN meeting_place_name VARCHAR(255);
    END IF;

    -- Add confirmed_user_ids column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pods' AND column_name = 'confirmed_user_ids'
    ) THEN
        ALTER TABLE pods ADD COLUMN confirmed_user_ids JSONB DEFAULT '[]';
    END IF;

    -- Add show_up_count column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pods' AND column_name = 'show_up_count'
    ) THEN
        ALTER TABLE pods ADD COLUMN show_up_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration completed: Added missing columns to pods table at %', NOW();
END $$;

