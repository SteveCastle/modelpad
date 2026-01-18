package main

import (
	"context"
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/russross/blackfriday/v2"
	uuid "github.com/satori/go.uuid"
	"github.com/stevecastle/modelpad/auth"
	"github.com/stevecastle/modelpad/markdown"
	"github.com/stevecastle/modelpad/models"
	"github.com/stevecastle/modelpad/notes"
	"github.com/stevecastle/modelpad/streaming"
	"github.com/stevecastle/modelpad/usersync"
)

func me(c *gin.Context) {
	// Get user ID from context (set by AuthRequired middleware)
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"message": "Unauthorized",
		})
		return
	}

	db := c.MustGet("db").(*pgxpool.Pool)

	// Fetch user from database
	var user struct {
		ID    uuid.UUID `json:"id"`
		Email string    `json:"email"`
	}
	err := db.QueryRow(context.Background(),
		"SELECT id, email FROM users WHERE id = $1",
		userID).Scan(&user.ID, &user.Email)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Error getting user info",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": user,
	})
}

// HTML template for document viewing
const documentTemplate = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{.Title}} - ModelPad</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background-color: #fafafa;
        }
        .container {
            background: white;
            padding: 3rem;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .header {
            border-bottom: 1px solid #e1e5e9;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        }
        .back-button {
            display: inline-block;
            padding: 0.5rem 1rem;
            background: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 4px;
            font-size: 0.9rem;
            margin-bottom: 1rem;
            transition: background-color 0.2s;
        }
        .back-button:hover {
            background: #0056b3;
        }
        .document-title {
            font-size: 2.5rem;
            font-weight: 600;
            margin: 0;
            color: #2c3e50;
        }
        .document-meta {
            color: #666;
            font-size: 0.9rem;
            margin-top: 0.5rem;
        }
        .document-content {
            font-size: 1.1rem;
            line-height: 1.8;
        }
        .document-content h1, .document-content h2, .document-content h3,
        .document-content h4, .document-content h5, .document-content h6 {
            color: #2c3e50;
            margin-top: 2rem;
            margin-bottom: 1rem;
        }
        .document-content h1 {
            font-size: 2rem;
            border-bottom: 2px solid #e1e5e9;
            padding-bottom: 0.5rem;
        }
        .document-content h2 {
            font-size: 1.5rem;
        }
        .document-content h3 {
            font-size: 1.3rem;
        }
        .document-content p {
            margin-bottom: 1rem;
        }
        .document-content blockquote {
            border-left: 4px solid #007bff;
            padding-left: 1rem;
            margin-left: 0;
            color: #555;
            font-style: italic;
        }
        .document-content pre {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            border: 1px solid #e1e5e9;
        }
        .document-content code {
            background: #f8f9fa;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.9rem;
        }
        .document-content pre code {
            background: none;
            padding: 0;
        }
        .document-content ul, .document-content ol {
            padding-left: 2rem;
        }
        .document-content li {
            margin-bottom: 0.5rem;
        }
        .document-content a {
            color: #007bff;
            text-decoration: none;
        }
        .document-content a:hover {
            text-decoration: underline;
        }
        .document-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
        }
        .document-content th, .document-content td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #e1e5e9;
        }
        .document-content th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        @media (max-width: 768px) {
            body {
                padding: 1rem;
            }
            .container {
                padding: 1.5rem;
            }
            .document-title {
                font-size: 2rem;
            }
            .document-content {
                font-size: 1rem;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <a href="/" class="back-button">← Back to ModelPad</a>
            <h1 class="document-title">{{.Title}}</h1>
            <div class="document-meta">
                Created: {{.CreatedAt.Format "January 2, 2006 at 3:04 PM"}}
                {{if ne .CreatedAt .UpdatedAt}}
                • Updated: {{.UpdatedAt.Format "January 2, 2006 at 3:04 PM"}}
                {{end}}
            </div>
        </div>
        <div class="document-content">
            {{.Content}}
        </div>
    </div>
</body>
</html>
`

// ViewDocument renders a document as HTML
func ViewDocument(c *gin.Context) {
	noteID := c.Param("id")

	// Parse the note ID
	noteUUID, err := uuid.FromString(noteID)
	if err != nil {
		c.HTML(http.StatusBadRequest, "", gin.H{
			"error": "Invalid document ID",
		})
		return
	}

	// Get the note from database - only if it's shared
	db := c.MustGet("db").(*pgxpool.Pool)
	var note notes.Note
	var tagsJSON []byte
	err = db.QueryRow(context.Background(), "SELECT id, title, body, user_id, parent, created_at, updated_at, COALESCE(tags, '[]'::jsonb) as tags FROM notes WHERE id = $1 AND is_shared = true", noteUUID).Scan(&note.ID, &note.Title, &note.Body, &note.UserId, &note.Parent, &note.CreatedAt, &note.UpdatedAt, &tagsJSON)
	if err != nil {
		c.HTML(http.StatusNotFound, "", gin.H{
			"error": "Document not found",
		})
		return
	}

	// Unmarshal tags from JSON
	if err := json.Unmarshal(tagsJSON, &note.Tags); err != nil {
		c.HTML(http.StatusInternalServerError, "", gin.H{
			"error": "Failed to unmarshal tags",
		})
		return
	}

	// Convert JSON body to markdown
	markdownContent, err := markdown.ConvertJSONToMarkdown(note.Body)
	if err != nil {
		c.HTML(http.StatusInternalServerError, "", gin.H{
			"error": "Error converting document",
		})
		return
	}

	// Convert markdown to HTML
	htmlContent := blackfriday.Run([]byte(markdownContent))

	// Parse and execute template
	tmpl, err := template.New("document").Parse(documentTemplate)
	if err != nil {
		c.HTML(http.StatusInternalServerError, "", gin.H{
			"error": "Template error",
		})
		return
	}

	// Render the template
	c.Header("Content-Type", "text/html; charset=utf-8")
	err = tmpl.Execute(c.Writer, gin.H{
		"Title":     note.Title,
		"Content":   template.HTML(htmlContent),
		"CreatedAt": note.CreatedAt,
		"UpdatedAt": note.UpdatedAt,
	})
	if err != nil {
		c.HTML(http.StatusInternalServerError, "", gin.H{
			"error": "Error rendering document",
		})
	}
}

// ShareNote toggles the is_shared status of a note
func ShareNote(c *gin.Context) {
	userID := c.GetString("user_id")
	noteID := c.Param("id")

	// Parse the note ID
	noteUUID, err := uuid.FromString(noteID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid document ID",
		})
		return
	}

	// Get the request body to see what sharing status to set
	var requestBody struct {
		IsShared bool `json:"is_shared"`
	}
	if err := c.ShouldBindJSON(&requestBody); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	// Update the note's sharing status - only if it belongs to the user
	db := c.MustGet("db").(*pgxpool.Pool)
	result, err := db.Exec(context.Background(),
		"UPDATE notes SET is_shared = $1, updated_at = now() WHERE id = $2 AND user_id = $3",
		requestBody.IsShared, noteUUID, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update note sharing status",
		})
		return
	}

	// Check if any rows were affected (i.e., note exists and belongs to user)
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Note not found or you don't have permission to share it",
		})
		return
	}

	// Return success response
	c.JSON(http.StatusOK, gin.H{
		"message":   "Note sharing status updated successfully",
		"is_shared": requestBody.IsShared,
	})
}

// UpdateNoteParent updates the parent relationship of a note
func UpdateNoteParent(c *gin.Context) {
	userID := c.GetString("user_id")
	noteID := c.Param("id")

	// Parse the note ID
	noteUUID, err := uuid.FromString(noteID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid note ID",
		})
		return
	}

	// Get the request body to see what parent to set
	var requestBody struct {
		Parent *string `json:"parent"`
	}
	if err := c.ShouldBindJSON(&requestBody); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid request body",
		})
		return
	}

	db := c.MustGet("db").(*pgxpool.Pool)

	// Parse parent UUID if provided
	var parentUUID *uuid.UUID
	if requestBody.Parent != nil && *requestBody.Parent != "" {
		parsedParent, err := uuid.FromString(*requestBody.Parent)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Invalid parent ID",
			})
			return
		}
		parentUUID = &parsedParent

		// Verify parent note exists and belongs to the same user
		var parentExists bool
		err = db.QueryRow(context.Background(),
			"SELECT EXISTS(SELECT 1 FROM notes WHERE id = $1 AND user_id = $2)",
			parentUUID, userID).Scan(&parentExists)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to verify parent note",
			})
			return
		}
		if !parentExists {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Parent note not found or you don't have permission to access it",
			})
			return
		}

		// Check for circular reference (prevent setting parent to a descendant)
		var wouldCreateCycle bool
		err = db.QueryRow(context.Background(), `
			WITH RECURSIVE note_hierarchy AS (
				SELECT id, parent FROM notes WHERE id = $1
				UNION ALL
				SELECT n.id, n.parent FROM notes n
				INNER JOIN note_hierarchy nh ON n.parent = nh.id
			)
			SELECT EXISTS(SELECT 1 FROM note_hierarchy WHERE id = $2)
		`, noteUUID, parentUUID).Scan(&wouldCreateCycle)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "Failed to check for circular reference",
			})
			return
		}
		if wouldCreateCycle {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Cannot set parent: would create circular reference",
			})
			return
		}
	}

	// Update the note's parent - only if it belongs to the user
	result, err := db.Exec(context.Background(),
		"UPDATE notes SET parent = $1, updated_at = now() WHERE id = $2 AND user_id = $3",
		parentUUID, noteUUID, userID)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to update note parent",
		})
		return
	}

	// Check if any rows were affected (i.e., note exists and belongs to user)
	if result.RowsAffected() == 0 {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Note not found or you don't have permission to modify it",
		})
		return
	}

	// Return success response
	c.JSON(http.StatusOK, gin.H{
		"message": "Note parent updated successfully",
		"parent":  requestBody.Parent,
	})
}

func main() {
	godotenv.Load()

	r := gin.Default()

	dbpool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to create connection pool: %v\n", err)
		os.Exit(1)
	}
	defer dbpool.Close()

	//Adding postgres connection to the context
	r.Use(func(c *gin.Context) {
		c.Set("db", dbpool)
		c.Next()
	})

	// Adding the CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"https://modelpad.app", "http://localhost:5173", "http://localhost:5174"},
		AllowMethods:     []string{"GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"content-type"},
		AllowCredentials: true,
	}))

	// Static File Endpoints
	r.Static("/assets", "/app/dist/assets")
	r.StaticFile("/", "/app/dist/index.html")
	r.StaticFile("/auth", "/app/dist/index.html")
	r.StaticFile("/modelpad.svg", "/app/dist/modelpad.svg")

	// Auth Endpoints
	r.POST("/api/auth/register", auth.Register)
	r.POST("/api/auth/login", auth.Login)
	r.POST("/api/auth/refresh", auth.Refresh)
	r.POST("/api/auth/logout", auth.Logout)
	r.GET("/api/auth/me", auth.AuthRequired(), auth.Me)

	// Legacy me endpoint (kept for compatibility)
	r.GET("/api/me", auth.AuthRequired(), me)

	// Note Endpoints
	r.GET("/api/notes", auth.AuthRequired(), notes.ListNotes)
	r.PUT("/api/notes/:id", auth.AuthRequired(), notes.UpsertNote)
	r.DELETE("/api/notes/:id", auth.AuthRequired(), notes.DeleteNote)
	r.GET("/api/notes/:id", auth.AuthRequired(), notes.GetNote)
	r.GET("/api/notes/:id/children", auth.AuthRequired(), notes.GetNoteChildren)
	r.PATCH("/api/notes/:id/share", auth.AuthRequired(), ShareNote)
	r.PATCH("/api/notes/:id/parent", auth.AuthRequired(), UpdateNoteParent)

	// Document viewing endpoint (public, no authentication required)
	r.GET("/doc/:id", ViewDocument)

	// Sync Endpoints
	r.GET("/api/sync/get", auth.AuthRequired(), usersync.GetSync)
	r.POST("/api/sync/set", auth.AuthRequired(), usersync.SetSync)

	// These endpoints match the ollama API
	r.GET("/api/tags", models.ListModels)
	r.POST("/api/show", models.GetModel)
	r.POST("/api/generate", streaming.Stream)

	// Health Check and Debugging endpoints
	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Success",
		})
	})

	r.Run()
}
