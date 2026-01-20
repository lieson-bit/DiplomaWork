# Customer Service

A microservice for managing customer profiles, addresses, payment methods, and preferences in a delivery service application.

## 🚀 Features

- **Customer Profile Management**: Create, read, update customer information
- **Address Management**: Multiple addresses with default selection
- **Payment Methods**: Support for cards, PayPal, Apple Pay, Google Pay, bank transfers
- **Customer Preferences**: Notification settings, language, timezone
- **Delivery Time Slots**: Configure preferred delivery times
- **Feedback System**: Submit and track customer feedback
- **Profile Pictures**: Upload and manage customer profile photos
- **Order Statistics**: Track order history, spending, and loyalty points
- **Membership Levels**: Automatic tier upgrades based on spending

## 🏗️ Architecture

- **Framework**: Express.js with TypeScript
- **Database**: MySQL 8.0
- **Authentication**: JWT (validated with user-service)
- **File Storage**: Local file system for profile pictures
- **Containerization**: Docker & Docker Compose
- **Logging**: Winston with file and console output

## 📁 Project Structure
