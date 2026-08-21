CREATE TABLE "UserProfileTitle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#a78bfa',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProfileTitle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProfileTitle_userId_key" ON "UserProfileTitle"("userId");

ALTER TABLE "UserProfileTitle" ADD CONSTRAINT "UserProfileTitle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
