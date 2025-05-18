create extension if not exists "pg_net" with schema "public" version '0.14.0';

create sequence "public"."function_debug_logs_id_seq";

create table "public"."function_debug_logs" (
    "id" integer not null default nextval('function_debug_logs_id_seq'::regclass),
    "function_name" text,
    "called_at" timestamp with time zone default now(),
    "user_role" text,
    "parameters" jsonb,
    "result" text
);


alter sequence "public"."function_debug_logs_id_seq" owned by "public"."function_debug_logs"."id";

CREATE UNIQUE INDEX function_debug_logs_pkey ON public.function_debug_logs USING btree (id);

alter table "public"."function_debug_logs" add constraint "function_debug_logs_pkey" PRIMARY KEY using index "function_debug_logs_pkey";

grant delete on table "public"."function_debug_logs" to "anon";

grant insert on table "public"."function_debug_logs" to "anon";

grant references on table "public"."function_debug_logs" to "anon";

grant select on table "public"."function_debug_logs" to "anon";

grant trigger on table "public"."function_debug_logs" to "anon";

grant truncate on table "public"."function_debug_logs" to "anon";

grant update on table "public"."function_debug_logs" to "anon";

grant delete on table "public"."function_debug_logs" to "authenticated";

grant insert on table "public"."function_debug_logs" to "authenticated";

grant references on table "public"."function_debug_logs" to "authenticated";

grant select on table "public"."function_debug_logs" to "authenticated";

grant trigger on table "public"."function_debug_logs" to "authenticated";

grant truncate on table "public"."function_debug_logs" to "authenticated";

grant update on table "public"."function_debug_logs" to "authenticated";

grant delete on table "public"."function_debug_logs" to "service_role";

grant insert on table "public"."function_debug_logs" to "service_role";

grant references on table "public"."function_debug_logs" to "service_role";

grant select on table "public"."function_debug_logs" to "service_role";

grant trigger on table "public"."function_debug_logs" to "service_role";

grant truncate on table "public"."function_debug_logs" to "service_role";

grant update on table "public"."function_debug_logs" to "service_role";


