import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Generate 2 digits
const twoDigits = () =>
  Math.floor(Math.random() * 90 + 10).toString();

// Generate 5 uppercase alphanumeric chars
const fiveAlphaNum = () =>
  [...Array(5)]
    .map(() => Math.random().toString(36)[2].toUpperCase())
    .join("");

// Generate + ensure unique
export const generateUniqueDisplayName = async (): Promise<string> => {
  let displayName = "";
  let exists = true;

  while (exists) {
    displayName = `TBCo_${twoDigits()}${fiveAlphaNum()}${twoDigits()}`;

    const already = await prisma.profile.findUnique({
      where: { displayName },
    });

    exists = !!already;
  }

  return displayName;
};
