
-- Insert 4 new demo organizations
INSERT INTO public.client_organizations (id, name, slug, logo_url, is_active, primary_contact_email)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Heartland Civic Action', 'heartland-civic-action', null, true, 'contact@heartlandcivic.org'),
  ('22222222-2222-2222-2222-222222222222', 'Digital Equity Project', 'digital-equity-project', null, true, 'info@digitalequity.org'),
  ('33333333-3333-3333-3333-333333333333', 'Coastal Justice Alliance', 'coastal-justice-alliance', null, true, 'team@coastaljustice.org'),
  ('44444444-4444-4444-4444-444444444444', 'New Voices Coalition', 'new-voices-coalition', null, true, 'hello@newvoices.org');

-- Insert daily metrics for Heartland
INSERT INTO public.daily_aggregated_metrics (organization_id, date, total_funds_raised, total_donations, total_ad_spend, total_sms_cost, roi_percentage, meta_clicks, meta_impressions, sms_sent, sms_conversions, new_donors)
VALUES
  ('11111111-1111-1111-1111-111111111111', '2025-11-19', 1250, 82, 285, 48, 325, 460, 12500, 1220, 36, 13),
  ('11111111-1111-1111-1111-111111111111', '2025-11-20', 1320, 88, 295, 52, 340, 485, 13200, 1280, 38, 14),
  ('11111111-1111-1111-1111-111111111111', '2025-11-21', 1380, 91, 290, 49, 355, 510, 13800, 1310, 42, 15),
  ('11111111-1111-1111-1111-111111111111', '2025-11-22', 1450, 95, 310, 55, 360, 530, 14200, 1350, 44, 16),
  ('11111111-1111-1111-1111-111111111111', '2025-11-23', 1520, 98, 305, 51, 375, 545, 14500, 1380, 46, 17),
  ('11111111-1111-1111-1111-111111111111', '2025-11-24', 1580, 102, 315, 54, 385, 560, 14800, 1420, 48, 18),
  ('11111111-1111-1111-1111-111111111111', '2025-11-25', 1650, 105, 320, 56, 395, 580, 15100, 1450, 50, 19),
  ('11111111-1111-1111-1111-111111111111', '2025-11-26', 1720, 108, 325, 58, 405, 595, 15400, 1480, 52, 20),
  ('11111111-1111-1111-1111-111111111111', '2025-11-27', 1780, 112, 330, 60, 415, 610, 15700, 1510, 54, 21),
  ('11111111-1111-1111-1111-111111111111', '2025-11-28', 1850, 115, 335, 62, 425, 625, 16000, 1540, 56, 22),
  ('11111111-1111-1111-1111-111111111111', '2025-11-29', 1920, 118, 340, 64, 435, 640, 16300, 1570, 58, 23),
  ('11111111-1111-1111-1111-111111111111', '2025-11-30', 1980, 122, 345, 66, 445, 655, 16600, 1600, 60, 24),
  ('11111111-1111-1111-1111-111111111111', '2025-12-01', 2050, 125, 350, 68, 455, 670, 16900, 1630, 62, 25),
  ('11111111-1111-1111-1111-111111111111', '2025-12-02', 2120, 128, 355, 70, 465, 685, 17200, 1660, 64, 26);

-- Insert daily metrics for Digital Equity (high performer)
INSERT INTO public.daily_aggregated_metrics (organization_id, date, total_funds_raised, total_donations, total_ad_spend, total_sms_cost, roi_percentage, meta_clicks, meta_impressions, sms_sent, sms_conversions, new_donors)
VALUES
  ('22222222-2222-2222-2222-222222222222', '2025-11-19', 2280, 155, 360, 58, 590, 690, 18500, 1820, 58, 24),
  ('22222222-2222-2222-2222-222222222222', '2025-11-20', 2380, 162, 375, 62, 610, 720, 19200, 1880, 62, 26),
  ('22222222-2222-2222-2222-222222222222', '2025-11-21', 2490, 168, 385, 65, 625, 750, 19800, 1940, 66, 28),
  ('22222222-2222-2222-2222-222222222222', '2025-11-22', 2600, 175, 395, 68, 640, 780, 20400, 2000, 70, 30),
  ('22222222-2222-2222-2222-222222222222', '2025-11-23', 2710, 182, 405, 72, 655, 810, 21000, 2060, 74, 32),
  ('22222222-2222-2222-2222-222222222222', '2025-11-24', 2820, 188, 415, 75, 670, 840, 21600, 2120, 78, 34),
  ('22222222-2222-2222-2222-222222222222', '2025-11-25', 2930, 195, 425, 78, 685, 870, 22200, 2180, 82, 36),
  ('22222222-2222-2222-2222-222222222222', '2025-11-26', 3040, 202, 435, 82, 700, 900, 22800, 2240, 86, 38),
  ('22222222-2222-2222-2222-222222222222', '2025-11-27', 3150, 208, 445, 85, 715, 930, 23400, 2300, 90, 40),
  ('22222222-2222-2222-2222-222222222222', '2025-11-28', 3260, 215, 455, 88, 730, 960, 24000, 2360, 94, 42),
  ('22222222-2222-2222-2222-222222222222', '2025-11-29', 3370, 222, 465, 92, 745, 990, 24600, 2420, 98, 44),
  ('22222222-2222-2222-2222-222222222222', '2025-11-30', 3480, 228, 475, 95, 760, 1020, 25200, 2480, 102, 46),
  ('22222222-2222-2222-2222-222222222222', '2025-12-01', 3590, 235, 485, 98, 775, 1050, 25800, 2540, 106, 48),
  ('22222222-2222-2222-2222-222222222222', '2025-12-02', 3700, 242, 495, 102, 790, 1080, 26400, 2600, 110, 50);

-- Insert daily metrics for Coastal Justice (declining)
INSERT INTO public.daily_aggregated_metrics (organization_id, date, total_funds_raised, total_donations, total_ad_spend, total_sms_cost, roi_percentage, meta_clicks, meta_impressions, sms_sent, sms_conversions, new_donors)
VALUES
  ('33333333-3333-3333-3333-333333333333', '2025-11-19', 1380, 72, 325, 52, 270, 395, 10200, 980, 28, 10),
  ('33333333-3333-3333-3333-333333333333', '2025-11-20', 1350, 70, 330, 54, 265, 390, 10000, 965, 27, 9),
  ('33333333-3333-3333-3333-333333333333', '2025-11-21', 1320, 68, 335, 56, 260, 385, 9800, 950, 26, 9),
  ('33333333-3333-3333-3333-333333333333', '2025-11-22', 1290, 66, 340, 58, 255, 380, 9600, 935, 25, 8),
  ('33333333-3333-3333-3333-333333333333', '2025-11-23', 1260, 64, 345, 60, 250, 375, 9400, 920, 24, 8),
  ('33333333-3333-3333-3333-333333333333', '2025-11-24', 1230, 62, 350, 62, 245, 370, 9200, 905, 23, 7),
  ('33333333-3333-3333-3333-333333333333', '2025-11-25', 1200, 60, 355, 64, 240, 365, 9000, 890, 22, 7),
  ('33333333-3333-3333-3333-333333333333', '2025-11-26', 1170, 58, 360, 66, 235, 360, 8800, 875, 21, 6),
  ('33333333-3333-3333-3333-333333333333', '2025-11-27', 1140, 56, 365, 68, 230, 355, 8600, 860, 20, 6),
  ('33333333-3333-3333-3333-333333333333', '2025-11-28', 1110, 54, 370, 70, 225, 350, 8400, 845, 19, 5),
  ('33333333-3333-3333-3333-333333333333', '2025-11-29', 1080, 52, 375, 72, 220, 345, 8200, 830, 18, 5),
  ('33333333-3333-3333-3333-333333333333', '2025-11-30', 1050, 50, 380, 74, 215, 340, 8000, 815, 17, 4),
  ('33333333-3333-3333-3333-333333333333', '2025-12-01', 1020, 48, 385, 76, 210, 335, 7800, 800, 16, 4),
  ('33333333-3333-3333-3333-333333333333', '2025-12-02', 990, 46, 390, 78, 205, 330, 7600, 785, 15, 3);

-- Insert daily metrics for New Voices (ramping up fast)
INSERT INTO public.daily_aggregated_metrics (organization_id, date, total_funds_raised, total_donations, total_ad_spend, total_sms_cost, roi_percentage, meta_clicks, meta_impressions, sms_sent, sms_conversions, new_donors)
VALUES
  ('44444444-4444-4444-4444-444444444444', '2025-11-19', 450, 28, 185, 32, 160, 230, 5800, 560, 16, 7),
  ('44444444-4444-4444-4444-444444444444', '2025-11-20', 520, 32, 190, 34, 175, 245, 6100, 590, 18, 8),
  ('44444444-4444-4444-4444-444444444444', '2025-11-21', 590, 36, 195, 36, 190, 260, 6400, 620, 20, 9),
  ('44444444-4444-4444-4444-444444444444', '2025-11-22', 660, 40, 200, 38, 205, 275, 6700, 650, 22, 10),
  ('44444444-4444-4444-4444-444444444444', '2025-11-23', 730, 44, 205, 40, 220, 290, 7000, 680, 24, 11),
  ('44444444-4444-4444-4444-444444444444', '2025-11-24', 800, 48, 210, 42, 235, 305, 7300, 710, 26, 12),
  ('44444444-4444-4444-4444-444444444444', '2025-11-25', 870, 52, 215, 44, 250, 320, 7600, 740, 28, 13),
  ('44444444-4444-4444-4444-444444444444', '2025-11-26', 940, 56, 220, 46, 265, 335, 7900, 770, 30, 14),
  ('44444444-4444-4444-4444-444444444444', '2025-11-27', 1010, 60, 225, 48, 280, 350, 8200, 800, 32, 15),
  ('44444444-4444-4444-4444-444444444444', '2025-11-28', 1080, 64, 230, 50, 295, 365, 8500, 830, 34, 16),
  ('44444444-4444-4444-4444-444444444444', '2025-11-29', 1150, 68, 235, 52, 310, 380, 8800, 860, 36, 17),
  ('44444444-4444-4444-4444-444444444444', '2025-11-30', 1220, 72, 240, 54, 325, 395, 9100, 890, 38, 18),
  ('44444444-4444-4444-4444-444444444444', '2025-12-01', 1290, 76, 245, 56, 340, 410, 9400, 920, 40, 19),
  ('44444444-4444-4444-4444-444444444444', '2025-12-02', 1360, 80, 250, 58, 355, 425, 9700, 950, 42, 20);

-- Insert API credentials
INSERT INTO public.client_api_credentials (organization_id, platform, encrypted_credentials, is_active, last_sync_at, last_sync_status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'meta', '{"encrypted": true}', true, now() - interval '2 hours', 'success'),
  ('11111111-1111-1111-1111-111111111111', 'switchboard', '{"encrypted": true}', true, now() - interval '3 hours', 'success'),
  ('22222222-2222-2222-2222-222222222222', 'meta', '{"encrypted": true}', true, now() - interval '1 hour', 'success'),
  ('22222222-2222-2222-2222-222222222222', 'switchboard', '{"encrypted": true}', true, now() - interval '1 hour', 'success'),
  ('33333333-3333-3333-3333-333333333333', 'meta', '{"encrypted": true}', true, now() - interval '6 hours', 'failed'),
  ('33333333-3333-3333-3333-333333333333', 'switchboard', '{"encrypted": true}', true, now() - interval '4 hours', 'success'),
  ('44444444-4444-4444-4444-444444444444', 'meta', '{"encrypted": true}', true, now() - interval '12 hours', 'success'),
  ('44444444-4444-4444-4444-444444444444', 'switchboard', '{"encrypted": true}', false, null, null);

-- Insert entity watchlist items
INSERT INTO public.entity_watchlist (organization_id, entity_name, entity_type, aliases, alert_threshold, sentiment_alert, is_active)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Farm Bill', 'issue', ARRAY['Agriculture Act'], 5, true, true),
  ('11111111-1111-1111-1111-111111111111', 'Rural Healthcare', 'topic', ARRAY['Rural Health'], 3, true, true),
  ('22222222-2222-2222-2222-222222222222', 'Digital Divide', 'topic', ARRAY['Broadband Access'], 4, true, true),
  ('22222222-2222-2222-2222-222222222222', 'AI Regulation', 'issue', ARRAY['AI Governance'], 5, true, true),
  ('33333333-3333-3333-3333-333333333333', 'EPA Regulations', 'issue', ARRAY['Environmental Protection'], 4, true, true),
  ('33333333-3333-3333-3333-333333333333', 'Coastal Erosion', 'topic', ARRAY['Sea Level Rise'], 3, true, true),
  ('44444444-4444-4444-4444-444444444444', 'Youth Voting', 'topic', ARRAY['Gen Z Voters'], 3, true, true),
  ('44444444-4444-4444-4444-444444444444', 'Student Debt', 'issue', ARRAY['Student Loans'], 4, true, true);

-- Insert client entity alerts
INSERT INTO public.client_entity_alerts (organization_id, entity_name, alert_type, severity, is_actionable, actionable_score, current_mentions, velocity, suggested_action, sample_sources, is_read, triggered_at)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Farm Bill', 'spike', 'critical', true, 92, 47, 234.5, 'New Farm Bill amendments announced - send urgent appeal to rural donor base', '[{"type": "news", "title": "Senate unveils Farm Bill changes"}]'::jsonb, false, now() - interval '25 minutes'),
  ('11111111-1111-1111-1111-111111111111', 'Rural Healthcare', 'sentiment_shift', 'high', true, 78, 23, 156.2, 'Negative sentiment on rural hospital closures - messaging around healthcare access', '[{"type": "news", "title": "Rural hospital closure crisis"}]'::jsonb, false, now() - interval '2 hours'),
  ('22222222-2222-2222-2222-222222222222', 'Digital Divide', 'spike', 'critical', true, 95, 89, 312.8, 'Major broadband funding announcement - capitalize with fundraising push', '[{"type": "news", "title": "$42B broadband plan announced"}]'::jsonb, false, now() - interval '45 minutes'),
  ('22222222-2222-2222-2222-222222222222', 'AI Regulation', 'breaking', 'high', true, 85, 156, 445.3, 'EU AI Act implementation begins - position as thought leader', '[{"type": "news", "title": "EU AI Act enforcement"}]'::jsonb, false, now() - interval '1 hour'),
  ('33333333-3333-3333-3333-333333333333', 'EPA Regulations', 'spike', 'high', true, 81, 34, 178.9, 'EPA rollback proposals - mobilize coastal communities', '[{"type": "news", "title": "EPA regulation changes"}]'::jsonb, false, now() - interval '3 hours'),
  ('33333333-3333-3333-3333-333333333333', 'Coastal Erosion', 'sentiment_shift', 'medium', true, 65, 18, 89.4, 'Rising concern about coastal property - frame around community protection', '[{"type": "social", "title": "Coastal erosion concerns"}]'::jsonb, false, now() - interval '5 hours'),
  ('44444444-4444-4444-4444-444444444444', 'Youth Voting', 'spike', 'critical', true, 88, 234, 523.7, 'Youth voter registration surge - launch peer-to-peer fundraising', '[{"type": "news", "title": "Record youth voter registration"}]'::jsonb, false, now() - interval '30 minutes'),
  ('44444444-4444-4444-4444-444444444444', 'Student Debt', 'breaking', 'high', true, 82, 167, 398.2, 'New student debt relief program - targeted appeal to young donors', '[{"type": "news", "title": "New debt relief pathway"}]'::jsonb, false, now() - interval '2 hours');
