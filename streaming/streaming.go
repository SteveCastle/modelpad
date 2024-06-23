package streaming

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
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

func Stream(c *gin.Context) {
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
		Model:  "claude-3-5-sonnet-20240620",
		System: "You are an expert  assistant. When provided with a prompt you generate a response to satisfy that prompt.",
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
					Model:     "claude-3-haiku-20240307",
					Response:  delta.Delta.Text,
					CreatedAt: time.Now(),
					Done:      false,
				})
				// write a new line to the response writer
				fmt.Fprint(w, "\n")
				flusher.Flush()
			}
		}

	}

	c.JSON(http.StatusOK, CompletedStreamChunk{
		Model:              "gpt-3.5-turbo",
		CreatedAt:          time.Now(),
		Response:           "",
		Done:               true,
		Context:            []int{},
		TotalDuration:      int64(time.Since(startTime).Milliseconds()),
		LoadDuration:       0,
		PromptEvalCount:    0,
		PromptEvalDuration: 0,
		EvalCount:          0,
		EvalDuration:       0,
	})
	flusher.Flush()
}