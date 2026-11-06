-- Lot L1.5 : note libre et étiquettes de l'utilisateur sur chaque profil.
-- AlterTable
ALTER TABLE "Profil" ADD COLUMN "note" TEXT,
ADD COLUMN "etiquettes" TEXT[] DEFAULT ARRAY[]::TEXT[];
