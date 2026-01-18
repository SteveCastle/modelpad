# SuperTokens to JWT Authentication Migration Guide

This document outlines the steps to migrate existing users from SuperTokens to the new JWT-based authentication system.

## Overview

The new authentication system uses:
- **JWT tokens** stored in HTTP-only cookies
- **bcrypt** for password hashing
- **PostgreSQL** for user and token storage

Since SuperTokens uses its own password hashing algorithm, **users will need to reset their passwords** after migration. There is no way to directly migrate password hashes between systems.

## Pre-Migration Checklist

- [ ] Backup your SuperTokens database
- [ ] Backup your application database
- [ ] Ensure the new `users` and `refresh_tokens` tables are created
- [ ] Test the new auth system with a few test accounts
- [ ] Prepare user communication about password reset requirement

## Step 1: Export Users from SuperTokens

### Option A: Using SuperTokens Dashboard API

If you have access to the SuperTokens Core API:

```bash
# Get all users (paginated)
curl -X GET "YOUR_SUPERTOKENS_CORE_URL/recipe/users?limit=100" \
  -H "api-key: YOUR_API_KEY"
```

### Option B: Direct Database Export

If you have direct access to the SuperTokens PostgreSQL database:

```sql
-- Export users from SuperTokens emailpassword table
SELECT 
    user_id,
    email,
    time_joined
FROM emailpassword_users
ORDER BY time_joined;
```

Save the output to a CSV or JSON file for the next step.

## Step 2: Create Migration Script

Create a SQL script to insert SuperTokens users into the new `users` table:

```sql
-- migration_users.sql
-- This script imports users from SuperTokens
-- NOTE: Password hash is set to empty - users MUST reset their passwords

BEGIN;

-- Insert users with a placeholder password hash
-- The placeholder ensures they cannot login until they reset
INSERT INTO users (id, email, password_hash, created_at, updated_at)
VALUES
    -- Replace with your exported users
    -- Format: (uuid, 'email', 'NEEDS_RESET', timestamp, timestamp)
    ('supertokens-user-id-1', 'user1@example.com', 'NEEDS_PASSWORD_RESET', '2024-01-15 10:00:00', NOW()),
    ('supertokens-user-id-2', 'user2@example.com', 'NEEDS_PASSWORD_RESET', '2024-01-16 11:00:00', NOW())
ON CONFLICT (email) DO NOTHING;

COMMIT;
```

### Automated Script (Go)

For larger migrations, create a Go script:

```go
// migrate_users.go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "os"

    "github.com/jackc/pgx/v5/pgxpool"
)

type SuperTokensUser struct {
    UserID     string `json:"user_id"`
    Email      string `json:"email"`
    TimeJoined int64  `json:"time_joined"`
}

func main() {
    // Read exported users from JSON file
    data, err := os.ReadFile("supertokens_users.json")
    if err != nil {
        panic(err)
    }

    var users []SuperTokensUser
    json.Unmarshal(data, &users)

    // Connect to database
    db, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
    if err != nil {
        panic(err)
    }
    defer db.Close()

    // Insert users
    for _, user := range users {
        _, err := db.Exec(context.Background(),
            `INSERT INTO users (id, email, password_hash, created_at, updated_at)
             VALUES ($1, $2, 'NEEDS_PASSWORD_RESET', to_timestamp($3/1000), NOW())
             ON CONFLICT (email) DO NOTHING`,
            user.UserID, user.Email, user.TimeJoined)
        
        if err != nil {
            fmt.Printf("Error migrating user %s: %v\n", user.Email, err)
        } else {
            fmt.Printf("Migrated user: %s\n", user.Email)
        }
    }

    fmt.Println("Migration complete!")
}
```

## Step 3: Update Note Ownership

If your notes reference SuperTokens user IDs, they should continue to work since we're preserving the original user IDs. However, verify the data:

```sql
-- Check that all notes have valid user references
SELECT n.id, n.title, n.user_id, u.email
FROM notes n
LEFT JOIN users u ON n.user_id = u.id
WHERE u.id IS NULL;

-- If any notes are orphaned, you'll need to handle them
```

## Step 4: Implement Password Reset Flow

Since migrated users have `NEEDS_PASSWORD_RESET` as their password hash, they cannot login normally. You have two options:

### Option A: Add Password Reset Endpoint (Recommended)

Add a password reset flow to your application:

1. User requests password reset via email
2. Generate a secure reset token
3. Send email with reset link
4. User sets new password

### Option B: Force Password Reset on First Login

Modify the login handler to detect migrated users:

```go
// In auth/handlers.go Login function, after finding user:
if user.PasswordHash == "NEEDS_PASSWORD_RESET" {
    c.JSON(http.StatusForbidden, gin.H{
        "error": "Password reset required",
        "code": "PASSWORD_RESET_REQUIRED",
    })
    return
}
```

Then handle this in the frontend to redirect to a password reset page.

## Step 5: Communicate with Users

Send an email to all users before the migration:

```
Subject: Important: Password Reset Required

Dear [User],

We've upgraded our authentication system for improved security. 

As part of this upgrade, you will need to reset your password the next 
time you log in.

Please visit [YOUR_APP_URL]/auth and click "Forgot Password" to set 
a new password.

Your notes and data are safe and unchanged.

Thank you for your understanding.

Best regards,
The ModelPad Team
```

## Step 6: Deploy and Switch

1. **Deploy new backend** with JWT authentication
2. **Deploy new frontend** with custom auth UI
3. **Run migration script** to import users
4. **Monitor** for any authentication issues
5. **Disable SuperTokens** services once migration is confirmed

## Step 7: Cleanup

After successful migration:

```sql
-- Remove any test users created during development
DELETE FROM users WHERE email LIKE '%@test.com';

-- Clean up old refresh tokens periodically
DELETE FROM refresh_tokens 
WHERE revoked = true 
   OR expires_at < NOW() - INTERVAL '30 days';
```

## Rollback Plan

If issues occur:

1. Keep SuperTokens running in parallel during initial migration
2. Have a feature flag to switch between auth systems
3. Maintain backups of both databases

```sql
-- To rollback, simply revert the code and your original
-- SuperTokens data remains untouched
```

## Verification Checklist

After migration, verify:

- [ ] New user registration works
- [ ] Existing users can reset passwords
- [ ] Password reset users can login after reset
- [ ] Protected API endpoints require authentication
- [ ] Tokens refresh correctly
- [ ] Logout properly clears cookies
- [ ] Notes are still accessible to their owners

## Timeline Suggestion

| Day | Action |
|-----|--------|
| D-7 | Send advance notice to users about upcoming changes |
| D-3 | Final testing in staging environment |
| D-1 | Send reminder email to users |
| D-0 | Deploy new auth system, run migration |
| D+1 | Monitor for issues, respond to user questions |
| D+7 | Disable SuperTokens services |
| D+30 | Clean up old SuperTokens infrastructure |

## Support

For users having trouble:

1. Direct them to the password reset flow
2. Verify their email exists in the `users` table
3. Check for any error logs in the application
4. Manually reset their password if needed:

```sql
-- Generate a bcrypt hash for a temporary password
-- Then update the user (they should change it immediately)
UPDATE users 
SET password_hash = '$2a$12$...' -- bcrypt hash
WHERE email = 'user@example.com';
```

---

**Note**: Always test the migration process in a staging environment before running it in production.

