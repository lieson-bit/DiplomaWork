-- Enhanced Order Service Database Schema for your requirements

-- Orders table - Updated to match your order structure
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    driver_id VARCHAR(36),
    
    -- Status tracking
    status ENUM('pending', 'driver_assigned', 'route_to_pickup', 'in_transit', 'delivered', 'cancelled', 'completed') DEFAULT 'pending',
    
    -- Customer Info
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    
    -- Locations
    pickup_address TEXT NOT NULL,
    pickup_lat DECIMAL(10, 8),
    pickup_lng DECIMAL(11, 8),
    
    delivery_address TEXT NOT NULL,
    delivery_lat DECIMAL(10, 8),
    delivery_lng DECIMAL(11, 8),
    
    distance_km DECIMAL(8, 2),
    
    -- Package Details
    package_category VARCHAR(100),
    weight_kg DECIMAL(8, 2),
    volume_m3 DECIMAL(8, 2),
    urgency VARCHAR(20) DEFAULT 'normal',
    
    -- Special Requirements
    fragile BOOLEAN DEFAULT FALSE,
    refrigerated BOOLEAN DEFAULT FALSE,
    oversized BOOLEAN DEFAULT FALSE,
    hazardous BOOLEAN DEFAULT FALSE,
    
    -- Driver Info
    driver_name VARCHAR(255),
    driver_phone VARCHAR(20),
    driver_email VARCHAR(255),
    driver_rating DECIMAL(3, 2),
    driver_match_score INT,
    
    -- Vehicle Info
    vehicle_type VARCHAR(50),
    vehicle_make VARCHAR(50),
    vehicle_model VARCHAR(50),
    vehicle_license_plate VARCHAR(20),
    vehicle_image_url TEXT,
    vehicle_max_weight DECIMAL(8, 2),
    vehicle_max_volume DECIMAL(8, 2),
    
    -- Pricing
    estimated_price_usd DECIMAL(10, 2),
    estimated_price_local DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    base_currency VARCHAR(3) DEFAULT 'RUB',
    
    -- Timing
    estimated_duration_minutes INT,
    pickup_time_estimated TIMESTAMP NULL,
    delivery_time_estimated TIMESTAMP NULL,
    
    -- Route Optimization
    route_polyline TEXT,
    route_order_index INT DEFAULT 0, -- For multi-order optimization
    
    -- Payment
    amount_paid DECIMAL(10, 2) DEFAULT 0.00,
    payment_status ENUM('pending', 'processing', 'completed', 'refunded') DEFAULT 'pending',
    
    -- Driver acceptance
    driver_accepted BOOLEAN DEFAULT FALSE,
    driver_accepted_at TIMESTAMP NULL,
    
    -- Delivery tracking
    delivery_started_at TIMESTAMP NULL,
    delivery_completed_at TIMESTAMP NULL,
    
    -- Rating
    customer_rating INT, -- 1-5
    customer_review TEXT,
    rating_given_at TIMESTAMP NULL,
    
    -- Communication
    unread_customer_messages INT DEFAULT 0,
    unread_driver_messages INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_orders_customer (customer_id),
    INDEX idx_orders_driver (driver_id),
    INDEX idx_orders_status (status),
    INDEX idx_orders_created (created_at),
    INDEX idx_orders_route_index (route_order_index)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order Status History
CREATE TABLE IF NOT EXISTS order_status_history (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL,
    previous_status VARCHAR(50),
    changed_by VARCHAR(36),
    changed_by_type ENUM('customer', 'driver', 'system'),
    notes TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_status_history_order (order_id),
    INDEX idx_status_history_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order Messages for Communication
CREATE TABLE IF NOT EXISTS order_messages (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    sender_id VARCHAR(36) NOT NULL,
    sender_type ENUM('customer', 'driver') NOT NULL,
    message_type ENUM('text', 'location', 'image', 'status_update') DEFAULT 'text',
    content TEXT NOT NULL,
    read_status BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    metadata JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_messages_order (order_id),
    INDEX idx_messages_sender (sender_id),
    INDEX idx_messages_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Driver Route Optimization
CREATE TABLE IF NOT EXISTS driver_routes (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    driver_id VARCHAR(36) NOT NULL,
    route_date DATE NOT NULL,
    polyline TEXT,
    total_distance_km DECIMAL(8, 2),
    total_duration_minutes INT,
    estimated_fuel_cost DECIMAL(8, 2),
    optimization_score DECIMAL(5, 2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_driver_routes_driver (driver_id),
    INDEX idx_driver_routes_date (route_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Route Waypoints (for multi-order optimization)
CREATE TABLE IF NOT EXISTS route_waypoints (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    route_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    waypoint_type ENUM('pickup', 'delivery') NOT NULL,
    sequence_number INT NOT NULL,
    address TEXT NOT NULL,
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    estimated_arrival TIMESTAMP NULL,
    actual_arrival TIMESTAMP NULL,
    
    FOREIGN KEY (route_id) REFERENCES driver_routes(id) ON DELETE CASCADE,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_waypoints_route (route_id),
    INDEX idx_waypoints_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User Balances (for customer and driver)
CREATE TABLE IF NOT EXISTS user_balances (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL UNIQUE,
    user_type ENUM('customer', 'driver') NOT NULL,
    available_balance DECIMAL(12, 2) DEFAULT 0.00,
    pending_balance DECIMAL(12, 2) DEFAULT 0.00,
    total_earned DECIMAL(12, 2) DEFAULT 0.00,
    total_spent DECIMAL(12, 2) DEFAULT 0.00,
    currency VARCHAR(3) DEFAULT 'USD',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    INDEX idx_balances_user (user_id),
    INDEX idx_balances_user_type (user_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Balance Transactions
CREATE TABLE IF NOT EXISTS balance_transactions (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    transaction_type ENUM('payment', 'refund', 'payout', 'adjustment') NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    previous_balance DECIMAL(12, 2),
    new_balance DECIMAL(12, 2),
    description TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_transactions_user (user_id),
    INDEX idx_transactions_order (order_id),
    INDEX idx_transactions_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Real-time Location Tracking
CREATE TABLE IF NOT EXISTS location_tracking (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    order_id VARCHAR(36) NOT NULL,
    driver_id VARCHAR(36) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2),
    bearing DECIMAL(5, 2),
    accuracy DECIMAL(5, 2),
    battery_level INT,
    
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    INDEX idx_tracking_order (order_id),
    INDEX idx_tracking_driver (driver_id),
    INDEX idx_tracking_time (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Driver Orders Queue (for optimization)
CREATE TABLE IF NOT EXISTS driver_order_queue (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    driver_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    priority_score INT DEFAULT 100,
    sequence_index INT DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    UNIQUE KEY unique_driver_order (driver_id, order_id),
    INDEX idx_queue_driver (driver_id),
    INDEX idx_queue_priority (priority_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Driver Ratings
CREATE TABLE IF NOT EXISTS driver_ratings (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    driver_id VARCHAR(36) NOT NULL,
    order_id VARCHAR(36) NOT NULL,
    customer_id VARCHAR(36) NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (driver_id) REFERENCES orders(driver_id) ON DELETE CASCADE,
    INDEX idx_ratings_driver (driver_id),
    INDEX idx_ratings_order (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id VARCHAR(36) NOT NULL,
    user_type ENUM('customer', 'driver') NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    order_id VARCHAR(36),
    read_status BOOLEAN DEFAULT FALSE,
    data JSON,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_notifications_user (user_id),
    INDEX idx_notifications_order (order_id),
    INDEX idx_notifications_read (read_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create view for order progress
CREATE VIEW order_progress_view AS
SELECT 
    o.id,
    o.order_number,
    o.status,
    o.created_at,
    o.driver_accepted_at,
    o.delivery_started_at,
    o.delivery_completed_at,
    
    -- Calculate progress percentage
    CASE 
        WHEN o.status = 'pending' THEN 0
        WHEN o.status = 'driver_assigned' THEN 25
        WHEN o.status = 'route_to_pickup' THEN 50
        WHEN o.status = 'in_transit' THEN 75
        WHEN o.status IN ('delivered', 'completed') THEN 100
        ELSE 0
    END as progress_percentage,
    
    -- Timeline events
    o.created_at as order_placed,
    o.driver_accepted_at as driver_assigned,
    o.delivery_started_at as pickup_started,
    o.delivery_completed_at as delivered
    
FROM orders o;

-- Create view for driver earnings summary
CREATE VIEW driver_earnings_view AS
SELECT 
    d.driver_id,
    COUNT(*) as total_orders,
    SUM(o.estimated_price_usd) as total_revenue,
    SUM(o.estimated_price_usd) as total_earnings, -- Assuming driver gets full amount
    AVG(dr.rating) as average_rating,
    MIN(o.created_at) as first_order,
    MAX(o.created_at) as last_order
FROM orders o
LEFT JOIN driver_ratings dr ON o.driver_id = dr.driver_id AND o.id = dr.order_id
WHERE o.status = 'completed'
GROUP BY d.driver_id;

-- Create view for customer spending
CREATE VIEW customer_spending_view AS
SELECT 
    o.customer_id,
    COUNT(*) as total_orders,
    SUM(o.estimated_price_usd) as total_spent,
    AVG(o.estimated_price_usd) as average_order_value,
    MIN(o.created_at) as first_order,
    MAX(o.created_at) as last_order
FROM orders o
WHERE o.status = 'completed'
GROUP BY o.customer_id;

-- Insert sample data
INSERT INTO user_balances (user_id, user_type, available_balance) VALUES 
('1d25b961-0870-4f92-991d-6f966f595658', 'customer', 1000.00),
('1358764d-1e0b-44bd-a735-ca0fc71732f1', 'driver', 500.00);

-- Trigger to update driver rating when new rating is added
DELIMITER //
CREATE TRIGGER update_driver_rating_after_insert
AFTER INSERT ON driver_ratings
FOR EACH ROW
BEGIN
    DECLARE avg_rating DECIMAL(3,2);
    
    -- Calculate new average rating
    SELECT AVG(rating) INTO avg_rating 
    FROM driver_ratings 
    WHERE driver_id = NEW.driver_id;
    
    -- Update driver's rating in orders table
    UPDATE orders 
    SET driver_rating = avg_rating 
    WHERE driver_id = NEW.driver_id;
END //
DELIMITER ;

-- Trigger to create status history when order status changes
DELIMITER //
CREATE TRIGGER order_status_change_trigger
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO order_status_history (order_id, status, previous_status, changed_by_type)
        VALUES (NEW.id, NEW.status, OLD.status, 'system');
    END IF;
END //
DELIMITER ;

-- Function to calculate route optimization score
DELIMITER //
CREATE FUNCTION calculate_optimization_score(
    total_distance DECIMAL(8,2),
    total_orders INT,
    total_weight DECIMAL(8,2),
    vehicle_capacity DECIMAL(8,2)
) RETURNS DECIMAL(5,2)
DETERMINISTIC
BEGIN
    DECLARE distance_score DECIMAL(5,2);
    DECLARE capacity_score DECIMAL(5,2);
    DECLARE final_score DECIMAL(5,2);
    
    -- Distance score (lower distance is better)
    SET distance_score = GREATEST(0, 100 - (total_distance * 2));
    
    -- Capacity utilization score
    SET capacity_score = (total_weight / vehicle_capacity) * 100;
    
    -- Final score weighted average
    SET final_score = (distance_score * 0.6) + (capacity_score * 0.4);
    
    RETURN LEAST(100, GREATEST(0, final_score));
END //
DELIMITER ;