# PostgreSQL Terminal Cheatsheet

## Connect to Database

```bash
# Method 1: Using password in environment
PGPASSWORD='iot_pass_2026' psql -U iot_user -d edgedevices

# Method 2: It will prompt for password
psql -U iot_user -d edgedevices
```

## Basic psql Commands (inside psql)

```sql
\dt              -- List all tables
\d heat          -- Describe heat table structure
\d commu         -- Describe commu table structure
\q               -- Quit psql
\?               -- Show help for psql commands
\h               -- Show help for SQL commands
```

## View All Data

```sql
-- View all records from heat table
SELECT * FROM heat;

-- View all records from commu table
SELECT * FROM commu;
```

## View Recent Data

```sql
-- Last 10 environmental readings
SELECT * FROM heat ORDER BY time DESC LIMIT 10;

-- Last 10 communication events
SELECT * FROM commu ORDER BY time DESC LIMIT 10;

-- Only emergency events
SELECT * FROM commu WHERE emerg = TRUE ORDER BY time DESC;
```

## Pretty Formatting

```sql
-- Expanded display (each column on new line)
\x
SELECT * FROM heat LIMIT 1;
\x  -- Toggle back to normal

-- Set borders for better readability
\pset border 2
SELECT * FROM heat LIMIT 5;
```

## Count Records

```sql
-- Total records
SELECT COUNT(*) FROM heat;
SELECT COUNT(*) FROM commu;

-- Count by type
SELECT emerg, COUNT(*) FROM commu GROUP BY emerg;
```

## Time-based Queries

```sql
-- Data from last hour
SELECT * FROM heat WHERE time > NOW() - INTERVAL '1 hour';

-- Data from today
SELECT * FROM heat WHERE time::date = CURRENT_DATE;

-- Data from last 24 hours
SELECT * FROM commu WHERE time > NOW() - INTERVAL '24 hours';
```

## One-Line Commands (without entering psql)

```bash
# View all heat data
PGPASSWORD='iot_pass_2026' psql -U iot_user -d edgedevices -c "SELECT * FROM heat;"

# View last 5 records from commu
PGPASSWORD='iot_pass_2026' psql -U iot_user -d edgedevices -c "SELECT * FROM commu ORDER BY time DESC LIMIT 5;"

# Count records
PGPASSWORD='iot_pass_2026' psql -U iot_user -d edgedevices -c "SELECT COUNT(*) FROM heat;"

# View emergency events only
PGPASSWORD='iot_pass_2026' psql -U iot_user -d edgedevices -c "SELECT * FROM commu WHERE emerg = TRUE;"
```

## Useful Formatting Options

```bash
# Aligned format (default)
psql -U iot_user -d edgedevices -c "SELECT * FROM heat;"

# HTML output
psql -U iot_user -d edgedevices -H -c "SELECT * FROM heat;" > heat.html

# CSV output
psql -U iot_user -d edgedevices -c "COPY (SELECT * FROM heat) TO STDOUT WITH CSV HEADER;" > heat.csv

# JSON-like output (expanded)
psql -U iot_user -d edgedevices -x -c "SELECT * FROM heat LIMIT 1;"
```

## Watch Mode (Auto-refresh)

```bash
# Refresh every 2 seconds
watch -n 2 "PGPASSWORD='iot_pass_2026' psql -U iot_user -d edgedevices -c 'SELECT * FROM heat ORDER BY time DESC LIMIT 5;'"
```

## Statistics

```sql
-- Average temperature
SELECT AVG(temp) as avg_temp, AVG(hum) as avg_humidity FROM heat;

-- Min/Max temperature today
SELECT MIN(temp), MAX(temp) FROM heat WHERE time::date = CURRENT_DATE;

-- Emergency count per day
SELECT time::date, COUNT(*)
FROM commu
WHERE emerg = TRUE
GROUP BY time::date
ORDER BY time::date DESC;
```
