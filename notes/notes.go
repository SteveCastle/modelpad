package notes

import (
	"context"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"
	uuid "github.com/satori/go.uuid"
	"github.com/stevecastle/modelpad/embeddings"
	"github.com/stevecastle/modelpad/markdown"
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
//	   embedding VECTOR,
//     user_id UUID,
//     created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now(),
//     updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now()
// );

type Note struct {
	ID        uuid.UUID       `json:"id"`
	Title     string          `json:"title"`
	Body      string          `json:"body"`
	Embedding pgvector.Vector `json:"embedding"`
	UserId    uuid.UUID       `json:"user_id"`
	Parent    *uuid.UUID      `json:"parent"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
	Distance  float64         `json:"distance"`
	IsShared  bool            `json:"is_shared"`
}

func RagSearch(text string, userID string, distance float64, c *gin.Context) []Note {
	var vector pgvector.Vector
	var notes []Note
	if text != "" {
		embedding, err := embeddings.CreateEmbedding(text)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return nil
		}
		vector = pgvector.NewVector(embedding.Embedding)
	}
	db := c.MustGet("db").(*pgxpool.Pool)
	var rows pgx.Rows
	var err error
	if text != "" {
		rows, err = db.Query(context.Background(), "SELECT id,title, body, parent, created_at,updated_at, embedding <-> $2 as distance, COALESCE(is_shared, false) as is_shared FROM notes WHERE user_id = $1 AND embedding <-> $2 < $3 ORDER BY embedding <-> $2", userID, vector, distance)
	} else {
		rows, err = db.Query(context.Background(), "SELECT id,title, body, parent, created_at,updated_at, 0 as distance, COALESCE(is_shared, false) as is_shared FROM notes WHERE user_id = $1 ORDER BY updated_at DESC", userID)
	}
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return nil
	}

	for rows.Next() {
		var note Note
		err := rows.Scan(&note.ID, &note.Title, &note.Body, &note.Parent, &note.CreatedAt, &note.UpdatedAt, &note.Distance, &note.IsShared)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return nil
		}
		notes = append(notes, note)
	}
	return notes
}

func ListNotes(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
	searchParam := c.Query("search")
	distance := .8
	notes := RagSearch(searchParam, userID, distance, c)

	c.JSON(200, gin.H{"notes": notes})
}

func GetNote(c *gin.Context) {
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
	noteID := c.Param("id")
	note := Note{}

	db := c.MustGet("db").(*pgxpool.Pool)
	err := db.QueryRow(context.Background(), "SELECT id, title, body, user_id, parent, created_at, updated_at, COALESCE(is_shared, false) as is_shared FROM notes WHERE id = $1 AND user_id = $2", noteID, userID).Scan(&note.ID, &note.Title, &note.Body, &note.UserId, &note.Parent, &note.CreatedAt, &note.UpdatedAt, &note.IsShared)
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
	markdown, err := markdown.ConvertJSONToMarkdown(note.Body)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	// Append a new line to the start of the markdown with the Note title
	markdown = "# " + note.Title + "\n" + markdown

	var newVector *pgvector.Vector
	embedding, err := embeddings.CreateEmbedding(markdown)
	if err != nil {
		// If embedding creation fails, use NULL
		newVector = nil
	} else {
		vector := pgvector.NewVector(embedding.Embedding)
		newVector = &vector
	}
	db := c.MustGet("db").(*pgxpool.Pool)

	tx, err := db.Begin(context.Background())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	_, err = tx.Exec(context.Background(), "INSERT INTO notes (id, title, body, user_id, parent, embedding) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET id = $1, title = $2, body = $3, parent = $5, embedding = $6, updated_at = now()", note.ID, note.Title, note.Body, userID, note.Parent, newVector)
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

	//In a transaction delete all descendant notes, their revisions, and then the note itself
	tx, err := db.Begin(context.Background())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	// First, get all descendant note IDs using a recursive CTE
	// This includes the note itself and all its children, grandchildren, etc.
	rows, err := tx.Query(context.Background(), `
		WITH RECURSIVE note_hierarchy AS (
			-- Start with the note being deleted
			SELECT id FROM notes WHERE id = $1 AND user_id = $2
			UNION ALL
			-- Recursively find all children
			SELECT n.id FROM notes n
			INNER JOIN note_hierarchy nh ON n.parent = nh.id
			WHERE n.user_id = $2
		)
		SELECT id FROM note_hierarchy
	`, noteID, userID)

	if err != nil {
		tx.Rollback(context.Background())
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	var noteIDs []string
	for rows.Next() {
		var id string
		err := rows.Scan(&id)
		if err != nil {
			tx.Rollback(context.Background())
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
		noteIDs = append(noteIDs, id)
	}
	rows.Close()

	// Check if the original note exists and belongs to the user
	if len(noteIDs) == 0 {
		tx.Rollback(context.Background())
		c.JSON(404, gin.H{"error": "Note not found or you don't have permission to delete it"})
		return
	}

	// Delete all revisions for all descendant notes
	for _, id := range noteIDs {
		_, err = tx.Exec(context.Background(), "DELETE FROM revisions WHERE note_id = $1", id)
		if err != nil {
			tx.Rollback(context.Background())
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
	}

	// Delete all descendant notes (this will cascade delete in order due to foreign key constraints)
	// We need to delete children first, then parents
	for i := len(noteIDs) - 1; i >= 0; i-- {
		_, err = tx.Exec(context.Background(), "DELETE FROM notes WHERE id = $1 AND user_id = $2", noteIDs[i], userID)
		if err != nil {
			tx.Rollback(context.Background())
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}
	}

	err = tx.Commit(context.Background())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	deletedCount := len(noteIDs)
	if deletedCount == 1 {
		c.JSON(200, gin.H{"message": "Note deleted"})
	} else {
		c.JSON(200, gin.H{
			"message":       "Note and child notes deleted",
			"deleted_count": deletedCount,
		})
	}
}
