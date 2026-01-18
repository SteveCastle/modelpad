package auth

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// AuthRequired is a middleware that validates JWT tokens from cookies
func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get access token from cookie
		accessToken, err := c.Cookie("access_token")
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Unauthorized - no access token",
			})
			c.Abort()
			return
		}

		// Validate the access token
		claims, err := ValidateAccessToken(accessToken)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "Unauthorized - invalid access token",
			})
			c.Abort()
			return
		}

		// Store user ID in context for handlers to use
		c.Set("user_id", claims.UserID)
		c.Next()
	}
}

