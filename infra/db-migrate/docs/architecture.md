# db-migrate — architecture

Applies the migrations under `packages/db/src/migrations` in order, recording each one
it applies so a run only ever applies what is new. An already-applied migration
is never edited: a change is a new, later migration.

## Migrations

- `000_control`
- `20240730075029_init_db`
- `20240730075425_init_triggers`
- `20240806124555_task_sales_id`
- `20240807082449_remove-aquisition`
- `20240808141826_init_state_configure`
- `20240813084010_tags_policy`
- `20241104153231_sales_policies`
- `20250109152531_email_jsonb`
- `20250113132531_phone_jsonb`
- `20251204172855_merge_contacts_function`
- `20251204201317_drop_merge_contacts_function`
- `20260108160722_task_default_sales`
- `20260115150819_snake_case_renaming`
- `20260127140209_imports`
- `20260128165057_sso_handling`
- `20260211194545_app_configuration`
- `20260226163952_deals_expected_closing_date_date_only`
- `20260304104600_note_attachments_trigger`
- `20260307120000_nb_tasks_pending_only`
- `20260309112831_fix_security_warnings`
- `20260314120000_activity_log_view`
- `20260320120000_lowercase_email_website`
- `20260601120000_grant_init_state_to_api_roles`
- `20260811131131_sales_secondary_emails`
- `20260924120000_deals_lost_reason`
- `20260928120000_drop_deals_lost_reason`
- `20260929120000_remove_deleted_tag_from_contacts`
- `20261010054346_global_search`
- `20261022120000_global_search_per_resource_cap`
- `20261026120000_deal_categories`
- `20261101000000_seed`
- `20261101000100_note_attachments_outbox`

## Resolved at run time (names only)

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_DB_URL`
- `SUPABASE_PROJECT_REF`
