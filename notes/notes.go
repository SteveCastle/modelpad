package notes

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	uuid "github.com/satori/go.uuid"
	"github.com/supertokens/supertokens-golang/recipe/session"
)

//Schema
// CREATE TABLE revisions (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//	   note_id UUID REFERENCES notes(id),
//     title TEXT,
//     body TEXT,
//     user_id UUID,
//     created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
//     updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
// );

//Schema
// CREATE TABLE notes (
//     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     title TEXT,
//     body TEXT,
//     user_id UUID,
//     created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
//     updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
// );


type Note struct {
	ID    uuid.UUID `json:"id"`
	Title string `json:"title"`
	Body string `json:"body"`
	UserId uuid.UUID `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func ListNotes(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
    userID := sessionContainer.GetUserID()
	notes:= []Note{}

	db := c.MustGet("db").(*pgxpool.Pool)
	rows, err := db.Query(context.Background(), "SELECT * FROM notes WHERE user_id = $1", userID)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	for rows.Next() {
		var note Note
		err := rows.Scan(&note.ID, &note.Title, &note.Body, &note.UserId, &note.CreatedAt, &note.UpdatedAt)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		notes = append(notes, note)
	}

	c.JSON(200, gin.H{"notes": notes})
}

func GetNote(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
	noteID := c.Param("id")
	note := Note{}

	db := c.MustGet("db").(*pgxpool.Pool)
	err := db.QueryRow(context.Background(), "SELECT * FROM notes WHERE id = $1 AND user_id = $2", noteID, userID).Scan(&note.ID, &note.Title, &note.Body, &note.UserId, &note.CreatedAt, &note.UpdatedAt)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"note": note})
}

func CreateNote(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
	note := Note{}
	c.BindJSON(&note)

	db := c.MustGet("db").(*pgxpool.Pool)
	err := db.QueryRow(context.Background(), "INSERT INTO notes (title, body, user_id) VALUES ($1, $2, $3) RETURNING id, created_at, updated_at", note.Title, note.Body, userID).Scan(&note.ID, &note.CreatedAt, &note.UpdatedAt)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"note": note})
}

func UpdateNote(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
	noteID := c.Param("id")
	note := Note{}
	c.BindJSON(&note)

	db := c.MustGet("db").(*pgxpool.Pool)
	err := db.QueryRow(context.Background(), "UPDATE notes SET title = $1, body = $2, updated_at = now() WHERE id = $3 AND user_id = $4 RETURNING created_at", note.Title, note.Body, noteID, userID).Scan(&note.CreatedAt)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"note": note})
}

func UpsertNote(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
	note := Note{}
	note.UserId = uuid.FromStringOrNil(userID)
	err := c.BindJSON(&note)
	if err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	db := c.MustGet("db").(*pgxpool.Pool)

	// err = db.QueryRow(context.Background(), "INSERT INTO notes (id, title, body, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET id = $1, title = $2, body = $3, updated_at = now() RETURNING id, created_at, updated_at", note.ID, note.Title, note.Body, userID).Scan(&note.ID, &note.CreatedAt, &note.UpdatedAt)
	// if err != nil {
	// 	c.JSON(500, gin.H{"error": err.Error()})
	// 	return
	// }
	// // Also create a revision
	// _, err = db.Exec(context.Background(), "INSERT INTO revisions (note_id, title, body, user_id) VALUES ($1, $2, $3, $4)", note.ID, note.Title, note.Body, note.UserId)
	// if err != nil {
	// 	c.JSON(500, gin.H{"error": err.Error()})
	// 	return
	// }

	tx, err := db.Begin(context.Background())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	_, err = tx.Exec(context.Background(), "INSERT INTO notes (id, title, body, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET id = $1, title = $2, body = $3, updated_at = now()", note.ID, note.Title, note.Body, userID)
	if err != nil {
		tx.Rollback(context.Background())
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	_, err = tx.Exec(context.Background(), "INSERT INTO revisions (note_id, title, body, user_id) VALUES ($1, $2, $3, $4)", note.ID, note.Title, note.Body, note.UserId)
	if err != nil {
		tx.Rollback(context.Background())
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	err = tx.Commit(context.Background())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	c.JSON(200, gin.H{"note": note})
}

func DeleteNote(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
	noteID := c.Param("id")

	db := c.MustGet("db").(*pgxpool.Pool)

	 //In a transaction delete any revisions and then the note
	tx, err := db.Begin(context.Background())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	_, err = tx.Exec(context.Background(), "DELETE FROM revisions WHERE note_id = $1", noteID)
	if err != nil {
		tx.Rollback(context.Background())
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	_, err = tx.Exec(context.Background(), "DELETE FROM notes WHERE id = $1 AND user_id = $2", noteID, userID)
	if err != nil {
		tx.Rollback(context.Background())
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	err = tx.Commit(context.Background())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	c.JSON(200, gin.H{"message": "Note deleted"})
}