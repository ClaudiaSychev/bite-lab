-- Ingredients and instructions move from free text to JSON lists.
-- Existing text is kept: it becomes a single ingredient / a single instruction step.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ingredients" JSONB NOT NULL DEFAULT '[]',
    "instructions" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "publishedVersionId" TEXT,
    CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Recipe_publishedVersionId_fkey" FOREIGN KEY ("publishedVersionId") REFERENCES "RecipeVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Recipe" ("createdAt", "id", "ingredients", "instructions", "publishedVersionId", "title", "updatedAt", "userId") SELECT "createdAt", "id", CASE WHEN trim("ingredients") = '' THEN '[]' ELSE json_array(json_object('id', lower(hex(randomblob(16))), 'name', "ingredients", 'quantity', NULL, 'unit', '', 'note', '')) END, CASE WHEN trim("instructions") = '' THEN '[]' ELSE json_array(json_object('id', lower(hex(randomblob(16))), 'text', "instructions")) END, "publishedVersionId", "title", "updatedAt", "userId" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE UNIQUE INDEX "Recipe_publishedVersionId_key" ON "Recipe"("publishedVersionId");
CREATE INDEX "Recipe_userId_idx" ON "Recipe"("userId");
CREATE TABLE "new_RecipeVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "ingredients" JSONB NOT NULL,
    "instructions" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeVersion_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_RecipeVersion" ("createdAt", "id", "ingredients", "instructions", "recipeId", "title", "version") SELECT "createdAt", "id", CASE WHEN trim("ingredients") = '' THEN '[]' ELSE json_array(json_object('id', lower(hex(randomblob(16))), 'name', "ingredients", 'quantity', NULL, 'unit', '', 'note', '')) END, CASE WHEN trim("instructions") = '' THEN '[]' ELSE json_array(json_object('id', lower(hex(randomblob(16))), 'text', "instructions")) END, "recipeId", "title", "version" FROM "RecipeVersion";
DROP TABLE "RecipeVersion";
ALTER TABLE "new_RecipeVersion" RENAME TO "RecipeVersion";
CREATE UNIQUE INDEX "RecipeVersion_recipeId_version_key" ON "RecipeVersion"("recipeId", "version");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

