"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/prisma";

export async function getAdmin() {
    const { userId } = await auth();       //fetching the userId from clerk
    if (!userId) throw new Error("User not authenticated");

    const user = await db.user.findUnique({      //fetching the user from the database
        where: {
            clerkUserId: userId,
        },
    });

    if (!user || user.role !== "ADMIN") {      //checking if user is present and if they are admin or not
        return { authorized: false, reason: "not-admin"}
    }

    return { authorized: true, user };  //returning the user if they are admin

}