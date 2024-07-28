import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase";

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

//Add a car to the database with images
export async function addCar({ carData, images }) {
  try {
    // Authenticate the user
    const { userId } = await auth();
    if (!userId) {
      throw new Error("User not authorized");
    }

    const user = db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    //create a unique folder name for this car's images
    const carId = uuidv4(); // Generate a unique ID for the car
    const folderPath = `cars/${carId}`; // Folder path for storing images

    // Initialize Supabase client for server-side operations
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    //upload all images to Supabase Storage
    const imageUrls = [];

    for (let i = 0; i < images.length; i++) {
      const base64Data = images[i]; //taking base64 data from the images array

      // Skip if image data is not valid
      if (!base64Data || !base64Data.startsWith("data:image/")) {
        console.warn("Skipping invalid image data");
        continue;
      }

      // Extract the base64 part (remove the data:image/xyz;base64, prefix)
      const base64 = base64Data.split(",")[1]; //ex. after removing prefix: iVBORw0KGgoAAAANSUhEUgAAAAUA...
      const imageBuffer = Buffer.from(base64, "base64");

      // Determine file extension from the data URL
      const mimeMatch = base64Data.match(/data:image\/([a-zA-Z0-9]+);/); //base64Data example: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...
      const fileExtension = mimeMatch ? mimeMatch[1] : "jpeg";

      // Create filename
      const fileName = `image-${Date.now()}-${i}.${fileExtension}`;
      const filePath = `${folderPath}/${fileName}`;

      // Upload the file buffer directly
      const { data, error } = await supabase.storage
        .from("car-images")
        .upload(filePath, imageBuffer, {
          contentType: `image/${fileExtension}`,
        });

      if (error) {
        console.error("Error uploading image:", error);
        throw new Error(`Failed to upload image: ${error.message}`);
      }

      // Get the public URL for the uploaded image
      const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/car-images/${filePath}`; // disable cache in config

      imageUrls.push(publicUrl);
    }

    if (imageUrls.length === 0) {
      throw new Error("No valid images were uploaded");
    }

    // Add the car to the database
    const car = await db.car.create({
      data: {
        id: carId, // Use the same ID we used for the folder
        make: carData.make,
        model: carData.model,
        year: carData.year,
        price: carData.price,
        mileage: carData.mileage,
        color: carData.color,
        fuelType: carData.fuelType,
        transmission: carData.transmission,
        bodyType: carData.bodyType,
        seats: carData.seats,
        description: carData.description,
        status: carData.status,
        featured: carData.featured,
        images: imageUrls, // Store the array of image URLs
      },
    });

    // Revalidate the cars list page
    revalidatePath("/admin/cars");

    return {
        success: true,
      };
  } catch (error) {
    throw new Error("Error adding car:" + error.message);
  }
}
