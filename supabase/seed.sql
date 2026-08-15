-- Seeds ~2 weeks of prior check-in history for one parent so the dashboard's trend chart has
-- a baseline to plot before the live demo call adds today's data point. Replace the parent_id
-- below with the id of the parent row you want to seed (see the `parents` table).

with target_parent as (
    select id from parents where phone_number = '+918302862835' limit 1
)
insert into calls (parent_id, timestamp, transcript, mood_score, coherence_score, medication_taken, new_complaint, flagged_urgent)
select
    target_parent.id,
    now() - (n || ' days')::interval + interval '9 hours 30 minutes',
    'Seeded historical check-in call, day -' || n || '. (No live transcript -- seed data for demo trend chart.)',
    (array[4, 4, 5, 5, 4, 3])[1 + (n % 6)],
    (array[4, 5, 5, 4])[1 + (n % 4)],
    (array['yes', 'yes', 'yes', 'no'])[1 + (n % 4)],
    case when n = 8 then 'mild knee pain' when n = 5 then 'trouble sleeping' else null end,
    false
from target_parent, generate_series(13, 1, -1) as n;
