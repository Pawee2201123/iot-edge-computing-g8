"""
PostgreSQL database configuration and connection management
for IoT Edge Computing Project
"""
import psycopg2
from psycopg2 import pool
import os
from pathlib import Path
from contextlib import contextmanager
from dotenv import load_dotenv

# Load environment variables from .env file
env_path = Path(__file__).parent / '.env'
load_dotenv(dotenv_path=env_path)

# Database configuration from environment variables
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'edgedevices'),
    'user': os.getenv('DB_USER', 'iot_user'),
    'password': os.getenv('DB_PASSWORD', '')
}

# Connection pool (min 1, max 10 connections)
connection_pool = None

def init_db_pool():
    """Initialize the PostgreSQL connection pool"""
    global connection_pool
    try:
        connection_pool = psycopg2.pool.SimpleConnectionPool(
            1, 10,
            **DB_CONFIG
        )
        if connection_pool:
            print(f"✅ PostgreSQL connection pool created (host: {DB_CONFIG['host']}, db: {DB_CONFIG['database']})")
            return True
    except Exception as e:
        print(f"❌ Failed to create PostgreSQL connection pool: {e}")
        return False

@contextmanager
def get_db_connection():
    """
    Context manager for database connections
    Usage:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(...)
    """
    conn = None
    try:
        conn = connection_pool.getconn()
        yield conn
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            connection_pool.putconn(conn)

def close_db_pool():
    """Close all database connections in the pool"""
    global connection_pool
    if connection_pool:
        connection_pool.closeall()
        print("🔒 PostgreSQL connection pool closed")

def insert_commu_data(emerg=None, msg=None):
    """
    Insert communication unit data into Commu table

    Args:
        emerg (bool): Emergency button state (True if pressed)
        msg (str): Message text
    """
    if connection_pool is None:
        print("⚠️ Database pool not initialized, skipping insert")
        return False

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO Commu (emerg, msg) VALUES (%s, %s)",
                (emerg, msg)
            )
            cursor.close()
            return True
    except Exception as e:
        print(f"❌ Failed to insert Commu data: {e}")
        return False

def insert_heat_data(temp, hum, wbgt):
    """
    Insert environmental monitoring data into Heat table

    Args:
        temp (float): Temperature in Celsius
        hum (float): Humidity percentage
        wbgt (float): Wet Bulb Globe Temperature
    """
    if connection_pool is None:
        print("⚠️ Database pool not initialized, skipping insert")
        return False

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO Heat (temp, hum, wbgt) VALUES (%s, %s, %s)",
                (temp, hum, wbgt)
            )
            cursor.close()
            return True
    except Exception as e:
        print(f"❌ Failed to insert Heat data: {e}")
        return False

def test_connection():
    """Test database connection and print status"""
    if connection_pool is None:
        print("❌ Connection pool not initialized")
        return False

    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT version();")
            version = cursor.fetchone()
            cursor.close()
            print(f"✅ PostgreSQL connection successful: {version[0]}")
            return True
    except Exception as e:
        print(f"❌ Database connection test failed: {e}")
        return False
