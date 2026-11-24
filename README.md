# Chat Backend with PostgreSQL & Firebase Firestore

A scalable, production-ready chat backend built with **Node.js**, **TypeScript (strict typing)**, a **Relational Database (PostgreSQL)** for user & chat metadata, and **Firebase Firestore** for real-time messages, ordering, read receipts, and last seen tracking.

---

## Tech Stack

- **Runtime**: Node.js (v18+)
- **Language**: TypeScript (strict mode enabled: `strict: true`, `noImplicitAny: true`, etc.)
- **Web Framework**: Express.js 5 with Zod request validation
- **Relational Database**: PostgreSQL (tables: `users`, `chats`, `chat_members`)
- **Document Store**: Firebase Firestore (`firebase-admin`) for high-throughput messages, read receipts, and last seen timestamps
- **Testing**: Jest + Supertest (23 unit & end-to-end integration tests)

---

## Architecture & Data Model

### 1. Relational Database (PostgreSQL )
Handles identity, relationship graphs, and chat memberships:

- **`users`**
  - `id` (VARCHAR PRIMARY KEY): Unique identifier
  - `name` (VARCHAR): User display name
  - `email` (VARCHAR UNIQUE): Email address
  - `created_at` (TIMESTAMP)

- **`chats`**
  - `id` (VARCHAR PRIMARY KEY): Unique chat ID (e.g., `chat_<uuid>` or `group_<uuid>`)
  - `type` (VARCHAR): `'direct'` (1:1) or `'group'`
  - `name` (VARCHAR, optional): Group name
  - `created_at` (TIMESTAMP)
  - `updated_at` (TIMESTAMP)

- **`chat_members`**
  - `chat_id` (VARCHAR REFERENCES `chats(id)` ON DELETE CASCADE)
  - `user_id` (VARCHAR REFERENCES `users(id)` ON DELETE CASCADE)
  - `role` (VARCHAR): `'member'` or `'admin'`
  - `joined_at` (TIMESTAMP)
  - PRIMARY KEY: (`chat_id`, `user_id`)

---

### 2. Firebase Firestore
Handles real-time chat data, ordering, and message status:

- **Messages Collection**: `chats/{chatId}/messages/{messageId}`
  - `id`: string (message ID)
  - `chatId`: string
  - `senderId`: string
  - `text`: string
  - `timestamp`: Firestore Timestamp / ISO String (used for ordering)
  - `readBy`: array of string (user IDs who have read this message)
  - `readReceipts`: map of `{ [userId]: readAtTimestamp }`
  - `isDeleted`: boolean (for message retraction)
  - `editedAt`: string (optional)

- **Last Seen Collection**: `chats/{chatId}/lastSeen/{userId}`
  - `userId`: string
  - `messageId`: string (ID of the last message seen by this user)
  - `updatedAt`: Firestore Timestamp / ISO String

---



## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

To run in zero-dependency local mode (using the built-in in-memory relational & Firestore client), keep:
```env
USE_MOCK_SERVICES=true
```

To connect to live PostgreSQL and Firebase:
```env
USE_MOCK_SERVICES=false
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chat_db
FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json
```

### 3. (Optional) Run Local PostgreSQL with Docker
```bash
docker compose up -d postgres
```

### 4. Run Migrations & Seed
```bash
npm run migrate
npm run seed
```

### 5. Build and Run Server
```bash
# Development (with auto-reload)
npm run dev

# Production Build
npm run build
npm start
```
The server will start on `http://localhost:3000`.

---

## 🧪 Testing

Run the automated test suite (23 comprehensive tests):
```bash
npm test
```

---

## 📡 API Specification

### 1. Create or Get 1:1 Chat
Idempotently finds an existing 1:1 chat between two users, or creates a new one in the relational database.

- **Route**: `POST /chat/create`
- **Request Body**:
  ```json
  {
    "userAId": "user_1",
    "userBId": "user_2"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "chatId": "chat_550e8400-e29b-41d4-a716-446655440000"
  }
  ```

---

### 2. Send Message
Stores message with a timestamp and initial read receipt in Firestore. Verifies the sender is an authorized member of the chat.

- **Route**: `POST /chat/:chatId/message/send`
- **Request Body**:
  ```json
  {
    "senderId": "user_1",
    "text": "Hello, how are you?"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "id": "msg_1732450000000_a1b2c3d4",
    "chatId": "chat_550e8400-e29b-41d4-a716-446655440000",
    "senderId": "user_1",
    "text": "Hello, how are you?",
    "timestamp": "2026-11-24T14:40:00.000Z",
    "readBy": ["user_1"],
    "readReceipts": {
      "user_1": "2026-11-24T14:40:00.000Z"
    },
    "isDeleted": false
  }
  ```

---

### 3. Get Messages
Fetches chat messages ordered chronologically by timestamp from Firestore.

- **Route**: `GET /chat/:chatId/messages?limit=50`
- **Query Params**:
  - `limit` *(optional, default: 50, max: 200)*
- **Response** (`200 OK`):
  ```json
  {
    "messages": [
      {
        "id": "msg_1732450000000_a1b2c3d4",
        "chatId": "chat_550e8400-e29b-41d4-a716-446655440000",
        "senderId": "user_1",
        "text": "Hello, how are you?",
        "timestamp": "2026-11-24T14:40:00.000Z",
        "readBy": ["user_1", "user_2"],
        "readReceipts": {
          "user_1": "2026-11-24T14:40:00.000Z",
          "user_2": "2026-11-24T14:41:00.000Z"
        },
        "isDeleted": false,
        "editedAt": null
      }
    ]
  }
  ```

---

### 4. Mark Message Read
Updates read receipt in Firestore by appending `userId` to `readBy` and recording the read timestamp.

- **Route**: `POST /chat/:chatId/message/:messageId/read`
- **Request Body**:
  ```json
  {
    "userId": "user_2"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "messageId": "msg_1732450000000_a1b2c3d4",
    "userId": "user_2",
    "readAt": "2026-11-24T14:41:00.000Z"
  }
  ```

---

### 5. Update Last Seen Message
Updates the latest message ID and timestamp seen by a user in Firestore (`chats/{chatId}/lastSeen/{userId}`).

- **Route**: `POST /chat/:chatId/lastseen`
- **Request Body**:
  ```json
  {
    "userId": "user_2",
    "messageId": "msg_1732450000000_a1b2c3d4"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "chatId": "chat_550e8400-e29b-41d4-a716-446655440000",
    "userId": "user_2",
    "messageId": "msg_1732450000000_a1b2c3d4",
    "updatedAt": "2026-11-24T14:41:05.000Z"
  }
  ```

---

### 6. List User Chats
Retrieves all direct and group chats for a user with all participant member IDs from the relational database.

- **Route**: `GET /user/:userId/chats`
- **Response** (`200 OK`):
  ```json
  {
    "chats": [
      {
        "chatId": "chat_550e8400-e29b-41d4-a716-446655440000",
        "type": "direct",
        "name": null,
        "createdAt": "2026-11-24T14:39:00.000Z",
        "memberIds": ["user_1", "user_2"]
      }
    ]
  }
  ```

---

### 7. Bonus Endpoints

#### Create Group Chat
- **Route**: `POST /chat/group/create`
- **Request Body**:
  ```json
  {
    "name": "Project Apollo",
    "memberIds": ["user_1", "user_2", "user_3"],
    "adminId": "user_1"
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "chatId": "group_8899aabb-ccdd-eeff-0011-223344556677"
  }
  ```

#### Edit Message
- **Route**: `PUT /chat/:chatId/message/:messageId`
- **Request Body**:
  ```json
  {
    "senderId": "user_1",
    "text": "Corrected message text"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "id": "msg_1732450000000_a1b2c3d4",
    "text": "Corrected message text",
    "editedAt": "2026-11-24T14:45:00.000Z"
  }
  ```

#### Delete Message
- **Route**: `DELETE /chat/:chatId/message/:messageId`
- **Request Body**:
  ```json
  {
    "senderId": "user_1"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true
  }
  ```
