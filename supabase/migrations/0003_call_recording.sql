-- Adds call_sid so the recording-status webhook can match a finished Twilio recording back to
-- the right calls row after the fact (the row is inserted when the LLM conversation ends, but
-- the recording itself usually finishes a few seconds later).

alter table calls add column if not exists call_sid text;
create index if not exists calls_call_sid_idx on calls (call_sid);
