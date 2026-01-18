package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

// JWT Claims structure
type Claims struct {
	UserID string `json:"user_id"`
	jwt.RegisteredClaims
}

// GetJWTSecret retrieves the JWT secret from environment
func GetJWTSecret() string {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		// Fallback for development - in production, this should always be set
		secret = "default-secret-key-change-in-production-min-32-chars"
	}
	return secret
}

// GenerateTokenPair creates access and refresh tokens for a user
func GenerateTokenPair(userID string) (accessToken string, refreshToken string, err error) {
	secret := []byte(GetJWTSecret())

	// Generate access token (15 minutes)
	accessExpiry := os.Getenv("JWT_ACCESS_EXPIRY")
	if accessExpiry == "" {
		accessExpiry = "15m"
	}
	accessDuration, err := time.ParseDuration(accessExpiry)
	if err != nil {
		accessDuration = 15 * time.Minute
	}

	accessClaims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(accessDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	accessTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err = accessTokenObj.SignedString(secret)
	if err != nil {
		return "", "", fmt.Errorf("failed to sign access token: %w", err)
	}

	// Generate refresh token (7 days)
	refreshExpiry := os.Getenv("JWT_REFRESH_EXPIRY")
	if refreshExpiry == "" {
		refreshExpiry = "168h" // 7 days
	}
	refreshDuration, err := time.ParseDuration(refreshExpiry)
	if err != nil {
		refreshDuration = 168 * time.Hour
	}

	refreshClaims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(refreshDuration)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
		},
	}

	refreshTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err = refreshTokenObj.SignedString(secret)
	if err != nil {
		return "", "", fmt.Errorf("failed to sign refresh token: %w", err)
	}

	return accessToken, refreshToken, nil
}

// ValidateAccessToken validates an access token and returns the claims
func ValidateAccessToken(tokenString string) (*Claims, error) {
	secret := []byte(GetJWTSecret())

	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return secret, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	return claims, nil
}

// ValidateRefreshToken validates a refresh token and returns the user ID
func ValidateRefreshToken(tokenString string) (string, error) {
	claims, err := ValidateAccessToken(tokenString) // Same validation logic
	if err != nil {
		return "", err
	}
	return claims.UserID, nil
}

// HashPassword hashes a password using bcrypt
func HashPassword(password string) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("failed to hash password: %w", err)
	}
	return string(hashedBytes), nil
}

// CheckPassword compares a password with its hash
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}

// GenerateRandomToken generates a secure random token for refresh tokens
func GenerateRandomToken() (string, error) {
	b := make([]byte, 32)
	_, err := rand.Read(b)
	if err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// SetAuthCookies sets HTTP-only authentication cookies
func SetAuthCookies(c *gin.Context, accessToken, refreshToken string) {
	// Determine if we're in production (HTTPS)
	secure := os.Getenv("ENV") == "production"
	
	// Access token cookie (15 minutes)
	c.SetCookie(
		"access_token",
		accessToken,
		15*60, // 15 minutes in seconds
		"/",
		"",
		secure,
		true, // HTTP-only
	)

	// Refresh token cookie (7 days)
	c.SetCookie(
		"refresh_token",
		refreshToken,
		7*24*60*60, // 7 days in seconds
		"/",
		"",
		secure,
		true, // HTTP-only
	)
}

// ClearAuthCookies clears authentication cookies
func ClearAuthCookies(c *gin.Context) {
	secure := os.Getenv("ENV") == "production"
	
	c.SetCookie(
		"access_token",
		"",
		-1,
		"/",
		"",
		secure,
		true,
	)

	c.SetCookie(
		"refresh_token",
		"",
		-1,
		"/",
		"",
		secure,
		true,
	)
}

