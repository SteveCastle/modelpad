package usersync

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	uuid "github.com/satori/go.uuid"
	"github.com/supertokens/supertokens-golang/recipe/session"
)

//Schema
// CREATE TABLE sync (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     state JSONB,
//     user_id UUID,
//     created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
//     updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
// );


type Sync struct {
	ID    uuid.UUID `json:"id"`
	State string `json:"state"`
	UserId uuid.UUID `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func GetSync(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
	sync := Sync{}

	db := c.MustGet("db").(*pgxpool.Pool)
	err := db.QueryRow(context.Background(), "SELECT * FROM sync WHERE user_id = $1", userID).Scan(&sync.ID, &sync.State, &sync.UserId, &sync.CreatedAt, &sync.UpdatedAt)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"sync": sync})
}

func SetSync(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
	sync := Sync{}
	c.BindJSON(&sync)

	db := c.MustGet("db").(*pgxpool.Pool)
	err := db.QueryRow(context.Background(), "INSERT INTO sync (state, user_id) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET state = $1, updated_at = now() RETURNING created_at", sync.State, userID).Scan(&sync.CreatedAt)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"sync": sync})
}

func DeleteSync(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
	db := c.MustGet("db").(*pgxpool.Pool)
	_, err := db.Exec(context.Background(), "DELETE FROM sync WHERE user_id = $1", userID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"message": "Sync deleted"})
}