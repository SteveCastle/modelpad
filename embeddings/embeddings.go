package embeddings

import (
	"context"
	"os"

	"github.com/sashabaranov/go-openai"
)

func CreateEmbedding(text string) (openai.Embedding,error) {
	OPEN_AI_TOKEN := os.Getenv("OPENAI_API_KEY")
	client := openai.NewClient(OPEN_AI_TOKEN)

		// Create an EmbeddingRequest for the target text
		targetReq := openai.EmbeddingRequest{
			Input: []string{text},
			Model: openai.AdaEmbeddingV2,
		}

		// Create an embedding for the target text
		targetResponse, err := client.CreateEmbeddings(context.Background(), targetReq)
		if err != nil {
			return openai.Embedding{}, err
		}

		// Print the target embedding
		return targetResponse.Data[0], nil
}