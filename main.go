package main

import (
	"context"
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
	"github.com/stevecastle/modelpad/markdown"
	"github.com/stevecastle/modelpad/models"
	"github.com/stevecastle/modelpad/notes"
	"github.com/stevecastle/modelpad/streaming"
	"github.com/stevecastle/modelpad/usersync"
	"github.com/supertokens/supertokens-golang/recipe/dashboard"
	"github.com/supertokens/supertokens-golang/recipe/emailpassword"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"github.com/supertokens/supertokens-golang/recipe/session/sessmodels"
	"github.com/supertokens/supertokens-golang/supertokens"
)

func verifySession(options *sessmodels.VerifySessionOptions) gin.HandlerFunc {
	return func(c *gin.Context) {
		session.VerifySession(options, func(rw http.ResponseWriter, r *http.Request) {
			c.Request = c.Request.WithContext(r.Context())
			c.Next()
		})(c.Writer, c.Request)
		// we call Abort so that the next handler in the chain is not called, unless we call Next explicitly
		c.Abort()
	}
}

func me(c *gin.Context) {
	// retrieve the session object as shown below
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())

	userID := sessionContainer.GetUserID()
	userInfo, err := emailpassword.GetUserByID(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"message": "Error getting user info",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": userInfo,
	},
	)

	fmt.Println(userID)
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
	err = db.QueryRow(context.Background(), "SELECT id, title, body, user_id, created_at, updated_at FROM notes WHERE id = $1 AND is_shared = true", noteUUID).Scan(&note.ID, &note.Title, &note.Body, &note.UserId, &note.CreatedAt, &note.UpdatedAt)
	if err != nil {
		c.HTML(http.StatusNotFound, "", gin.H{
			"error": "Document not found",
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
	sessionContainer := session.GetSessionFromRequestContext(c.Request.Context())
	userID := sessionContainer.GetUserID()
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

func main() {
	godotenv.Load()

	r := gin.Default()

	dbpool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		fmt.Fprintf(os.Stderr, "Unable to create connection pool: %v\n", err)
		os.Exit(1)
	}
	defer dbpool.Close()

	apiBasePath := "/api/auth"
	websiteBasePath := "/auth"
	err = supertokens.Init(supertokens.TypeInput{
		Supertokens: &supertokens.ConnectionInfo{
			ConnectionURI: os.Getenv("SUPERTOKENS_CONNECTION_URI"),
			APIKey:        os.Getenv("SUPERTOKENS_API_KEY"),
		},
		AppInfo: supertokens.AppInfo{
			AppName:         "ModelPad",
			APIDomain:       os.Getenv("AUTH_API_DOMAIN"),
			WebsiteDomain:   os.Getenv("AUTH_FRONT_END_DOMAIN"),
			APIBasePath:     &apiBasePath,
			WebsiteBasePath: &websiteBasePath,
		},
		RecipeList: []supertokens.Recipe{
			emailpassword.Init(nil),
			dashboard.Init(nil),
			session.Init(nil), // initializes session features
		},
	})

	if err != nil {
		panic(err.Error())
	}

	//Adding postgres connection to the context
	r.Use(func(c *gin.Context) {
		c.Set("db", dbpool)
		c.Next()
	})

	// Adding the CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{"https://modelpad.app", "http://localhost:5173"},
		AllowMethods: []string{"GET", "POST", "DELETE", "PUT", "OPTIONS"},
		AllowHeaders: append([]string{"content-type"},
			supertokens.GetAllCORSHeaders()...),
		AllowCredentials: true,
	}))

	// Adding the SuperTokens middleware
	r.Use(func(c *gin.Context) {
		supertokens.Middleware(http.HandlerFunc(
			func(rw http.ResponseWriter, r *http.Request) {
				c.Next()
			})).ServeHTTP(c.Writer, c.Request)
		// we call Abort so that the next handler in the chain is not called, unless we call Next explicitly
		c.Abort()
	})

	// Static File Endpoints
	r.Static("/assets", "/app/dist/assets")
	r.StaticFile("/", "/app/dist/index.html")
	r.StaticFile("/auth", "/app/dist/index.html")
	r.StaticFile("/modelpad.svg", "/app/dist/modelpad.svg")

	// Note Endpoints
	r.GET("/api/me", verifySession(&sessmodels.VerifySessionOptions{}), me)
	r.GET("/api/notes", verifySession(&sessmodels.VerifySessionOptions{}), notes.ListNotes)
	r.PUT("/api/notes/:id", verifySession(&sessmodels.VerifySessionOptions{}), notes.UpsertNote)
	r.DELETE("/api/notes/:id", verifySession(&sessmodels.VerifySessionOptions{}), notes.DeleteNote)
	r.GET("/api/notes/:id", verifySession(&sessmodels.VerifySessionOptions{}), notes.GetNote)
	r.PATCH("/api/notes/:id/share", verifySession(&sessmodels.VerifySessionOptions{}), ShareNote)

	// Document viewing endpoint (public, no authentication required)
	r.GET("/doc/:id", ViewDocument)

	// Sync Endpoints
	r.GET("/api/sync/get", verifySession(&sessmodels.VerifySessionOptions{}), usersync.GetSync)
	r.POST("/api/sync/set", verifySession(&sessmodels.VerifySessionOptions{}), usersync.SetSync)

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
