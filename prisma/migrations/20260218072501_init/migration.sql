-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SavedPrescription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "consumerId" INTEGER NOT NULL,
    "prescriptionUid" TEXT NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedPrescription_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SavedPrescription_prescriptionUid_fkey" FOREIGN KEY ("prescriptionUid") REFERENCES "Prescription" ("uid") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SavedPrescription" ("consumerId", "id", "prescriptionUid", "savedAt") SELECT "consumerId", "id", "prescriptionUid", "savedAt" FROM "SavedPrescription";
DROP TABLE "SavedPrescription";
ALTER TABLE "new_SavedPrescription" RENAME TO "SavedPrescription";
CREATE UNIQUE INDEX "SavedPrescription_consumerId_prescriptionUid_key" ON "SavedPrescription"("consumerId", "prescriptionUid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
