-- Lot L1.3 : date de la dernière collecte d'un profil. Les profils existants partent de leur date d'ajout.
-- AlterTable
ALTER TABLE "Profil" ADD COLUMN "collecteLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Profil" SET "collecteLe" = "createdAt";
