package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"regexp"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	uuid "github.com/satori/go.uuid"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"` // Never expose password hash in JSON
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// ValidateEmail checks if email format is valid
func ValidateEmail(email string) bool {
	// Basic email regex
	re := regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	return re.MatchString(email)
}

// HashRefreshToken creates a SHA256 hash of the refresh token for database storage
func HashRefreshToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}

// Register handles user registration
func Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	// Validate email format
	if !ValidateEmail(req.Email) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid email format",
		})
		return
	}

	// Validate password strength
	if len(req.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Password must be at least 8 characters long",
		})
		return
	}

	db := c.MustGet("db").(*pgxpool.Pool)

	// Check if email already exists
	var exists bool
	err := db.QueryRow(context.Background(),
		"SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)",
		req.Email).Scan(&exists)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Database error",
		})
		return
	}
	if exists {
		c.JSON(http.StatusConflict, gin.H{
			"error": "Email already registered",
		})
		return
	}

	// Hash password
	passwordHash, err := HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to hash password",
		})
		return
	}

	// Insert user
	var user User
	err = db.QueryRow(context.Background(),
		`INSERT INTO users (email, password_hash, created_at, updated_at) 
		 VALUES ($1, $2, NOW(), NOW()) 
		 RETURNING id, email, created_at, updated_at`,
		req.Email, passwordHash).Scan(&user.ID, &user.Email, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to create user",
		})
		return
	}

	// Generate token pair
	accessToken, refreshToken, err := GenerateTokenPair(user.ID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate tokens",
		})
		return
	}

	// Store refresh token in database
	tokenHash := HashRefreshToken(refreshToken)
	expiresAt := time.Now().Add(7 * 24 * time.Hour) // 7 days
	_, err = db.Exec(context.Background(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
		 VALUES ($1, $2, $3)`,
		user.ID, tokenHash, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to store refresh token",
		})
		return
	}

	// Set cookies
	SetAuthCookies(c, accessToken, refreshToken)

	c.JSON(http.StatusCreated, gin.H{
		"user": user,
	})
}

// Login handles user login
func Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request: " + err.Error(),
		})
		return
	}

	db := c.MustGet("db").(*pgxpool.Pool)

	// Find user by email
	var user User
	err := db.QueryRow(context.Background(),
		`SELECT id, email, password_hash, created_at, updated_at 
		 FROM users WHERE email = $1`,
		req.Email).Scan(&user.ID, &user.Email, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid email or password",
		})
		return
	}

	// Verify password
	if !CheckPassword(req.Password, user.PasswordHash) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid email or password",
		})
		return
	}

	// Generate token pair
	accessToken, refreshToken, err := GenerateTokenPair(user.ID.String())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate tokens",
		})
		return
	}

	// Store refresh token in database
	tokenHash := HashRefreshToken(refreshToken)
	expiresAt := time.Now().Add(7 * 24 * time.Hour) // 7 days
	_, err = db.Exec(context.Background(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
		 VALUES ($1, $2, $3)`,
		user.ID, tokenHash, expiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to store refresh token",
		})
		return
	}

	// Set cookies
	SetAuthCookies(c, accessToken, refreshToken)

	c.JSON(http.StatusOK, gin.H{
		"user": user,
	})
}

// Refresh handles token refresh
func Refresh(c *gin.Context) {
	// Get refresh token from cookie
	refreshToken, err := c.Cookie("refresh_token")
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "No refresh token",
		})
		return
	}

	// Validate refresh token
	userID, err := ValidateRefreshToken(refreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Invalid refresh token",
		})
		return
	}

	db := c.MustGet("db").(*pgxpool.Pool)

	// Check if refresh token exists in database and is not revoked
	tokenHash := HashRefreshToken(refreshToken)
	var exists bool
	var revoked bool
	var expiresAt time.Time
	err = db.QueryRow(context.Background(),
		`SELECT EXISTS(SELECT 1 FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2), 
		 COALESCE((SELECT revoked FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 LIMIT 1), true),
		 COALESCE((SELECT expires_at FROM refresh_tokens WHERE token_hash = $1 AND user_id = $2 LIMIT 1), NOW())`,
		tokenHash, userID).Scan(&exists, &revoked, &expiresAt)
	if err != nil || !exists || revoked || time.Now().After(expiresAt) {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Refresh token revoked or expired",
		})
		return
	}

	// Revoke old refresh token
	_, err = db.Exec(context.Background(),
		`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
		tokenHash)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to revoke old token",
		})
		return
	}

	// Generate new token pair
	newAccessToken, newRefreshToken, err := GenerateTokenPair(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to generate new tokens",
		})
		return
	}

	// Store new refresh token
	newTokenHash := HashRefreshToken(newRefreshToken)
	newExpiresAt := time.Now().Add(7 * 24 * time.Hour)
	_, err = db.Exec(context.Background(),
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at) 
		 VALUES ($1, $2, $3)`,
		userID, newTokenHash, newExpiresAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to store new refresh token",
		})
		return
	}

	// Set new cookies
	SetAuthCookies(c, newAccessToken, newRefreshToken)

	c.JSON(http.StatusOK, gin.H{
		"message": "Tokens refreshed successfully",
	})
}

// Logout handles user logout
func Logout(c *gin.Context) {
	// Get refresh token from cookie
	refreshToken, err := c.Cookie("refresh_token")
	if err == nil && refreshToken != "" {
		// Revoke refresh token in database
		db := c.MustGet("db").(*pgxpool.Pool)
		tokenHash := HashRefreshToken(refreshToken)
		_, _ = db.Exec(context.Background(),
			`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`,
			tokenHash)
	}

	// Clear cookies
	ClearAuthCookies(c)

	c.JSON(http.StatusOK, gin.H{
		"message": "Logged out successfully",
	})
}

// Me returns the current user's information
func Me(c *gin.Context) {
	// Get user ID from context (set by AuthRequired middleware)
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error": "Unauthorized",
		})
		return
	}

	db := c.MustGet("db").(*pgxpool.Pool)

	// Fetch user from database
	var user User
	err := db.QueryRow(context.Background(),
		`SELECT id, email, created_at, updated_at FROM users WHERE id = $1`,
		userID).Scan(&user.ID, &user.Email, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "User not found",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": user,
	})
}

