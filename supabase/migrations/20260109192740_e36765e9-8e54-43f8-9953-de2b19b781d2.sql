
-- Add suggested actions with valid action_types
INSERT INTO suggested_actions (organization_id, action_type, entity_name, suggested_copy, urgency_score, estimated_impact, status, created_at)
VALUES 
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'sms_fundraising', 'EOY Momentum', 'Your EOY campaign exceeded targets by 23%. Send a thank-you to maintain engagement. Thank you for making 2025 our best year yet!', 0.9, 'high', 'pending', '2026-01-02 10:00:00'),
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'email_blast', 'Lapsed Donors', '145 donors who gave last December have not donated yet. Send a personalized re-engagement email showing their impact.', 0.7, 'medium', 'pending', '2026-01-05 09:00:00'),
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'action_alert', 'Flash Opportunity', 'Breaking news coverage presents a 48-hour fundraising window. Capitalize on heightened awareness with urgent messaging.', 0.95, 'high', 'pending', '2026-01-10 14:00:00'),
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'email_blast', 'New Donor Welcome', '67 new donors joined in the last 2 weeks. Send a welcome series introducing your organization impact and upcoming priorities.', 0.6, 'medium', 'pending', '2026-01-08 11:00:00'),
  ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'sms_fundraising', 'Recurring Upgrade', '28 one-time donors gave 3+ times in 2025. Convert them to monthly sustainers with a targeted ask highlighting sustained impact.', 0.75, 'high', 'pending', '2026-01-11 10:00:00');
