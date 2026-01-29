-- PostgreSQL schema for IoT Edge Computing Project
-- Database: EdgeDevices
-- Tables: Commu (Communication Unit), Heat (Environmental Monitoring)

-- Communication Unit Events
-- Stores emergency button presses and messages sent/received
CREATE TABLE IF NOT EXISTS Commu (
    time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    emerg BOOLEAN DEFAULT NULL,
    msg TEXT,
    PRIMARY KEY (time)
);

-- Environmental Monitoring Data
-- Stores temperature, humidity, and WBGT (Wet Bulb Globe Temperature) readings
CREATE TABLE IF NOT EXISTS Heat (
    time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    temp DECIMAL(10,2) NOT NULL,
    hum DECIMAL(10,2) NOT NULL,
    wbgt DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (time)
);

-- Indexes for common queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_commu_time ON Commu(time DESC);
CREATE INDEX IF NOT EXISTS idx_heat_time ON Heat(time DESC);
CREATE INDEX IF NOT EXISTS idx_commu_emerg ON Commu(emerg) WHERE emerg = TRUE;
