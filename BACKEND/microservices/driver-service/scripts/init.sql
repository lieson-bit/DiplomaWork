-- Create database if not exists
CREATE DATABASE IF NOT EXISTS driver_service;
USE driver_service;

-- Create user for application
CREATE USER IF NOT EXISTS 'driver_user'@'%' IDENTIFIED BY 'driver_pass';
GRANT ALL PRIVILEGES ON driver_service.* TO 'driver_user'@'%';
FLUSH PRIVILEGES;