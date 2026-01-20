-- sql/schema.sql
-- This only creates the driver-specific tables
-- Users are managed by user-service

-- Make sure we use the same database as user-service
-- Or create a separate driver database if preferred

-- Option 1: Use same database as user-service (shared)
-- USE your_user_service_database_name;

-- Option 2: Create separate database for drivers
CREATE DATABASE IF NOT EXISTS driver_service;
USE driver_service;

-- Drivers table - References user_id from user-service
CREATE TABLE IF NOT EXISTS drivers (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  user_id VARCHAR(255) NOT NULL COMMENT 'References users.id from user-service',
  license_number VARCHAR(50),
  license_expiry DATETIME,
  insurance_number VARCHAR(50),
  insurance_expiry DATETIME,
  rating FLOAT DEFAULT 0.0,
  total_deliveries INT DEFAULT 0,
  total_earnings DECIMAL(10, 2) DEFAULT 0,
  completion_rate FLOAT DEFAULT 0.0,
  status ENUM('pending', 'active', 'suspended', 'inactive') DEFAULT 'pending',
  verification_level ENUM('none', 'basic', 'verified', 'premium') DEFAULT 'none',
  onboarded_at DATETIME,
  is_online BOOLEAN DEFAULT FALSE,
  current_location VARCHAR(255),
  profile_completed BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_verification_level (verification_level),
  INDEX idx_is_online (is_online),
  UNIQUE KEY unique_user_id (user_id) -- One driver profile per user
);

-- Profile pictures table
CREATE TABLE IF NOT EXISTS profile_pictures (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  driver_id VARCHAR(255) NOT NULL,
  original_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500),
  small_url VARCHAR(500),
  medium_url VARCHAR(500),
  mime_type VARCHAR(50) NOT NULL,
  size INT NOT NULL,
  width INT,
  height INT,
  is_active BOOLEAN DEFAULT TRUE,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_driver_id (driver_id),
  UNIQUE KEY unique_driver_id (driver_id) -- One profile picture per driver
);

-- Vehicles table
CREATE TABLE IF NOT EXISTS vehicles (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  driver_id VARCHAR(255) NOT NULL,
  type ENUM('motorbike', 'small_van', 'medium_truck', 'large_truck') NOT NULL,
  make VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  color VARCHAR(30) NOT NULL,
  license_plate VARCHAR(20) UNIQUE NOT NULL,
  max_weight DECIMAL(10, 2) NOT NULL,
  max_volume DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  current_status ENUM('available', 'in_use', 'maintenance') DEFAULT 'available',
  insurance_info TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_driver_id (driver_id),
  INDEX idx_license_plate (license_plate),
  INDEX idx_type (type),
  INDEX idx_current_status (current_status)
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  driver_id VARCHAR(255) NOT NULL,
  type ENUM('license', 'insurance', 'registration', 'inspection', 'background_check') NOT NULL,
  name VARCHAR(100) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'expired') DEFAULT 'pending',
  upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiry_date DATETIME,
  rejection_reason TEXT,
  verified_by VARCHAR(255),
  verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_driver_id (driver_id),
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_expiry_date (expiry_date)
);

-- Driver availability table
CREATE TABLE IF NOT EXISTS driver_availabilities (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  driver_id VARCHAR(255) NOT NULL,
  day_of_week INT NOT NULL COMMENT '0=Sunday, 1=Monday, ..., 6=Saturday',
  start_time VARCHAR(5) NOT NULL COMMENT 'HH:MM format',
  end_time VARCHAR(5) NOT NULL COMMENT 'HH:MM format',
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_driver_day (driver_id, day_of_week),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_driver_id (driver_id),
  INDEX idx_day_of_week (day_of_week)
);

-- Driver metrics table
CREATE TABLE IF NOT EXISTS driver_metrics (
  id VARCHAR(255) PRIMARY KEY DEFAULT (UUID()),
  driver_id VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  deliveries_count INT DEFAULT 0,
  successful_deliveries INT DEFAULT 0,
  failed_deliveries INT DEFAULT 0,
  total_earnings DECIMAL(10, 2) DEFAULT 0,
  average_rating FLOAT DEFAULT 0.0,
  online_hours FLOAT DEFAULT 0.0,
  distance_traveled FLOAT DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
  INDEX idx_driver_date (driver_id, date),
  UNIQUE KEY unique_driver_date (driver_id, date) -- One record per driver per day
);