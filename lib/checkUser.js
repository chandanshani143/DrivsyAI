import { currentUser } from "@clerk/nextjs/server";
import { db } from "./prisma"

//we have created this file to store the user in the database, since we are using clerk for authentication and user creation
export const checkUser = async () => {
    const user = await currentUser();           //getting the user from clerk

    console.log("Prisma Client:", db);
    if (!user) {
        return null;
    }

    try {
        const loggedInUser = await db.user.findUnique({    //checking if the user is present in the database     
            where: {
                clerkUserId: user.id,
            }
        });

        if(loggedInUser) {
            return loggedInUser;         //if the user is present in the database, return the user
        }

        const newUser = await db.user.create({         //if the user is not present in the database, create a new user
            data: {
                clerkUserId: user.id,
                name: `${user.firstName} ${user.lastName}`,
                imageUrl: user.imageUrl,
                email: user.emailAddresses[0].emailAddress,
            }
        });
        return newUser;         //return the new user
        
    } catch (error) {
        console.log(error.message)
    }
};