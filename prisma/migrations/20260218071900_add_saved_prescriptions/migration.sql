-- CreateTable
CREATE TABLE "SavedPrescription" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "consumerId" INTEGER NOT NULL,
    "prescriptionUid" TEXT NOT NULL,
    "savedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedPrescription_consumerId_fkey" FOREIGN KEY ("consumerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedPrescription_consumerId_prescriptionUid_key" ON "SavedPrescription"("consumerId", "prescriptionUid");
