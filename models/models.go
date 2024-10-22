package models

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

type Model struct {
	Name string `json:"name"`
}

type LicenseAgreement struct {
	License    string  `json:"license"`
	Modelfile  string  `json:"modelfile"`
	Parameters string  `json:"parameters"`
	Template   string  `json:"template"`
	Details    Details `json:"details"`
}

type Details struct {
	ParentModel       string   `json:"parent_model"`
	Format            string   `json:"format"`
	Family            string   `json:"family"`
	Families          []string `json:"families"`
	ParameterSize     string   `json:"parameter_size"`
	QuantizationLevel string   `json:"quantization_level"`
}

func GetModel(c *gin.Context) {
	c.JSON(http.StatusOK, LicenseAgreement{
		License:    "COMMERCIAL",
		Modelfile:  "claude-3-haiku-20240307",
		Parameters: "claude-3-haiku-20240307",
		Template:   "claude-3-haiku-20240307",
		Details: Details{
			ParentModel:       "claude-3-haiku-20240307",
			Format:            "openai",
			Family:            "claude",
			Families:          []string{"claude"},
			ParameterSize:     "1.3B",
			QuantizationLevel: "fp32",
		},
	})
}



func ListModels(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"models": []Model{{Name: "claude-3-haiku-20240307"}, {Name: "claude-3-5-sonnet-20241022" }}})
}