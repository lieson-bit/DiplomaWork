-- Order Service Database Schema
-- MySQL compatible (no Prisma)

-- Orders table - Core order information
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_number VARCHAR(20) UNIQUE NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    driver_id VARCHAR(36),
    
    -- Pickup Information
    pickup_address TEXT NOT NULL,
    pickup_latitude DECIMAL(10, 8),
    pickup_longitude DECIMAL(11, 8),
    pickup_contact_name VARCHAR(100),
    pickup_contact_phone VARCHAR(20),
    pickup_instructions TEXT,
    
    -- Delivery Information  
    delivery_address TEXT NOT NULL,
    delivery_latitude DECIMAL(10, 8),
    delivery_longitude DECIMAL(11, 8),
    delivery_contact_name VARCHAR(100),
    delivery_contact_phone VARCHAR(20),
    delivery_instructions TEXT,
    
    -- Package Information
    total_weight_kg DECIMAL(8,2),
    total_volume_m3 DECIMAL(8,2),
    package_description TEXT,
    fragile_items BOOLEAN DEFAULT FALSE,
    temperature_controlled BOOLEAN DEFAULT FALSE,
    
    -- Pricing & Payment
    base_price DECIMAL(10,2) NOT NULL,
    distance_fee DECIMAL(10,2) DEFAULT 0.00,
    weight_fee DECIMAL(10,2) DEFAULT 0.00,
    volume_fee DECIMAL(10,2) DEFAULT 0.00,
    rush_fee DECIMAL(10,2) DEFAULT 0.00,
    fuel_surcharge DECIMAL(10,2) DEFAULT 0.00,
    tip_amount DECIMAL(10,2) DEFAULT 0.00,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    
    -- Platform Fees
    platform_fee DECIMAL(10,2) DEFAULT 0.00,
    platform_fee_percent DECIMAL(5,2) DEFAULT 15.00,
    
    -- Final Prices
    subtotal_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    driver_earnings DECIMAL(10,2) DEFAULT 0.00,
    
    -- Payment Status
    payment_status ENUM('pending', 'authorized', 'completed', 'refunded', 'failed') DEFAULT 'pending',
    payment_method VARCHAR(50),
    payment_transaction_id VARCHAR(100),
    payment_processed_at TIMESTAMP NULL,
    
    -- Route Information
    estimated_distance_km DECIMAL(8,2),
    estimated_duration_minutes INT,
    actual_distance_km DECIMAL(8,2),
    actual_duration_minutes INT,
    route_polyline TEXT,
    
    -- Status & Timing
    status ENUM('pending', 'matched', 'driver_accepted', 'driver_enroute', 
                'pickup_started', 'in_transit', 'arrived', 'delivered', 
                'completed', 'cancelled', 'failed') DEFAULT 'pending',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scheduled_pickup_at TIMESTAMP NULL,
    matched_at TIMESTAMP NULL,
    accepted_at TIMESTAMP NULL,
    pickup_started_at TIMESTAMP NULL,
    in_transit_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    cancelled_at TIMESTAMP NULL,
    
    -- Driver Location Tracking
    driver_current_lat DECIMAL(10, 8),
    driver_current_lng DECIMAL(11, 8),
    driver_last_updated TIMESTAMP NULL,
    
    -- Customer & Driver Balance Updates
    customer_balance_updated BOOLEAN DEFAULT FALSE,
    driver_balance_updated BOOLEAN DEFAULT FALSE,
    balance_update_attempts INT DEFAULT 0,
    
    -- Additional metadata
    is_bulk_order BOOLEAN DEFAULT FALSE,
    bulk_order_id VARCHAR(36),
    
    -- Internal notes
    internal_notes TEXT,
    customer_notes TEXT,
    driver_notes TEXT,
    
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order Items Table (for detailed package breakdown)
CREATE TABLE IF NOT EXISTS order_items (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_description TEXT,
    quantity INT NOT NULL DEFAULT 1,
    weight_per_item_kg DECIMAL(8,2),
    dimensions_length_cm DECIMAL(6,2),
    dimensions_width_cm DECIMAL(6,2),
    dimensions_height_cm DECIMAL(6,2),
    value_per_item DECIMAL(10,2),
    fragile BOOLEAN DEFAULT FALSE,
    liquid BOOLEAN DEFAULT FALSE,
    temperature_sensitive BOOLEAN DEFAULT FALSE,
    special_handling TEXT,
    barcode VARCHAR(100),
    sku VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_items_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order Status History
CREATE TABLE IF NOT EXISTS order_status_history (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    previous_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    changed_by VARCHAR(36),
    change_reason VARCHAR(255),
    notes TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_status_history_order (order_id),
    INDEX idx_status_history_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order Payment History
CREATE TABLE IF NOT EXISTS order_payments (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    transaction_id VARCHAR(100),
    amount DECIMAL(10,2) NOT NULL,
    fee_amount DECIMAL(10,2) DEFAULT 0.00,
    net_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    status ENUM('pending', 'completed', 'refunded', 'failed') DEFAULT 'pending',
    customer_balance_before DECIMAL(10,2),
    customer_balance_after DECIMAL(10,2),
    driver_balance_before DECIMAL(10,2),
    driver_balance_after DECIMAL(10,2),
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_payments_order (order_id),
    INDEX idx_order_payments_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Real-time Location Tracking (for simulation)
CREATE TABLE IF NOT EXISTS location_tracking (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    driver_id VARCHAR(36) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5,2),
    bearing DECIMAL(5,2),
    accuracy DECIMAL(5,2),
    battery_level INT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_tracking_order (order_id),
    INDEX idx_tracking_driver (driver_id),
    INDEX idx_tracking_time (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bulk Orders Management
CREATE TABLE IF NOT EXISTS bulk_orders (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    customer_id VARCHAR(36) NOT NULL,
    bulk_order_name VARCHAR(255) NOT NULL,
    total_orders INT NOT NULL,
    completed_orders INT DEFAULT 0,
    failed_orders INT DEFAULT 0,
    cancelled_orders INT DEFAULT 0,
    total_estimated_cost DECIMAL(12,2),
    total_actual_cost DECIMAL(12,2) DEFAULT 0.00,
    upload_file_url TEXT,
    processing_status VARCHAR(20) DEFAULT 'pending',
    processing_error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_bulk_orders_customer (customer_id),
    INDEX idx_bulk_orders_status (processing_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order Assignment Queue (for driver matching)
CREATE TABLE IF NOT EXISTS order_assignment_queue (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    priority_score INT DEFAULT 100,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_at TIMESTAMP NULL,
    attempts_count INT DEFAULT 0,
    last_attempt_at TIMESTAMP NULL,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_assignment_queue_order (order_id),
    INDEX idx_assignment_queue_priority (priority_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order Cancellation Reasons
CREATE TABLE IF NOT EXISTS order_cancellations (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    cancelled_by VARCHAR(20) NOT NULL,
    cancellation_reason VARCHAR(100) NOT NULL,
    detailed_reason TEXT,
    refund_amount DECIMAL(10,2) DEFAULT 0.00,
    refund_processed BOOLEAN DEFAULT FALSE,
    cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_cancellations_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User balances (if moving from customer/driver services)
CREATE TABLE user_balances (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL UNIQUE,
    balance DECIMAL(10,2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_user_balances_user (user_id)
);

-- Notification preferences
CREATE TABLE notification_preferences (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    email_notifications BOOLEAN DEFAULT TRUE,
    push_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_notification_prefs_user (user_id)
);

-- Payment transactions (if handling payments internally)
CREATE TABLE payment_transactions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    driver_id VARCHAR(36),
    amount DECIMAL(10,2) NOT NULL,
    fee DECIMAL(10,2) DEFAULT 0.00,
    net_amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    transaction_data JSON,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_payment_transactions_order (order_id),
    INDEX idx_payment_transactions_customer (customer_id),
    INDEX idx_payment_transactions_driver (driver_id)
);

-- Order Messages Table
CREATE TABLE IF NOT EXISTS order_messages (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    sender_id VARCHAR(36) NOT NULL,
    sender_type ENUM('customer', 'driver') NOT NULL,
    receiver_id VARCHAR(36) NOT NULL,
    content TEXT NOT NULL,
    message_type ENUM('text', 'location', 'image', 'status_update') DEFAULT 'text',
    metadata JSON,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_order_messages_order (order_id),
    INDEX idx_order_messages_sender (sender_id),
    INDEX idx_order_messages_receiver (receiver_id),
    INDEX idx_order_messages_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Notifications Table
CREATE TABLE IF NOT EXISTS user_notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSON,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_user_notifications_user (user_id),
    INDEX idx_user_notifications_read (read),
    INDEX idx_user_notifications_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create necessary indexes for performance
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_driver ON orders(driver_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_pickup_date ON orders(scheduled_pickup_at);
CREATE INDEX idx_orders_delivery_date ON orders(delivered_at);

-- Create stored procedure for generating order numbers
DELIMITER //
CREATE PROCEDURE generate_order_number(OUT order_number VARCHAR(20))
BEGIN
    DECLARE date_part VARCHAR(8);
    DECLARE seq_num INT;
    
    SET date_part = DATE_FORMAT(NOW(), '%Y%m%d');
    
    -- Get sequence number for today
    SELECT COALESCE(MAX(SUBSTRING(order_number, 10)), 0) + 1 
    INTO seq_num 
    FROM orders 
    WHERE order_number LIKE CONCAT('ORD-', date_part, '-%');
    
    -- Format: ORD-YYYYMMDD-0001
    SET order_number = CONCAT('ORD-', date_part, '-', LPAD(seq_num, 4, '0'));
END //
DELIMITER ;

-- Create trigger to auto-generate order number
DELIMITER //
CREATE TRIGGER before_order_insert
BEFORE INSERT ON orders
FOR EACH ROW
BEGIN
    IF NEW.order_number IS NULL THEN
        CALL generate_order_number(NEW.order_number);
    END IF;
END //
DELIMITER ;

-- Create view for active orders
CREATE VIEW active_orders AS
SELECT 
    o.*,
    COUNT(oi.id) as item_count,
    SUM(oi.weight_per_item_kg * oi.quantity) as calculated_weight,
    COUNT(DISTINCT l.id) as tracking_points
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN location_tracking l ON o.id = l.order_id
WHERE o.status IN ('pending', 'matched', 'driver_accepted', 'driver_enroute', 'pickup_started', 'in_transit')
GROUP BY o.id;

-- Create view for driver earnings
CREATE VIEW driver_earnings_summary AS
SELECT 
    driver_id,
    COUNT(*) as total_orders,
    SUM(total_price) as total_revenue,
    SUM(driver_earnings) as total_earnings,
    SUM(platform_fee) as total_platform_fee,
    AVG(driver_earnings) as avg_earnings_per_order,
    MIN(created_at) as first_order_date,
    MAX(created_at) as last_order_date
FROM orders 
WHERE status = 'completed' 
    AND driver_id IS NOT NULL
    AND payment_status = 'completed'
GROUP BY driver_id;

-- Insert sample data for testing
INSERT INTO orders (
    id, order_number, customer_id, 
    pickup_address, delivery_address,
    total_weight_kg, total_volume_m3,
    base_price, total_price, status
) VALUES 
(
    UUID(), 'ORD-20240101-0001', 'cust-001',
    '123 Main St, New York, NY', '456 Park Ave, Brooklyn, NY',
    5.5, 0.2,
    10.00, 25.50, 'pending'
),
(
    UUID(), 'ORD-20240101-0002', 'cust-002',
    '789 Broadway, Manhattan, NY', '101 First Ave, Queens, NY',
    12.0, 0.8,
    15.00, 38.75, 'in_transit'
);

-- Insert sample order items
INSERT INTO order_items (
    id, order_id, item_name, quantity, weight_per_item_kg,
    dimensions_length_cm, dimensions_width_cm, dimensions_height_cm
) 
SELECT 
    UUID(),
    (SELECT id FROM orders WHERE order_number = 'ORD-20240101-0001'),
    'Electronics Package',
    1,
    3.5,
    40.0, 30.0, 20.0
UNION ALL
SELECT 
    UUID(),
    (SELECT id FROM orders WHERE order_number = 'ORD-20240101-0001'),
    'Clothing Bundle',
    2,
    1.0,
    30.0, 25.0, 10.0;

-- Show table creation results
SELECT 
    TABLE_NAME,
    TABLE_ROWS,
    DATA_LENGTH,
    INDEX_LENGTH,
    CREATE_TIME
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = DATABASE() 
ORDER BY CREATE_TIME DESC;