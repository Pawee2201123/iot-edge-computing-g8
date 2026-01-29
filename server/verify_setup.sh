#!/bin/bash
# Quick verification script for database setup

echo "🔍 Verifying PostgreSQL setup..."
echo ""

# Test database connection
echo "1. Testing database connection..."
PGPASSWORD='iot_pass_2026' psql -U iot_user -d edgedevices -c "SELECT version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✅ Connection successful"
else
    echo "   ❌ Connection failed"
    exit 1
fi

# Check tables exist
echo "2. Checking tables..."
TABLES=$(PGPASSWORD='iot_pass_2026' psql -U iot_user -d edgedevices -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
if [ "$TABLES" -eq 2 ]; then
    echo "   ✅ Both tables (commu, heat) exist"
else
    echo "   ❌ Expected 2 tables, found $TABLES"
    exit 1
fi

# Check .env file exists
echo "3. Checking .env file..."
if [ -f ".env" ]; then
    echo "   ✅ .env file exists"
else
    echo "   ❌ .env file not found"
    exit 1
fi

echo ""
echo "🎉 Database setup verified successfully!"
echo ""
echo "To start the Flask server:"
echo "  cd server"
echo "  python app.py"
