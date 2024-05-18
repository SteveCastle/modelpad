package main

import (
	"context"
	"fmt"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	"github.com/stevecastle/modelpad/models"
	"github.com/stevecastle/modelpad/notes"
	"github.com/stevecastle/modelpad/streaming"
	"github.com/stevecastle/modelpad/usersync"
	"github.com/supertokens/supertokens-golang/recipe/dashboard"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"github.com/supertokens/supertokens-golang/recipe/session/sessmodels"
	"github.com/supertokens/supertokens-golang/recipe/thirdpartyemailpassword"
	"github.com/supertokens/supertokens-golang/recipe/thirdpartyemailpassword/tpepmodels"
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
    userInfo, err := thirdpartyemailpassword.GetUserById(userID)
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
            APIKey: os.Getenv("SUPERTOKENS_API_KEY"),
        },
        AppInfo: supertokens.AppInfo{
            AppName: "ModelPad",
            APIDomain: os.Getenv("AUTH_API_DOMAIN"),
            WebsiteDomain: os.Getenv("AUTH_FRONT_END_DOMAIN"),
            APIBasePath: &apiBasePath,
            WebsiteBasePath: &websiteBasePath,
        },
        RecipeList: []supertokens.Recipe{
            thirdpartyemailpassword.Init(&tpepmodels.TypeInput{/*TODO: See next step*/}),
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
	r.POST("/api/notes", verifySession(&sessmodels.VerifySessionOptions{}), notes.CreateNote)
	r.PUT("/api/notes/:id", verifySession(&sessmodels.VerifySessionOptions{}), notes.UpsertNote)
	r.DELETE("/api/notes/:id", verifySession(&sessmodels.VerifySessionOptions{}), notes.DeleteNote)
	r.GET("/api/notes/:id", verifySession(&sessmodels.VerifySessionOptions{}), notes.GetNote)

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