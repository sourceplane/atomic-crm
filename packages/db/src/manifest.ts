import type { MigrationManifest } from "./types.js";

// Every migration the runner applies, in order, with the sha256 of its file:
// the control migration, upstream's supabase/migrations in their order (the
// history `supabase db push` applies; three carry a recorded edit, each marked
// "Port:" in the file), upstream's seed, then the port's own.
// `pnpm --filter @saas/db run manifest:check` verifies the checksums;
// `manifest:fix` rewrites them after a migration file changes (only ever
// before that migration has been applied anywhere — an applied migration's
// checksum is immutable).
export const manifest: MigrationManifest = {
  version: 1,
  migrations: [
    {
      id: "000_control_baseline",
      context: "control",
      path: "000_control/up.sql",
      checksum:
        "2a5d7f30684c99e3ff441ca8a2c38038dedd1bab4db4a40e92cd36bb22be297f",
      description:
        "Baseline control migration — creates the migration tracking schema",
    },
    {
      id: "20240730075029_init_db",
      context: "app",
      path: "20240730075029_init_db/up.sql",
      checksum:
        "98e91400b620d803f91880a858e379354736ec0cd5fe65eeb73fad9174794bee",
      description:
        "Upstream's migration 20240730075029_init_db (init db)",
    },
    {
      id: "20240730075425_init_triggers",
      context: "app",
      path: "20240730075425_init_triggers/up.sql",
      checksum:
        "dd91da42a8f9eff0f2c30a9d88c383409ad94f4f9401b1e81b81562ad208b913",
      description:
        "Upstream's migration 20240730075425_init_triggers (init triggers)",
    },
    {
      id: "20240806124555_task_sales_id",
      context: "app",
      path: "20240806124555_task_sales_id/up.sql",
      checksum:
        "1057601d37adc00bb2810fcf11bc38c3a6ba9fdd8ae2a7b160ce4049ab64b389",
      description:
        "Upstream's migration 20240806124555_task_sales_id (task sales id)",
    },
    {
      id: "20240807082449_remove-aquisition",
      context: "app",
      path: "20240807082449_remove-aquisition/up.sql",
      checksum:
        "4b10d44c974dbdb7a5fa09eade9b9a7144af56a1bb2002f45e4410d8a3120a60",
      description:
        "Upstream's migration 20240807082449_remove-aquisition (remove aquisition)",
    },
    {
      id: "20240808141826_init_state_configure",
      context: "app",
      path: "20240808141826_init_state_configure/up.sql",
      checksum:
        "2298da7dd67e2425bb28c7ebd090cb53b470c6f212669fdaa8f38d5ddf71bfa8",
      description:
        "Upstream's migration 20240808141826_init_state_configure (init state configure)",
    },
    {
      id: "20240813084010_tags_policy",
      context: "app",
      path: "20240813084010_tags_policy/up.sql",
      checksum:
        "6b4b0ae79f6b88f5d46332970d28ab484786d3b392dc4df3be7a10cccc29c9d5",
      description:
        "Upstream's migration 20240813084010_tags_policy (tags policy)",
    },
    {
      id: "20241104153231_sales_policies",
      context: "app",
      path: "20241104153231_sales_policies/up.sql",
      checksum:
        "3e2fb0e0a110259385001cc394513d8aa0f6ab28b35eaf9ec6a415634b155565",
      description:
        "Upstream's migration 20241104153231_sales_policies (sales policies)",
    },
    {
      id: "20250109152531_email_jsonb",
      context: "app",
      path: "20250109152531_email_jsonb/up.sql",
      checksum:
        "746c6fd6dbb0e3824d2be00de3015d6ad036ea633cf192bea75a4442dc3aa345",
      description:
        "Upstream's migration 20250109152531_email_jsonb (email jsonb)",
    },
    {
      id: "20250113132531_phone_jsonb",
      context: "app",
      path: "20250113132531_phone_jsonb/up.sql",
      checksum:
        "af00450cbf61252238f7bbcdb195274e236ae35f3cc14ffd093937aead457597",
      description:
        "Upstream's migration 20250113132531_phone_jsonb (phone jsonb)",
    },
    {
      id: "20251204172855_merge_contacts_function",
      context: "app",
      path: "20251204172855_merge_contacts_function/up.sql",
      checksum:
        "36fab4bf40f02d61789e885dc7e6affedcdf513e48f35ac1baaa59b56775ce7e",
      description:
        "Upstream's migration 20251204172855_merge_contacts_function (merge contacts function)",
    },
    {
      id: "20251204201317_drop_merge_contacts_function",
      context: "app",
      path: "20251204201317_drop_merge_contacts_function/up.sql",
      checksum:
        "d6a747c8cfe31e54cd4dcd95ae78dccd77a6da4f9d0958e581b6f5fb6cc8da74",
      description:
        "Upstream's migration 20251204201317_drop_merge_contacts_function (drop merge contacts function)",
    },
    {
      id: "20260108160722_task_default_sales",
      context: "app",
      path: "20260108160722_task_default_sales/up.sql",
      checksum:
        "8d4bd685983ebbe54d8fa1f0e29a259591109ee39c17088607dea4f43ec0006d",
      description:
        "Upstream's migration 20260108160722_task_default_sales (task default sales)",
    },
    {
      id: "20260115150819_snake_case_renaming",
      context: "app",
      path: "20260115150819_snake_case_renaming/up.sql",
      checksum:
        "69dc488502bad36dad3d4af0b56a0edd53224e48ddb1ea8585a78f663c54d2f1",
      description:
        "Upstream's migration 20260115150819_snake_case_renaming (snake case renaming)",
    },
    {
      id: "20260127140209_imports",
      context: "app",
      path: "20260127140209_imports/up.sql",
      checksum:
        "4edb2bcb44d822a42dfcc3047d700db3a9b4383ecb5726bfb7cc4adc4f16e627",
      description:
        "Upstream's migration 20260127140209_imports (imports) — with the port's one recorded edit (see the file's Port: comment)",
    },
    {
      id: "20260128165057_sso_handling",
      context: "app",
      path: "20260128165057_sso_handling/up.sql",
      checksum:
        "3e26fa9bda48a6b244d6ac107cc1d90af1a4099c2cbf5967fe0bac9d98a2aad2",
      description:
        "Upstream's migration 20260128165057_sso_handling (sso handling) — with the port's one recorded edit (see the file's Port: comment)",
    },
    {
      id: "20260211194545_app_configuration",
      context: "app",
      path: "20260211194545_app_configuration/up.sql",
      checksum:
        "6bcf97a0d046deb31029905b7c47116fb29338964621498b16d34230e06dbbe5",
      description:
        "Upstream's migration 20260211194545_app_configuration (app configuration)",
    },
    {
      id: "20260226163952_deals_expected_closing_date_date_only",
      context: "app",
      path: "20260226163952_deals_expected_closing_date_date_only/up.sql",
      checksum:
        "010d673c16338eff3bfdb0e469e99a003f60ad34f7822c37f3a47365816da0b5",
      description:
        "Upstream's migration 20260226163952_deals_expected_closing_date_date_only (deals expected closing date date only)",
    },
    {
      id: "20260304104600_note_attachments_trigger",
      context: "app",
      path: "20260304104600_note_attachments_trigger/up.sql",
      checksum:
        "4139e23e7f63bd6ee2c11f9e021b5e7143a617b2af30b52ee0fcd2e5a3e4a36d",
      description:
        "Upstream's migration 20260304104600_note_attachments_trigger (note attachments trigger) — with the port's one recorded edit (see the file's Port: comment)",
    },
    {
      id: "20260307120000_nb_tasks_pending_only",
      context: "app",
      path: "20260307120000_nb_tasks_pending_only/up.sql",
      checksum:
        "e28665cc2f0d91ff57f69bf0ff2b5d1ba2f5f9cd9814f7e1b46d981fb7bc38ea",
      description:
        "Upstream's migration 20260307120000_nb_tasks_pending_only (nb tasks pending only)",
    },
    {
      id: "20260309112831_fix_security_warnings",
      context: "app",
      path: "20260309112831_fix_security_warnings/up.sql",
      checksum:
        "a4f875c6d4bec41bdfc70cc1933d7789899eff8902733c33463574d44977ce5a",
      description:
        "Upstream's migration 20260309112831_fix_security_warnings (fix security warnings) — with the port's one recorded edit (see the file's Port: comment)",
    },
    {
      id: "20260314120000_activity_log_view",
      context: "app",
      path: "20260314120000_activity_log_view/up.sql",
      checksum:
        "2464e05372774e35f44aeded0f102a5ecd61319d8faac8f9d9c74f6d2eeba552",
      description:
        "Upstream's migration 20260314120000_activity_log_view (activity log view)",
    },
    {
      id: "20260320120000_lowercase_email_website",
      context: "app",
      path: "20260320120000_lowercase_email_website/up.sql",
      checksum:
        "c9f2889d6426b0e8bccfbab379ec3289ec98390fd5f1c4ebb0d07351295acefc",
      description:
        "Upstream's migration 20260320120000_lowercase_email_website (lowercase email website)",
    },
    {
      id: "20260601120000_grant_init_state_to_api_roles",
      context: "app",
      path: "20260601120000_grant_init_state_to_api_roles/up.sql",
      checksum:
        "a05670a1c8e60b2bb5910daf1dbeb879ed574e9eca7924076fc295a0eece551f",
      description:
        "Upstream's migration 20260601120000_grant_init_state_to_api_roles (grant init state to api roles)",
    },
    {
      id: "20260811131131_sales_secondary_emails",
      context: "app",
      path: "20260811131131_sales_secondary_emails/up.sql",
      checksum:
        "b7d125dce0e526677134d2afcae8db648f1bd2a19923bc8068e86a95c3391e06",
      description:
        "Upstream's migration 20260811131131_sales_secondary_emails (sales secondary emails)",
    },
    {
      id: "20260924120000_deals_lost_reason",
      context: "app",
      path: "20260924120000_deals_lost_reason/up.sql",
      checksum:
        "ac6c9aaad335756e88a88a9a68a7bfffdbe8bc38c4adeaaabab019b9d28eb54b",
      description:
        "Upstream's migration 20260924120000_deals_lost_reason (deals lost reason)",
    },
    {
      id: "20260928120000_drop_deals_lost_reason",
      context: "app",
      path: "20260928120000_drop_deals_lost_reason/up.sql",
      checksum:
        "d21ffb9b7633e1d79be79c67266f96c875d0382067ec85e6765aed2fc1c8d88f",
      description:
        "Upstream's migration 20260928120000_drop_deals_lost_reason (drop deals lost reason)",
    },
    {
      id: "20260929120000_remove_deleted_tag_from_contacts",
      context: "app",
      path: "20260929120000_remove_deleted_tag_from_contacts/up.sql",
      checksum:
        "36dc86b35b4fd3385a8a0032fab07e331f065ca8bd73e50d3a0d8e38fd782991",
      description:
        "Upstream's migration 20260929120000_remove_deleted_tag_from_contacts (remove deleted tag from contacts)",
    },
    {
      id: "20261010054346_global_search",
      context: "app",
      path: "20261010054346_global_search/up.sql",
      checksum:
        "113aaaf4144eae956932a66a57a8e0228fb6474f46a391fad367bb7b02ad7fa0",
      description:
        "Upstream's migration 20261010054346_global_search (global search)",
    },
    {
      id: "20261022120000_global_search_per_resource_cap",
      context: "app",
      path: "20261022120000_global_search_per_resource_cap/up.sql",
      checksum:
        "4397b3198a95eaf64e0a2bfaa5c77b695479bdf5ee04e5275e55e6f14be3000c",
      description:
        "Upstream's migration 20261022120000_global_search_per_resource_cap (global search per resource cap)",
    },
    {
      id: "20261026120000_deal_categories",
      context: "app",
      path: "20261026120000_deal_categories/up.sql",
      checksum:
        "4e7f91a41bab6880c75559bc989a2c7e1742535373331e5802af34166f299759",
      description:
        "Upstream's migration 20261026120000_deal_categories (deal categories)",
    },
    {
      id: "20261101000000_seed",
      context: "app",
      path: "20261101000000_seed/up.sql",
      checksum:
        "4df09f10f14a4c67eb444ca3a3b7ad6f606e8d82383ed995168638c435a9c049",
      description:
        "Upstream's seed.sql: the mail domains whose favicon is never fetched (its remote setup applies it with db push --include-seed)",
    },
    {
      id: "20261101000100_note_attachments_outbox",
      context: "app",
      path: "20261101000100_note_attachments_outbox/up.sql",
      checksum:
        "a35e23d09ab2f10662f41b3dfb9b15a45f829f5b9d0dcae556d3f7b04e86a230",
      description:
        "The port: cleanup_note_attachments() queues the note's old and new record in private.note_attachment_cleanups, which the Worker's Cron Trigger drains through the Storage API, instead of calling the edge function through pg_net",
    },
  ],
};
