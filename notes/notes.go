package notes

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Note struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

func ListNotes(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"notes": []Note{
			{ID: "1", Title: "My First Document"},
			{ID: "2", Title: "My Second Document"},
		},
	})
}

func GetNote(c *gin.Context) {
	id := c.Param("id")
	c.JSON(http.StatusOK, gin.H{
		"note": Note{ID: id, Title: "My First Document"},
	})
}