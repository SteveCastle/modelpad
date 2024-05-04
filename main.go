package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/supertokens/supertokens-golang/recipe/dashboard"
	"github.com/supertokens/supertokens-golang/recipe/session"
	"github.com/supertokens/supertokens-golang/recipe/thirdpartyemailpassword"
	"github.com/supertokens/supertokens-golang/recipe/thirdpartyemailpassword/tpepmodels"
	"github.com/supertokens/supertokens-golang/supertokens"
)

type StreamChunk struct {
	Model string `json:"model"`
	Response string `json:"response"`
	CreatedAt time.Time `json:"created_at"`
	Done bool `json:"done"`
}

type CompletedStreamChunk struct  {
    Model              string    `json:"model"`
    CreatedAt          time.Time `json:"created_at"`
    Response           string    `json:"response"`
    Done               bool      `json:"done"`
    Context            []int     `json:"context"`
    TotalDuration      int64     `json:"total_duration"`
    LoadDuration       int64     `json:"load_duration"`
    PromptEvalCount    int       `json:"prompt_eval_count"`
    PromptEvalDuration int64     `json:"prompt_eval_duration"`
    EvalCount          int       `json:"eval_count"`
    EvalDuration       int64     `json:"eval_duration"`
}

type AnthropicRequestOptions struct {
    Model     string `json:"model"`
	System string `json:"system"`
    Messages  []struct {
        Role    string `json:"role"`
        Content string `json:"content"`
    } `json:"messages"`
    MaxTokens int  `json:"max_tokens"`
    Stream    bool `json:"stream"`
}

type ContentBlockDelta struct {
	Type string `json:"type"`
	Index int `json:"index"`
	Delta struct {
		Type string `json:"type"`
		Text string `json:"text"`
	}
}

type GenerateRequest struct {
	Model     string `json:"model"`
	Prompt    string `json:"prompt"`
}

type Model struct {
	Name string `json:"name"`
}

type LicenseAgreement struct {
    License    string   `json:"license"`
    Modelfile  string   `json:"modelfile"`
    Parameters string   `json:"parameters"`
    Template   string   `json:"template"`
    Details    Details  `json:"details"`
}

type Details struct {
    ParentModel        string   `json:"parent_model"`
    Format             string   `json:"format"`
    Family             string   `json:"family"`
    Families           []string `json:"families"`
    ParameterSize      string   `json:"parameter_size"`
    QuantizationLevel  string   `json:"quantization_level"`
}

func generateHandler(c *gin.Context) {
	startTime := time.Now()
	w := c.Writer
	header := w.Header()
	header.Set("Transfer-Encoding", "chunked")
	header.Set("Content-Type", "application/json")
	header.Set("Connection", "keep-alive")
	header.Set("Cache-Control", "no-cache")

	w.WriteHeader(http.StatusOK)

    apikey := os.Getenv("ANTHROPIC_API_KEY")

	// Get the request body
	var reqBody GenerateRequest
	err := c.BindJSON(&reqBody)
	if err != nil {
		fmt.Printf("Error binding request body: %v\n", err)
		return
	}



    // Create your request body
    body := AnthropicRequestOptions{
        Model: "claude-3-haiku-20240307",
		System: "You are an expert coding assistant. When provided with a prompt you generate code to satisfy that prompt.",
        Messages: []struct {
            Role    string `json:"role"`
            Content string `json:"content"`
        }{
            {Role: "user", Content: reqBody.Prompt},
        },
        MaxTokens: 1256,
        Stream:    true,
    }

    bodyBytes, err := json.Marshal(body)
    if err != nil {
        fmt.Printf("Error marshaling request body: %v\n", err)
        return
    }

    // Create the request
    req, err := http.NewRequest("POST", os.Getenv("ANTHROPIC_ROUTE"), bytes.NewBuffer(bodyBytes))
    if err != nil {
        fmt.Printf("Error creating request: %v\n", err)
        return
    }

    // Set headers
    req.Header.Set("Content-Type", "application/json")
    req.Header.Set("anthropic-version", "2023-06-01")
    req.Header.Set("anthropic-beta", "messages-2023-12-15")
    req.Header.Set("x-api-key", apikey)

    // Create an HTTP client and send the request
    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        fmt.Printf("Error sending request: %v\n", err)
        return
    }
    defer resp.Body.Close()
    reader := bufio.NewReader(resp.Body)
    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
        return
    }
	var eventType string
    for {
        line, err := reader.ReadBytes('\n')
        if err != nil {
            break
        }
		// If the line starts with "event:" it looks like event: event_type
		// If the line starts with "data:" it looks like data: {json}

		if bytes.HasPrefix(line, []byte("event: ")) {
			eventType = strings.TrimSpace(string(bytes.TrimPrefix(line, []byte("event: "))))
		}
		if bytes.HasPrefix(line, []byte("data: ")) {
			// If the event type is content_block_delta, parse the json into a struct
			if eventType == "content_block_delta" {

				var delta ContentBlockDelta
				err := json.Unmarshal(bytes.TrimPrefix(line, []byte("data: ")), &delta)
				if err != nil {
					fmt.Printf("Error unmarshaling content_block_delta: %v\n", err)
					return
				}
				c.JSON(http.StatusOK, StreamChunk{
					Model: "claude-3-haiku-20240307",
					Response: delta.Delta.Text,
					CreatedAt: time.Now(),
					Done: false,
				})
				// write a new line to the response writer
				fmt.Fprint(w, "\n")
				flusher.Flush()
			}
		}

    }

	c.JSON(http.StatusOK, CompletedStreamChunk{
		Model: "gpt-3.5-turbo",
		CreatedAt: time.Now(),
		Response: "",
		Done: true,
		Context: []int{},
		TotalDuration: int64(time.Since(startTime).Milliseconds()),
		LoadDuration: 0,
		PromptEvalCount: 0,
		PromptEvalDuration: 0,
		EvalCount: 0,
		EvalDuration: 0,
	})
	flusher.Flush()
}

func main() {
	godotenv.Load()

	r := gin.Default()

    apiBasePath := "/api/auth"
    websiteBasePath := "/auth"
    err := supertokens.Init(supertokens.TypeInput{
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

	r.Static("/assets", "/app/dist/assets")
	r.StaticFile("/", "/app/dist/index.html")
	r.StaticFile("/auth", "/app/dist/index.html")
	r.StaticFile("/modelpad.svg", "/app/dist/modelpad.svg")



	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "Success",
		})
	})
	r.GET("/api/tags", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"models": []Model{{Name: "Claude 3 Haiku"}},
		})
	})
	r.POST("/api/show", func(c *gin.Context) {
		c.JSON(http.StatusOK, LicenseAgreement{
			License: "COMMERCIAL",
			Modelfile: "claude-3-haiku-20240307",
			Parameters: "claude-3-haiku-20240307",
			Template: "claude-3-haiku-20240307",
			Details: Details{
				ParentModel: "claude-3-haiku-20240307",
				Format: "openai",
				Family: "claude",
				Families: []string{"claude"},
				ParameterSize: "1.3B",
				QuantizationLevel: "fp32",
			},
		})
	})
	r.POST("/api/generate", generateHandler)
	r.Run() // listen and serve on 0.0.0.0:8080 (for windows "localhost:8080")
}