-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "publicKey" TEXT,
    "mood" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "id", "passwordHash", "publicKey", "role", "status", "username") SELECT "createdAt", "id", "passwordHash", "publicKey", "role", "status", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
