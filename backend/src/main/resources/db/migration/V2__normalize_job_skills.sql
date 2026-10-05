-- Migration: Normalize job skills
-- Creates skills table and migrates existing job_skills data

-- 1. Create skills table
CREATE TABLE IF NOT EXISTS skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_skill_name ON skills(name);
CREATE INDEX IF NOT EXISTS idx_skill_category ON skills(category);

-- 2. Add skill_id column to job_skills
ALTER TABLE job_skills ADD COLUMN IF NOT EXISTS skill_id UUID;

-- 3. Create skills from existing job_skills skill_name values (deduplicated)
INSERT INTO skills (name, category)
SELECT DISTINCT skill_name, NULL
FROM job_skills
WHERE skill_name IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 4. Update job_skills to reference skills
UPDATE job_skills js
SET skill_id = s.id
FROM skills s
WHERE js.skill_name = s.name;

-- 5. Make skill_id NOT NULL
ALTER TABLE job_skills ALTER COLUMN skill_id SET NOT NULL;

-- 6. Add foreign key constraint
ALTER TABLE job_skills
ADD CONSTRAINT fk_job_skills_skill
FOREIGN KEY (skill_id) REFERENCES skills(id);

-- 7. Add unique constraint on (job_id, skill_id)
ALTER TABLE job_skills
ADD CONSTRAINT uk_job_skill_job_skill UNIQUE (job_id, skill_id);

-- 8. Add index on skill_id
CREATE INDEX IF NOT EXISTS idx_job_skill_skill ON job_skills(skill_id);

-- 9. Drop old skill_name column (optional - keep for rollback safety)
-- ALTER TABLE job_skills DROP COLUMN skill_name;
-- ALTER TABLE job_skills DROP INDEX idx_job_skill_name;