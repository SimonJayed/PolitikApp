# Supabase Migration

The Supabase-ready schema is in:

```text
supabase/migrations/20260524182000_create_politikapp_core_schema.sql
```

## Run Through Supabase Dashboard

1. Open your Supabase project.
2. Go to `SQL Editor`.
3. Open the migration file above.
4. Paste the SQL into the editor.
5. Click `Run`.

## Run Through Supabase CLI

Install the Supabase CLI first, then run:

```powershell
supabase login
supabase link --project-ref wqzlesfkieqjkvdjdjng
supabase db push
```

## Backend Environment

The backend also contains the migration in:

```text
backend/src/main/resources/db/migration/V1__create_politikapp_core_schema.sql
```

To let Spring Boot create the tables through Flyway, point it to Supabase and enable Flyway:

```powershell
$env:DATABASE_URL="jdbc:postgresql://db.wqzlesfkieqjkvdjdjng.supabase.co:5432/postgres?sslmode=require"
$env:DATABASE_USERNAME="postgres"
$env:DATABASE_PASSWORD="your-supabase-database-password"
$env:DATABASE_DRIVER="org.postgresql.Driver"
$env:JPA_DATABASE_PLATFORM="org.hibernate.dialect.PostgreSQLDialect"
$env:JPA_DDL_AUTO="validate"
$env:FLYWAY_ENABLED="true"
mvn -f backend\pom.xml spring-boot:run
```

Use `JPA_DDL_AUTO=validate` for Supabase so Hibernate checks the schema without rewriting it.

If your network cannot connect to the direct database host because of IPv4 restrictions, copy the Session Pooler host and port from Supabase and replace `DATABASE_URL` with:

```powershell
$env:DATABASE_URL="jdbc:postgresql://SESSION_POOLER_HOST:SESSION_POOLER_PORT/postgres?sslmode=require"
```
