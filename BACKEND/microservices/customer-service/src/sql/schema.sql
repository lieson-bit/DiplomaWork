-- Customer Service Database Schema

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL UNIQUE,
    account_type ENUM('personal', 'business') DEFAULT 'personal',
    date_of_birth DATE NULL,
    business_name VARCHAR(255) NULL,
    business_type VARCHAR(100) NULL,
    business_phone VARCHAR(20) NULL,
    tax_id VARCHAR(50) NULL,
    join_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_orders INT DEFAULT 0,
    total_spent DECIMAL(10, 2) DEFAULT 0.00,
    average_rating DECIMAL(3, 2) DEFAULT 0.00,
    loyalty_points INT DEFAULT 0,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    membership_level ENUM('standard', 'premium', 'business') DEFAULT 'standard',
    profile_picture_url VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_id (user_id),
    INDEX idx_account_type (account_type),
    INDEX idx_membership_level (membership_level),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer addresses table
CREATE TABLE IF NOT EXISTS customer_addresses (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customer_id VARCHAR(36) NOT NULL,
    label VARCHAR(50) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) DEFAULT 'US',
    postal_code VARCHAR(20) NOT NULL,
    latitude DECIMAL(10, 8) NULL,
    longitude DECIMAL(11, 8) NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id),
    INDEX idx_customer_default (customer_id, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer preferences table
CREATE TABLE IF NOT EXISTS customer_preferences (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customer_id VARCHAR(36) NOT NULL UNIQUE,
    default_pickup_type ENUM('home', 'business', 'other') DEFAULT 'home',
    default_payment_id VARCHAR(36) NULL,
    notification_email BOOLEAN DEFAULT TRUE,
    notification_sms BOOLEAN DEFAULT TRUE,
    notification_push BOOLEAN DEFAULT TRUE,
    share_location_data BOOLEAN DEFAULT FALSE,
    share_usage_analytics BOOLEAN DEFAULT FALSE,
    marketing_emails BOOLEAN DEFAULT FALSE,
    language VARCHAR(10) DEFAULT 'en',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer payment methods table
CREATE TABLE IF NOT EXISTS customer_payment_methods (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customer_id VARCHAR(36) NOT NULL,
    type ENUM('card', 'paypal', 'apple_pay', 'google_pay', 'bank_transfer') NOT NULL,
    provider VARCHAR(50) NOT NULL,
    last4 VARCHAR(4) NULL,
    expiry_month INT NULL,
    expiry_year INT NULL,
    name_on_card VARCHAR(100) NULL,
    paypal_email VARCHAR(255) NULL,
    bank_name VARCHAR(100) NULL,
    account_number_masked VARCHAR(20) NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    token VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id),
    INDEX idx_customer_default (customer_id, is_default)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Delivery time slots table
CREATE TABLE IF NOT EXISTS delivery_time_slots (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customer_id VARCHAR(36) NOT NULL,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_customer_day (customer_id, day_of_week),
    INDEX idx_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer feedback table
CREATE TABLE IF NOT EXISTS customer_feedback (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customer_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NULL,
    category ENUM('delivery', 'driver', 'packaging', 'app', 'other') DEFAULT 'other',
    status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
    response TEXT NULL,
    responded_by VARCHAR(100) NULL,
    responded_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id),
    INDEX idx_category (category),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer favorites table (optional)
CREATE TABLE IF NOT EXISTS customer_favorites (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customer_id VARCHAR(36) NOT NULL,
    favorite_type ENUM('driver', 'delivery_address', 'pickup_location') NOT NULL,
    reference_id VARCHAR(36) NOT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_customer_favorite (customer_id, favorite_type, reference_id),
    INDEX idx_customer_id (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;