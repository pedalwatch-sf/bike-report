-- Renaming a category (lib/categories.js) doesn't retroactively relabel
-- reports already saved with the old text, since category is a plain
-- text column, not an enum.
update public.suggestions
set category = 'Road needs repair'
where category = 'Existing lane needs repair';
