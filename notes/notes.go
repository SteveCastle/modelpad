package notes

import (
	"context"
	"encoding/json"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/pgvector/pgvector-go"
	uuid "github.com/satori/go.uuid"
	"github.com/stevecastle/modelpad/embeddings"
	"github.com/stevecastle/modelpad/markdown"
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

type NoteTag struct {
	ID   string   `json:"id"`
	Path []string `json:"path"`
}

type Note struct {
	ID           uuid.UUID       `json:"id"`
	Title        string          `json:"title"`
	Body         string          `json:"body"`
	Embedding    pgvector.Vector `json:"-"`
	UserId       uuid.UUID       `json:"user_id"`
	Parent       *uuid.UUID      `json:"parent"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
	Distance     float64         `json:"distance"`
	IsShared     bool            `json:"is_shared"`
	Tags         []NoteTag       `json:"tags,omitempty"`
	HasChildren  bool            `json:"has_children"`
	HasEmbedding bool            `json:"has_embedding"`
}

type PaginationInfo struct {
	Page    int  `json:"page"`
	Limit   int  `json:"limit"`
	Total   int  `json:"total"`
	HasMore bool `json:"has_more"`
}

func RagSearch(text string, userID string, distance float64, parentFilter *string, page int, limit int, c *gin.Context) ([]Note, int, error) {
	var vector pgvector.Vector
	var notes []Note
	if text != "" {
		embedding, err := embeddings.CreateEmbedding(text)
		if err != nil {
			return nil, 0, err
		}
		vector = pgvector.NewVector(embedding.Embedding)
	}
	db := c.MustGet("db").(*pgxpool.Pool)
	
	// Calculate offset
	offset := (page - 1) * limit
	
	// Get total count
	var totalCount int
	var countErr error
	if text != "" {
		if parentFilter != nil && *parentFilter == "" {
			// Root notes only
			countErr = db.QueryRow(context.Background(), "SELECT COUNT(*) FROM notes WHERE user_id = $1 AND parent IS NULL AND embedding <-> $2 < $3", userID, vector, distance).Scan(&totalCount)
		} else if parentFilter != nil {
			// Specific parent
			countErr = db.QueryRow(context.Background(), "SELECT COUNT(*) FROM notes WHERE user_id = $1 AND parent = $2 AND embedding <-> $3 < $4", userID, parentFilter, vector, distance).Scan(&totalCount)
		} else {
			// All notes
			countErr = db.QueryRow(context.Background(), "SELECT COUNT(*) FROM notes WHERE user_id = $1 AND embedding <-> $2 < $3", userID, vector, distance).Scan(&totalCount)
		}
	} else {
		if parentFilter != nil && *parentFilter == "" {
			// Root notes only
			countErr = db.QueryRow(context.Background(), "SELECT COUNT(*) FROM notes WHERE user_id = $1 AND parent IS NULL", userID).Scan(&totalCount)
		} else if parentFilter != nil {
			// Specific parent
			countErr = db.QueryRow(context.Background(), "SELECT COUNT(*) FROM notes WHERE user_id = $1 AND parent = $2", userID, parentFilter).Scan(&totalCount)
		} else {
			// All notes
			countErr = db.QueryRow(context.Background(), "SELECT COUNT(*) FROM notes WHERE user_id = $1", userID).Scan(&totalCount)
		}
	}
	
	if countErr != nil {
		return nil, 0, countErr
	}
	
	// Query notes with has_children flag
	var rows pgx.Rows
	var err error
	if text != "" {
		if parentFilter != nil && *parentFilter == "" {
			// Root notes only with search
			rows, err = db.Query(context.Background(), `
				SELECT id, title, body, parent, created_at, updated_at, 
				       embedding <-> $2 as distance, 
				       COALESCE(is_shared, false) as is_shared, 
				       COALESCE(tags, '[]'::jsonb) as tags,
				       EXISTS(SELECT 1 FROM notes c WHERE c.parent = notes.id) as has_children,
				       embedding IS NOT NULL as has_embedding
				FROM notes 
				WHERE user_id = $1 AND parent IS NULL AND embedding <-> $2 < $3 
				ORDER BY embedding <-> $2
				LIMIT $4 OFFSET $5`, userID, vector, distance, limit, offset)
		} else if parentFilter != nil {
			// Specific parent with search
			rows, err = db.Query(context.Background(), `
				SELECT id, title, body, parent, created_at, updated_at, 
				       embedding <-> $3 as distance, 
				       COALESCE(is_shared, false) as is_shared, 
				       COALESCE(tags, '[]'::jsonb) as tags,
				       EXISTS(SELECT 1 FROM notes c WHERE c.parent = notes.id) as has_children,
				       embedding IS NOT NULL as has_embedding
				FROM notes 
				WHERE user_id = $1 AND parent = $2 AND embedding <-> $3 < $4 
				ORDER BY embedding <-> $3
				LIMIT $5 OFFSET $6`, userID, parentFilter, vector, distance, limit, offset)
		} else {
			// All notes with search
			rows, err = db.Query(context.Background(), `
				SELECT id, title, body, parent, created_at, updated_at, 
				       embedding <-> $2 as distance, 
				       COALESCE(is_shared, false) as is_shared, 
				       COALESCE(tags, '[]'::jsonb) as tags,
				       EXISTS(SELECT 1 FROM notes c WHERE c.parent = notes.id) as has_children,
				       embedding IS NOT NULL as has_embedding
				FROM notes 
				WHERE user_id = $1 AND embedding <-> $2 < $3 
				ORDER BY embedding <-> $2
				LIMIT $4 OFFSET $5`, userID, vector, distance, limit, offset)
		}
	} else {
		if parentFilter != nil && *parentFilter == "" {
			// Root notes only without search
			rows, err = db.Query(context.Background(), `
				SELECT id, title, body, parent, created_at, updated_at, 
				       0 as distance, 
				       COALESCE(is_shared, false) as is_shared, 
				       COALESCE(tags, '[]'::jsonb) as tags,
				       EXISTS(SELECT 1 FROM notes c WHERE c.parent = notes.id) as has_children,
				       embedding IS NOT NULL as has_embedding
				FROM notes 
				WHERE user_id = $1 AND parent IS NULL 
				ORDER BY updated_at DESC
				LIMIT $2 OFFSET $3`, userID, limit, offset)
		} else if parentFilter != nil {
			// Specific parent without search
			rows, err = db.Query(context.Background(), `
				SELECT id, title, body, parent, created_at, updated_at, 
				       0 as distance, 
				       COALESCE(is_shared, false) as is_shared, 
				       COALESCE(tags, '[]'::jsonb) as tags,
				       EXISTS(SELECT 1 FROM notes c WHERE c.parent = notes.id) as has_children,
				       embedding IS NOT NULL as has_embedding
				FROM notes 
				WHERE user_id = $1 AND parent = $2 
				ORDER BY updated_at DESC
				LIMIT $3 OFFSET $4`, userID, parentFilter, limit, offset)
		} else {
			// All notes without search
			rows, err = db.Query(context.Background(), `
				SELECT id, title, body, parent, created_at, updated_at, 
				       0 as distance, 
				       COALESCE(is_shared, false) as is_shared, 
				       COALESCE(tags, '[]'::jsonb) as tags,
				       EXISTS(SELECT 1 FROM notes c WHERE c.parent = notes.id) as has_children,
				       embedding IS NOT NULL as has_embedding
				FROM notes 
				WHERE user_id = $1 
				ORDER BY updated_at DESC
				LIMIT $2 OFFSET $3`, userID, limit, offset)
		}
	}
	
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var note Note
		var tagsJSON []byte
		err := rows.Scan(&note.ID, &note.Title, &note.Body, &note.Parent, &note.CreatedAt, &note.UpdatedAt, &note.Distance, &note.IsShared, &tagsJSON, &note.HasChildren, &note.HasEmbedding)
		if err != nil {
			return nil, 0, err
		}

		// Unmarshal tags from JSON
		if err := json.Unmarshal(tagsJSON, &note.Tags); err != nil {
			return nil, 0, err
		}

		notes = append(notes, note)
	}
	
	return notes, totalCount, nil
}

func ListNotes(c *gin.Context) {
	userID := c.GetString("user_id")
	searchParam := c.Query("search")
	parentParam := c.Query("parent")
	
	// Parse pagination parameters
	page := 1
	if pageStr := c.Query("page"); pageStr != "" {
		if p, err := json.Number(pageStr).Int64(); err == nil && p > 0 {
			page = int(p)
		}
	}
	
	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := json.Number(limitStr).Int64(); err == nil && l > 0 && l <= 200 {
			limit = int(l)
		}
	}
	
	distance := .8
	
	// Handle parent filter
	// Check if 'parent' parameter exists in the query (even if empty)
	var parentFilter *string
	if _, exists := c.GetQuery("parent"); exists {
		// Empty string means root notes, non-empty means specific parent
		parentFilter = &parentParam
	}
	
	notes, totalCount, err := RagSearch(searchParam, userID, distance, parentFilter, page, limit, c)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	
	hasMore := page*limit < totalCount
	
	c.JSON(200, gin.H{
		"notes": notes,
		"pagination": PaginationInfo{
			Page:    page,
			Limit:   limit,
			Total:   totalCount,
			HasMore: hasMore,
		},
	})
}

func GetNote(c *gin.Context) {
	userID := c.GetString("user_id")
	noteID := c.Param("id")
	note := Note{}

	db := c.MustGet("db").(*pgxpool.Pool)
	var tagsJSON []byte
	var hasChildren bool
	var hasEmbedding bool
	err := db.QueryRow(context.Background(), `
		SELECT id, title, body, user_id, parent, created_at, updated_at, 
		       COALESCE(is_shared, false) as is_shared, 
		       COALESCE(tags, '[]'::jsonb) as tags,
		       EXISTS(SELECT 1 FROM notes c WHERE c.parent = notes.id) as has_children,
		       embedding IS NOT NULL as has_embedding
		FROM notes 
		WHERE id = $1 AND user_id = $2`, noteID, userID).Scan(&note.ID, &note.Title, &note.Body, &note.UserId, &note.Parent, &note.CreatedAt, &note.UpdatedAt, &note.IsShared, &tagsJSON, &hasChildren, &hasEmbedding)
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	
	note.HasChildren = hasChildren
	note.HasEmbedding = hasEmbedding

	// Unmarshal tags from JSON
	if err := json.Unmarshal(tagsJSON, &note.Tags); err != nil {
		c.JSON(500, gin.H{"error": "Failed to unmarshal tags: " + err.Error()})
		return
	}

	c.JSON(200, gin.H{"note": note})
}

// GetNoteChildren returns immediate children of a given note
func GetNoteChildren(c *gin.Context) {
	userID := c.GetString("user_id")
	noteID := c.Param("id")
	
	// Verify the parent note exists and belongs to the user
	db := c.MustGet("db").(*pgxpool.Pool)
	var noteExists bool
	err := db.QueryRow(context.Background(), 
		"SELECT EXISTS(SELECT 1 FROM notes WHERE id = $1 AND user_id = $2)", 
		noteID, userID).Scan(&noteExists)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to verify parent note"})
		return
	}
	if !noteExists {
		c.JSON(404, gin.H{"error": "Parent note not found or you don't have permission to access it"})
		return
	}
	
	// Get children of the specified parent
	rows, err := db.Query(context.Background(), `
		SELECT id, title, body, parent, created_at, updated_at,
		       0 as distance,
		       COALESCE(is_shared, false) as is_shared,
		       COALESCE(tags, '[]'::jsonb) as tags,
		       EXISTS(SELECT 1 FROM notes c WHERE c.parent = notes.id) as has_children,
		       embedding IS NOT NULL as has_embedding
		FROM notes
		WHERE user_id = $1 AND parent = $2
		ORDER BY updated_at DESC`, userID, noteID)
	
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()
	
	var notes []Note
	for rows.Next() {
		var note Note
		var tagsJSON []byte
		err := rows.Scan(&note.ID, &note.Title, &note.Body, &note.Parent, &note.CreatedAt, &note.UpdatedAt, &note.Distance, &note.IsShared, &tagsJSON, &note.HasChildren, &note.HasEmbedding)
		if err != nil {
			c.JSON(500, gin.H{"error": err.Error()})
			return
		}

		// Unmarshal tags from JSON
		if err := json.Unmarshal(tagsJSON, &note.Tags); err != nil {
			c.JSON(500, gin.H{"error": "Failed to unmarshal tags: " + err.Error()})
			return
		}

		notes = append(notes, note)
	}
	
	c.JSON(200, gin.H{"notes": notes})
}

func UpsertNote(c *gin.Context) {
	userID := c.GetString("user_id")
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

	// Marshal tags to JSON
	tagsJSON, err := json.Marshal(note.Tags)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to marshal tags: " + err.Error()})
		return
	}

	db := c.MustGet("db").(*pgxpool.Pool)

	tx, err := db.Begin(context.Background())
	if err != nil {
		c.JSON(500, gin.H{"error": err.Error()})
		return
	}

	_, err = tx.Exec(context.Background(), "INSERT INTO notes (id, title, body, user_id, parent, embedding, tags) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO UPDATE SET id = $1, title = $2, body = $3, parent = $5, embedding = $6, tags = $7, updated_at = now()", note.ID, note.Title, note.Body, userID, note.Parent, newVector, tagsJSON)
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
	userID := c.GetString("user_id")
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
