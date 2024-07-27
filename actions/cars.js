import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

//function to convert file to base64
async function fileToBase64(file) {
  const bytes = await file.arrayBuffer(); // Convert the file to an ArrayBuffer
  const buffer = Buffer.from(bytes);
  return buffer.toString("base64");
}

// Gemini AI integration for car image processing
export async function processCarImageWithAI(file) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      //checking if the environment variable is set
      throw new Error("GEMINI_API_KEY is not configured");
    }

    // Initialize Gemini API
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY); // Initialize the GoogleGenerativeAI client with the API key
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // we'll use this model

    const base64Image = await fileToBase64(file); // Convert the file to base64 format

    // Create image part for the model
    const imagePart = {
      inlineData: {
        data: base64Image,
        mimeType: file.type,
      },
    };

    // Define the prompt for car detail extraction
    const prompt = `
    Analyze this car image and extract the following information:
    1. Make (manufacturer)
    2. Model
    3. Year (approximately)
    4. Color
    5. Body type (SUV, Sedan, Hatchback, etc.)
    6. Mileage
    7. Fuel type (your best guess)
    8. Transmission type (your best guess)
    9. Price (your best guess)
    9. Short Description as to be added to a car listing

    Format your response as a clean JSON object with these fields:
    {
      "make": "",
      "model": "",
      "year": 0000,
      "color": "",
      "price": "",
      "mileage": "",
      "bodyType": "",
      "fuelType": "",
      "transmission": "",
      "description": "",
      "confidence": 0.0
    }

    For confidence, provide a value between 0 and 1 representing how confident you are in your overall identification.
    Only respond with the JSON object, nothing else.
  `;

    // Get response from Gemini
    const result = await model.generateContent([imagePart, prompt]); // Send the image and prompt to the model for processing
    const response = await result.response;
    const text = response.text(); // Extract the text response from the model
    const cleanedText = text.replace(/```(?:json)?\n?/g, "").trim();

    // Parse the JSON response
    try {
      const carDetails = JSON.parse(cleanedText); // carDetails wll have all details that we asked above in prompt

      // Validate the response format
      const requiredFields = [
        "make",
        "model",
        "year",
        "color",
        "bodyType",
        "price",
        "mileage",
        "fuelType",
        "transmission",
        "description",
        "confidence",
      ];

      const missingFields = requiredFields.filter(
        // Check if any required field is missing
        (field) => !(field in carDetails)
      );

      if (missingFields.length > 0) {
        throw new Error(
          `AI response missing required fields: ${missingFields.join(", ")}`
        );
      }

      // Return success response with data
      return {
        success: true,
        data: carDetails,
      };
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.log("Raw response:", text);
      return {
        success: false,
        error: "Failed to parse AI response",
      };
    }
  } catch (error) {
    console.error();
    throw new Error("Gemini API error:" + error.message);
  }
}
