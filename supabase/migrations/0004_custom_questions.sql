-- Nice-to-have from the PRD: lets each family add extra things HaalChaal should ask about
-- beyond the default mood/medication/complaints/sleep questions (e.g. "ask about her knee pain").

alter table parents add column if not exists custom_questions text;
