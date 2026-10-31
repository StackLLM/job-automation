-- Lot L1.1 : les profils trouvés et les recherches sont gardés sur le compte.
-- CreateTable
CREATE TABLE "RechercheProfils" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requete" TEXT NOT NULL,
    "lieu" TEXT,
    "pages" INTEGER,
    "source" TEXT NOT NULL,
    "trouves" INTEGER NOT NULL,
    "rejetes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RechercheProfils_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profil" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rechercheId" TEXT,
    "urlNormalisee" TEXT NOT NULL,
    "nom" TEXT,
    "poste" TEXT,
    "entreprise" TEXT,
    "lieu" TEXT,
    "extrait" TEXT,
    "image" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RechercheProfils_userId_createdAt_idx" ON "RechercheProfils"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Profil_userId_createdAt_idx" ON "Profil"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Profil_userId_urlNormalisee_key" ON "Profil"("userId", "urlNormalisee");

-- AddForeignKey
ALTER TABLE "RechercheProfils" ADD CONSTRAINT "RechercheProfils_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profil" ADD CONSTRAINT "Profil_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profil" ADD CONSTRAINT "Profil_rechercheId_fkey" FOREIGN KEY ("rechercheId") REFERENCES "RechercheProfils"("id") ON DELETE SET NULL ON UPDATE CASCADE;
