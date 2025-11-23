-- Add political_leaning to rss_sources for political spectrum filtering
ALTER TABLE rss_sources 
ADD COLUMN political_leaning TEXT CHECK (political_leaning IN ('left', 'center-left', 'center', 'center-right', 'right', 'nonpartisan'));

-- Add index for efficient filtering
CREATE INDEX idx_rss_sources_political_leaning ON rss_sources(political_leaning);

-- Add political_leaning to articles (denormalized for performance)
ALTER TABLE articles
ADD COLUMN political_leaning TEXT;

-- Create index on articles for filtering
CREATE INDEX idx_articles_political_leaning ON articles(political_leaning);

-- Update existing sources with political leaning
-- Left sources
UPDATE rss_sources SET political_leaning = 'left' 
WHERE name IN ('Jacobin', 'Democracy Now', 'Truthout');

-- Center-left sources
UPDATE rss_sources SET political_leaning = 'center-left' 
WHERE name IN ('Salon', 'AlterNet', 'Raw Story', 'Mother Jones');

-- Center sources
UPDATE rss_sources SET political_leaning = 'center' 
WHERE name IN ('The Hill', 'PolitiFact', 'FactCheck.org');

-- Nonpartisan sources
UPDATE rss_sources SET political_leaning = 'nonpartisan'
WHERE name IN ('SCOTUSblog', 'Just Security', 'ProPublica', 'Type Investigations', 
               'FAIR (Fairness & Accuracy in Reporting)', 'Center for Investigative Reporting',
               'The Markup', 'Sludge');

-- Center-right source
UPDATE rss_sources SET political_leaning = 'center-right'
WHERE name IN ('The Blaze');

-- Specialized/Issue-focused as nonpartisan (they focus on specific communities/issues)
UPDATE rss_sources SET political_leaning = 'nonpartisan'
WHERE category = 'specialized' AND political_leaning IS NULL;

-- State government sources as nonpartisan (government reporting)
UPDATE rss_sources SET political_leaning = 'nonpartisan'
WHERE category = 'state_government' AND political_leaning IS NULL;